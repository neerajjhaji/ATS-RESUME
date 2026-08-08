import { NextRequest, NextResponse } from "next/server";
import { fetchAllJobs } from "@/lib/jobs";
import type { JobListing } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface DigestBody {
  keywords?: string;
  locations?: string[];
  to?: string;
  limit?: number;
}

/**
 * AGENT — Daily digest email.
 *
 * Fetches fresh listings (multi-source) and emails a formatted digest via Resend.
 * Designed to be called on a schedule (GitHub Actions / Vercel Cron) or on demand
 * from the UI. Protected by CRON_SECRET when that env var is set.
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<{ sent: boolean; count: number } | { error: string }>> {
  try {
    // Optional shared-secret guard for scheduled callers.
    const required = process.env.CRON_SECRET;
    if (required) {
      const provided = req.headers.get("x-cron-secret");
      if (provided !== required) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
    }

    const body = (await req.json().catch(() => ({}))) as DigestBody;
    const keywords = (body.keywords ?? process.env.DIGEST_KEYWORDS ?? "software engineer").trim();
    const locations =
      body.locations ??
      (process.env.DIGEST_LOCATIONS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [
        "Navi Mumbai",
        "Mumbai",
        "Remote",
      ]);
    const to = body.to ?? process.env.DIGEST_TO;
    const limit = Math.max(1, Math.min(40, body.limit ?? 15));

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.DIGEST_FROM;
    if (!apiKey || !from || !to) {
      return NextResponse.json(
        {
          error:
            "Email not configured. Set RESEND_API_KEY, DIGEST_FROM, and DIGEST_TO (or pass `to`) in .env.local.",
        },
        { status: 400 }
      );
    }

    const { jobs } = await fetchAllJobs({ what: keywords, locations });
    const top = jobs.slice(0, limit);

    const html = renderDigestHtml(top, { keywords, locations });
    const subject = `Job digest — ${top.length} matches (${keywords})`;

    const send = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!send.ok) {
      const t = await send.text().catch(() => "");
      throw new Error(`Resend ${send.status}: ${t.slice(0, 160)}`);
    }

    return NextResponse.json({ sent: true, count: top.length });
  } catch (err) {
    console.error("[agent/digest] error:", err);
    const message = err instanceof Error ? err.message : "Digest failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function esc(s: string): string {
  return (s || "").replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
  );
}

function renderDigestHtml(jobs: JobListing[], meta: { keywords: string; locations: string[] }): string {
  const rows = jobs
    .map(
      (j) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee">
        <a href="${esc(j.applyUrl)}" style="color:#4f46e5;font-weight:600;text-decoration:none">${esc(j.title)}</a><br/>
        <span style="color:#555;font-size:13px">${esc(j.company)} · ${esc(j.location)}${j.salary ? " · " + esc(j.salary) : ""} · <span style="color:#999">${esc(j.source)}</span></span>
      </td>
    </tr>`
    )
    .join("");

  return `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto">
    <h2 style="color:#111">Your job digest</h2>
    <p style="color:#666;font-size:14px">Keywords: <b>${esc(meta.keywords)}</b> · Locations: ${esc(meta.locations.join(", "))}</p>
    <table style="width:100%;border-collapse:collapse">${rows || '<tr><td style="padding:10px;color:#999">No new matches today.</td></tr>'}</table>
    <p style="color:#999;font-size:12px;margin-top:16px">Sent by your Resume Tailor agent. Review and apply yourself — nothing is auto-submitted.</p>
  </div>`;
}
