import { NextRequest, NextResponse } from "next/server";
import { MODELS, assertGeminiConfigured, generateJson } from "@/lib/gemini";
import { rateLimit } from "@/lib/http";
import { surgicalTailorSchema } from "@/lib/schemas";
import type { SurgicalTailor } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface TailorBody {
  originalResumeText?: string;
  jobDescription?: string;
}

/**
 * AGENT — Surgical tailor (gemini-2.5-pro / PRO_STRATEGY)
 *
 * Returns a structured, tailored resume that preserves the original layout and
 * tone, plus an ATS score and dealbreaker flags. The PDF is produced client-side
 * from tailored_resume_data via lib/export (renderResumeDataToText → downloadResumePdf).
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<SurgicalTailor | { error: string }>> {
  try {
    const limited = rateLimit(req);
    if (limited) return limited;
    assertGeminiConfigured();
    const { originalResumeText, jobDescription } = (await req.json()) as TailorBody;

    if (!originalResumeText?.trim() || !jobDescription?.trim()) {
      return NextResponse.json(
        { error: "originalResumeText and jobDescription are required." },
        { status: 400 }
      );
    }

    const prompt = `You are a surgical resume editor and ATS expert.

STRICT DIRECTIVE:
- Preserve the ORIGINAL structure exactly: section titles, ordering, date formats, and the candidate's tone/voice.
- Surgically inject ONLY genuinely-supported tools/skills from the JD into existing bullets where the candidate's real experience plausibly covers them.
- NEVER invent employers, titles, dates, degrees, or experience the resume doesn't support.
- If the JD has hard requirements the resume cannot meet, list them in dealbreaker_flags (do not fabricate to satisfy them).
- key_updates_made must concisely describe each real edit.

Return the full tailored resume in tailored_resume_data with the same sections as the original.

=== JOB DESCRIPTION ===
${jobDescription}

=== ORIGINAL RESUME ===
${originalResumeText}`;

    const data = await generateJson<SurgicalTailor>({
      model: MODELS.PRO_STRATEGY,
      contents: prompt,
      schema: surgicalTailorSchema,
      temperature: 0.25,
    });
    if (typeof data.ats_match_score === "number") {
      data.ats_match_score = Math.max(0, Math.min(100, Math.round(data.ats_match_score)));
    }
    data.dealbreaker_flags = data.dealbreaker_flags ?? [];

    return NextResponse.json(data);
  } catch (err) {
    console.error("[agent/tailor-diff] error:", err);
    const message = err instanceof Error ? err.message : "Tailoring failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
