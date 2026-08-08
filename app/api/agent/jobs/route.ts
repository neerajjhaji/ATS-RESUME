import { NextRequest, NextResponse } from "next/server";
import { adzunaConfigured, fetchAllJobs } from "@/lib/jobs";
import type { JobListing } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface JobsBody {
  keywords?: string;
  locations?: string[];
  limit?: number;
}

/**
 * AGENT — Live job feed (multi-source: Adzuna + RemoteOK + Arbeitnow).
 *
 * Read-only public discovery — no account, no submission. Adzuna needs keys;
 * RemoteOK/Arbeitnow are keyless and cover Remote roles.
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<{ jobs: JobListing[]; errors?: string[] } | { error: string }>> {
  try {
    const { keywords, locations, limit = 20 } = (await req.json()) as JobsBody;
    const what = (keywords ?? "").trim() || "software engineer";
    const locs = locations ?? [];

    const { jobs, errors } = await fetchAllJobs({ what, locations: locs });

    if (jobs.length === 0 && errors.length === 0 && !adzunaConfigured()) {
      return NextResponse.json(
        {
          error:
            "No job sources available. Add ADZUNA_APP_ID / ADZUNA_APP_KEY to .env.local, or include 'Remote' to use the keyless RemoteOK/Arbeitnow feeds.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      jobs: jobs.slice(0, Math.max(1, Math.min(60, limit))),
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    console.error("[agent/jobs] error:", err);
    const message = err instanceof Error ? err.message : "Job fetch failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
