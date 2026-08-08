import { NextRequest, NextResponse } from "next/server";
import type { ApplyEligibility, Platform } from "@/types";

export const runtime = "nodejs";

interface PrepareBody {
  jobUrl?: string;
  platform?: Platform;
  ats_match_score?: number;
  dealbreaker_flags?: string[];
}

const MIN_SCORE = 75;

/**
 * AGENT — Apply Assist (human-in-the-loop; NO automated submission)
 *
 * Intentionally NOT a browser bot. Automating authenticated submissions on
 * LinkedIn/Naukri with stored session cookies violates their Terms of Service
 * and risks a permanent account ban, so this route only runs the eligibility
 * gate and returns a review package. The user reviews and submits the
 * application themselves via `applyUrl`.
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<ApplyEligibility | { error: string }>> {
  try {
    const { jobUrl, platform, ats_match_score, dealbreaker_flags } =
      (await req.json()) as PrepareBody;

    if (!jobUrl?.trim() || !platform) {
      return NextResponse.json(
        { error: "jobUrl and platform ('naukri' | 'linkedin') are required." },
        { status: 400 }
      );
    }

    const score = typeof ats_match_score === "number" ? ats_match_score : 0;
    const flags = dealbreaker_flags ?? [];

    const passesScore = score >= MIN_SCORE;
    const passesFlags = flags.length === 0;
    const eligible = passesScore && passesFlags;

    const reason = eligible
      ? `Ready to apply — ${score}% match, no dealbreakers. Review and submit on ${platform}.`
      : !passesScore
      ? `Skipped — match score ${score}% is below the ${MIN_SCORE}% threshold.`
      : `Skipped — ${flags.length} dealbreaker(s): ${flags.join("; ")}.`;

    const result: ApplyEligibility = {
      eligible,
      reason,
      ats_match_score: score,
      dealbreaker_flags: flags,
      applyUrl: jobUrl,
      platform,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[agent/prepare-apply] error:", err);
    const message = err instanceof Error ? err.message : "Prepare-apply failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
