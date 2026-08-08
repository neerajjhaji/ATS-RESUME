import { NextRequest, NextResponse } from "next/server";
import { MODELS, assertGeminiConfigured, generateJson } from "@/lib/gemini";
import { surgicalTailorSchema } from "@/lib/schemas";
import { fetchAllJobs } from "@/lib/jobs";
import type { JobListing, SurgicalTailor } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

interface RunBody {
  resumeText?: string;
  keywords?: string;
  locations?: string[];
  minScore?: number;
  maxTailor?: number;
  seenKeys?: string[];
  email?: string;
}

interface RunItem {
  title: string;
  company: string;
  location: string;
  applyUrl: string;
  score: number;
  status: "Ready" | "Skipped";
  dealbreakers: string[];
}

/**
 * AGENT — Unattended run (server-side orchestrator).
 *
 * Fetches jobs, self-critique-tailors each, gates on score, ranks, and (if email
 * is configured) emails a ranked application kit. Designed for a scheduled caller
 * (GitHub Actions / Vercel Cron); guarded by CRON_SECRET. Never auto-submits.
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<{ ready: RunItem[]; skipped: number; emailed: boolean } | { error: string }>> {
  try {
    const required = process.env.CRON_SECRET;
    if (required && req.headers.get("x-cron-secret") !== required) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    assertGeminiConfigured();
    const body = (await req.json().catch(() => ({}))) as RunBody;
    const resumeText = (body.resumeText ?? process.env.DIGEST_RESUME ?? "").trim();
    if (!resumeText) {
      return NextResponse.json(
        { error: "resumeText is required (pass it in the request body or DIGEST_RESUME env)." },
        { status: 400 }
      );
    }
    const keywords = (body.keywords ?? process.env.DIGEST_KEYWORDS ?? "software engineer").trim();
    const locations =
      body.locations ??
      (process.env.DIGEST_LOCATIONS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [
        "Navi Mumbai",
        "Mumbai",
        "Remote",
      ]);
    const minScore = Math.max(50, Math.min(95, body.minScore ?? 75));
    const maxTailor = Math.max(1, Math.min(8, body.maxTailor ?? 4));
    const seen = new Set((body.seenKeys ?? []).map((k) => k.toLowerCase()));

    const { jobs } = await fetchAllJobs({ what: keywords, locations });
    const fresh = jobs.filter((j) => !seen.has((j.applyUrl || `${j.title}-${j.company}`).toLowerCase()));
    const toProcess = fresh.slice(0, maxTailor);

    const results: RunItem[] = [];
    for (const job of toProcess) {
      const tailor = await tailorLoop(resumeText, job.description || job.title, minScore);
      const eligible = tailor.ats_match_score >= minScore && tailor.dealbreaker_flags.length === 0;
      results.push({
        title: job.title,
        company: job.company,
        location: job.location,
        applyUrl: job.applyUrl,
        score: tailor.ats_match_score,
        status: eligible ? "Ready" : "Skipped",
        dealbreakers: tailor.dealbreaker_flags,
      });
    }

    const ready = results.filter((r) => r.status === "Ready").sort((a, b) => b.score - a.score);
    const skipped = results.length - ready.length;

    let emailed = false;
    const to = body.email ?? process.env.DIGEST_TO;
    if (to && process.env.RESEND_API_KEY && process.env.DIGEST_FROM) {
      emailed = await emailKit(to, ready, keywords);
    }

    return NextResponse.json({ ready, skipped, emailed });
  } catch (err) {
    console.error("[agent/run] error:", err);
    const message = err instanceof Error ? err.message : "Run failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function tailorLoop(resume: string, jd: string, minScore: number): Promise<SurgicalTailor> {
  let best: SurgicalTailor | null = null;
  let feedback = "";
  for (let i = 0; i < 3; i++) {
    const prompt = `Surgically tailor the resume to the JD. Preserve structure, tone, and date formats; inject only genuinely-supported skills; never fabricate. Flag unmeetable hard requirements in dealbreaker_flags.${
      feedback ? `\nREVISION FEEDBACK:\n${feedback}` : ""
    }\n\n=== JOB DESCRIPTION ===\n${jd}\n\n=== RESUME ===\n${resume}`;
    const data = await generateJson<SurgicalTailor>({
      model: MODELS.PRO_STRATEGY,
      contents: prompt,
      schema: surgicalTailorSchema,
      temperature: 0.25,
    });
    data.ats_match_score = Math.max(0, Math.min(100, Math.round(data.ats_match_score || 0)));
    data.dealbreaker_flags = data.dealbreaker_flags ?? [];
    if (!best || data.ats_match_score > best.ats_match_score) best = data;
    if (data.ats_match_score >= minScore) break;
    feedback = `Previous attempt scored ${data.ats_match_score} (target ${minScore}). Surface every genuinely-relevant skill and quantify real impact — no fabrication.`;
  }
  return best as SurgicalTailor;
}

function esc(s: string): string {
  return (s || "").replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
  );
}

async function emailKit(to: string, ready: RunItem[], keywords: string): Promise<boolean> {
  const rows =
    ready
      .map(
        (r, i) => `<tr><td style="padding:10px 8px;border-bottom:1px solid #eee">
      <a href="${esc(r.applyUrl)}" style="color:#4f46e5;font-weight:600;text-decoration:none">#${i + 1} ${esc(r.title)}</a>
      <span style="background:#e7f6ec;color:#15803d;font-size:12px;font-weight:700;padding:2px 6px;border-radius:999px;margin-left:6px">${r.score}%</span><br/>
      <span style="color:#555;font-size:13px">${esc(r.company)} · ${esc(r.location)}</span></td></tr>`
      )
      .join("") || '<tr><td style="padding:10px;color:#999">No ready matches today.</td></tr>';

  const html = `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto">
    <h2 style="color:#111">Your agent found ${ready.length} ready-to-apply role(s)</h2>
    <p style="color:#666;font-size:14px">Search: <b>${esc(keywords)}</b> · already tailored &amp; gated (≥ threshold, no dealbreakers)</p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <p style="color:#999;font-size:12px;margin-top:16px">Review and apply yourself — nothing is auto-submitted.</p>
  </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.DIGEST_FROM, to, subject: `Agent: ${ready.length} ready-to-apply roles`, html }),
  });
  return res.ok;
}
