import { NextRequest, NextResponse } from "next/server";
import { fetchAdzunaJobs } from "@/lib/jobs";
import type { JobListing } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface JobsBody {
  keywords?: string;
  locations?: string[];
  limit?: number;
}

/**
 * AGENT — Live job feed (Adzuna).
 *
 * Fetches public job listings for the given keywords across the chosen
 * locations. Read-only discovery — no account, no submission.
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<{ jobs: JobListing[] } | { error: string }>> {
  try {
    const { keywords, locations, limit = 15 } = (await req.json()) as JobsBody;
    const what = (keywords ?? "").trim() || "software engineer";

    const jobs = await fetchAdzunaJobs({ what, locations: locations ?? [] });
    return NextResponse.json({ jobs: jobs.slice(0, Math.max(1, Math.min(50, limit))) });
  } catch (err) {
    console.error("[agent/jobs] error:", err);
    const message = err instanceof Error ? err.message : "Job fetch failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
