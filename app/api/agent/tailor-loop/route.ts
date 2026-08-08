import { NextRequest, NextResponse } from "next/server";
import { ai, MODELS, assertGeminiConfigured } from "@/lib/gemini";
import { surgicalTailorSchema } from "@/lib/schemas";
import type { SurgicalTailor, TailorAttempt } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface LoopBody {
  originalResumeText?: string;
  jobDescription?: string;
  minScore?: number;
  maxTries?: number;
}

async function tailorOnce(
  resume: string,
  jd: string,
  feedback: string
): Promise<SurgicalTailor> {
  const prompt = `You are a surgical resume editor and ATS expert.

STRICT DIRECTIVE:
- Preserve the ORIGINAL structure exactly: section titles, ordering, date formats, tone.
- Inject ONLY genuinely-supported JD tools/skills into existing bullets. NEVER invent
  employers, titles, dates, degrees, or experience.
- If a hard requirement can't be met, put it in dealbreaker_flags — never fabricate.
${feedback ? `\nREVISION FEEDBACK (address this to raise the honest match):\n${feedback}\n` : ""}
=== JOB DESCRIPTION ===
${jd}

=== ORIGINAL RESUME ===
${resume}`;

  const response = await ai.models.generateContent({
    model: MODELS.PRO_STRATEGY,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: surgicalTailorSchema,
      temperature: 0.25,
    },
  });
  const data = JSON.parse(response.text ?? "{}") as SurgicalTailor;
  if (typeof data.ats_match_score === "number") {
    data.ats_match_score = Math.max(0, Math.min(100, Math.round(data.ats_match_score)));
  }
  data.dealbreaker_flags = data.dealbreaker_flags ?? [];
  return data;
}

/**
 * AGENT — Self-critique tailoring loop (gemini-2.5-pro / PRO_STRATEGY)
 *
 * Tailors, then reflects: if the score is below the threshold, it feeds the gaps
 * back and re-tailors, up to maxTries — never fabricating. Returns the
 * best-scoring attempt plus the per-attempt score trail.
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<SurgicalTailor | { error: string }>> {
  try {
    assertGeminiConfigured();
    const { originalResumeText, jobDescription, minScore = 75, maxTries = 3 } =
      (await req.json()) as LoopBody;

    if (!originalResumeText?.trim() || !jobDescription?.trim()) {
      return NextResponse.json(
        { error: "originalResumeText and jobDescription are required." },
        { status: 400 }
      );
    }

    const tries = Math.max(1, Math.min(4, maxTries));
    const attempts: TailorAttempt[] = [];
    let best: SurgicalTailor | null = null;
    let feedback = "";

    for (let i = 1; i <= tries; i++) {
      const result = await tailorOnce(originalResumeText, jobDescription, feedback);
      attempts.push({ try: i, score: result.ats_match_score });
      if (!best || result.ats_match_score > best.ats_match_score) best = result;

      if (result.ats_match_score >= minScore) break;

      // Reflect: build targeted feedback for the next attempt.
      const gaps = result.dealbreaker_flags.length
        ? `Unresolved gaps: ${result.dealbreaker_flags.join("; ")}.`
        : "";
      feedback = `The previous attempt scored ${result.ats_match_score} (target ${minScore}). ${gaps} Surface every genuinely-relevant skill the resume already supports, quantify impact where real, and mirror the JD's exact terminology — without inventing anything.`;
    }

    const out: SurgicalTailor = { ...(best as SurgicalTailor), attempts };
    return NextResponse.json(out);
  } catch (err) {
    console.error("[agent/tailor-loop] error:", err);
    const message = err instanceof Error ? err.message : "Tailoring loop failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
