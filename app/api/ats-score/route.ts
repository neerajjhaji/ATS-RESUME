import { NextRequest, NextResponse } from "next/server";
import { MODELS, assertGeminiConfigured, generateJson } from "@/lib/gemini";
import { rateLimit } from "@/lib/http";
import { atsReadinessSchema } from "@/lib/schemas";
import type { AtsReadiness } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ScoreBody {
  resumeText?: string;
}

/**
 * STANDALONE ATS SCORE (gemini-3.1-pro)
 *
 * Predicts an ATS-readiness score from the resume ALONE — no job description,
 * no target job title. It judges general parsability and quality: formatting,
 * quantified impact, action verbs, section completeness, keyword density, and
 * length/contact hygiene. Useful as a quick health check before tailoring.
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<AtsReadiness | { error: string }>> {
  try {
    const limited = rateLimit(req);
    if (limited) return limited;
    assertGeminiConfigured();

    const { resumeText } = (await req.json()) as ScoreBody;

    if (!resumeText?.trim()) {
      return NextResponse.json({ error: "resumeText is required." }, { status: 400 });
    }

    const prompt = `You are an ATS (Applicant Tracking System) parser and resume quality expert.

Score the following resume ON ITS OWN, with NO specific job in mind. Judge how well a typical ATS would parse it and how strong it reads generally. Score each dimension 0-100:
- Formatting & Parsability (single column, standard headers, no tables/graphics that break parsers)
- Quantified Impact (metrics, numbers, outcomes)
- Action Verbs & Clarity (strong verbs, concise bullets)
- Section Completeness (summary, experience, skills, education, contact)
- Keyword Density (industry-relevant terms present)
- Length & Contact Info (appropriate length, reachable contact details)

Be objective and specific in each note. Provide 3-6 general quick wins.

=== RESUME ===
${resumeText}`;

    const readiness = await generateJson<AtsReadiness>({
      model: MODELS.PRO_STRATEGY,
      contents: prompt,
      schema: atsReadinessSchema,
      temperature: 0.3,
    });

    if (typeof readiness.ats_score === "number") {
      readiness.ats_score = Math.max(0, Math.min(100, Math.round(readiness.ats_score)));
    }
    readiness.breakdown = (readiness.breakdown ?? []).map((b) => ({
      ...b,
      score: Math.max(0, Math.min(100, Math.round(b.score ?? 0))),
    }));

    return NextResponse.json(readiness);
  } catch (err) {
    console.error("[ats-score] error:", err);
    const message = err instanceof Error ? err.message : "Scoring failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
