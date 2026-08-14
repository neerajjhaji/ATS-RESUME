import { NextRequest, NextResponse } from "next/server";
import { MODELS, assertGeminiConfigured, generateJson } from "@/lib/gemini";
import { rateLimit } from "@/lib/http";
import { adzunaConfigured, fetchAllJobs } from "@/lib/jobs";
import { jobDiscoverySchema, recommendMatchesSchema } from "@/lib/schemas";
import type { JobDiscovery, JobListing, JobMatch, JobRecommendations } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RecommendBody {
  resumeText?: string;
  locations?: string[];
}

const DEFAULT_LOCATIONS = ["Navi Mumbai", "Mumbai", "Remote"];
const MAX_JOBS = 12;

interface ScoredMatch {
  id: string;
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  experience_required: string;
  match_reason: string;
}

/**
 * CAREER TOOL — Profile-matched job recommendations.
 *
 * Turns a resume into real, ranked job matches in one request:
 *   1. derive search keywords/titles from the resume (flash),
 *   2. pull live listings for the chosen locations (Adzuna + keyless feeds),
 *   3. score every listing against the resume in a single batched call,
 *      returning match score + matched/missing skills + experience per role.
 *
 * Read-only discovery — no account, no submission. Adzuna needs keys; adding
 * "Remote" uses the keyless RemoteOK/Arbeitnow feeds so it works out of the box.
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<JobRecommendations | { error: string }>> {
  try {
    const limited = rateLimit(req);
    if (limited) return limited;
    assertGeminiConfigured();

    const { resumeText, locations } = (await req.json()) as RecommendBody;
    if (!resumeText?.trim()) {
      return NextResponse.json({ error: "resumeText is required." }, { status: 400 });
    }
    const locs = locations?.length ? locations : DEFAULT_LOCATIONS;

    // 1 · Discover search terms from the resume.
    const discovery = await generateJson<JobDiscovery>({
      model: MODELS.FLASH_AUX,
      contents: `You are a job-search strategist. From the RESUME below, produce search terms and realistic target titles for India-based job boards.

Rules:
- target_job_titles must match the candidate's real seniority and domain — no aspirational stretch beyond one level.
- search_keywords should combine role terms with the candidate's strongest tools/skills.
- location_filters MUST be exactly: ${locs.map((l) => `"${l}"`).join(", ")}.

=== RESUME ===
${resumeText}`,
      schema: jobDiscoverySchema,
      temperature: 0.4,
    });

    const what =
      discovery.search_keywords?.slice(0, 5).join(" ").trim() ||
      discovery.target_job_titles?.[0] ||
      "software engineer";

    // 2 · Pull live listings.
    const { jobs, errors } = await fetchAllJobs({ what, locations: locs });

    if (jobs.length === 0) {
      const note = !adzunaConfigured()
        ? "No live job sources are configured. Add ADZUNA_APP_ID / ADZUNA_APP_KEY to .env.local, or include “Remote” in your locations to use the keyless feeds."
        : errors.length
        ? `No roles came back from the live feeds (${errors.join("; ")}). Try different locations or check back shortly.`
        : "No roles matched right now. Try adding “Remote” or widening your locations.";
      return NextResponse.json({ matches: [], note });
    }

    const shortlist = jobs.slice(0, MAX_JOBS);

    // 3 · Batch-score every listing against the resume in one call.
    const jobsForScoring = shortlist.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      description: (j.description || "").slice(0, 700),
    }));

    const scored = await generateJson<{ matches: ScoredMatch[] }>({
      model: MODELS.FLASH_AUX,
      contents: `You are a senior technical recruiter. Score how well the CANDIDATE RESUME fits each JOB in the list.

For EVERY job (match them by the exact "id"):
- match_score: 0-100 based on genuine skill + experience overlap. Be realistic — a strong fit is 80+, a stretch is <60.
- matched_skills: required skills the candidate already demonstrates.
- missing_skills: required skills that are absent or weak in the resume.
- experience_required: what the JD expects (e.g. "3–5 years"); "Not specified" if unclear.
- match_reason: one concise sentence.

Return exactly one entry per input job.

=== CANDIDATE RESUME ===
${resumeText}

=== JOBS (JSON) ===
${JSON.stringify(jobsForScoring)}`,
      schema: recommendMatchesSchema,
      temperature: 0.3,
    });

    // Join scores back onto the full listings by id.
    const byId = new Map<string, ScoredMatch>();
    for (const m of scored.matches ?? []) byId.set(m.id, m);

    const matches: JobMatch[] = shortlist.map((job: JobListing) => {
      const s = byId.get(job.id);
      return {
        ...job,
        match_score: clampScore(s?.match_score),
        matched_skills: s?.matched_skills ?? [],
        missing_skills: s?.missing_skills ?? [],
        experience_required: s?.experience_required || "Not specified",
        match_reason: s?.match_reason || "",
      };
    });

    matches.sort((a, b) => b.match_score - a.match_score);

    return NextResponse.json({
      matches,
      note: errors.length ? `Some sources were unavailable: ${errors.join("; ")}` : undefined,
    });
  } catch (err) {
    console.error("[agent/recommend] error:", err);
    const message = err instanceof Error ? err.message : "Recommendation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function clampScore(n: unknown): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
