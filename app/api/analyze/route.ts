import { NextRequest, NextResponse } from "next/server";
import { MODELS, assertGeminiConfigured, generateJson } from "@/lib/gemini";
import { rateLimit } from "@/lib/http";
import { atsAuditSchema } from "@/lib/schemas";
import type { AtsAudit } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface AnalyzeBody {
  resumeText?: string;
  jobDescription?: string;
  jobTitle?: string;
}

/**
 * PHASE 2 — Strategic ATS audit (gemini-3.1-pro)
 *
 * Performs a deep match analysis with enforced JSON output: match score,
 * keyword gap buckets, and line-by-line actionable rewrites.
 */
export async function POST(req: NextRequest): Promise<NextResponse<AtsAudit | { error: string }>> {
  try {
    const limited = rateLimit(req);
    if (limited) return limited;
    assertGeminiConfigured();

    const { resumeText, jobDescription, jobTitle } = (await req.json()) as AnalyzeBody;

    if (!resumeText?.trim() || !jobDescription?.trim()) {
      return NextResponse.json(
        { error: "Both resumeText and jobDescription are required." },
        { status: 400 }
      );
    }

    const prompt = `You are a senior technical recruiter and ATS optimization expert.

Analyze how well the RESUME matches the JOB DESCRIPTION for the target role "${
      jobTitle?.trim() || "the specified position"
    }".

Rules:
- Be rigorous and specific. Base the match_score on genuine keyword + experience overlap, not optimism.
- For every actionable_change, copy current_text VERBATIM from the resume so it can be located and replaced programmatically. If you are recommending a brand-new bullet, set current_text to the closest existing line it should sit near.
- suggested_text must stay truthful to the candidate's real experience — enhance phrasing, add JD-aligned keywords and quantifiable metrics, never fabricate employers or credentials.
- Prioritize the highest-impact 5-10 changes.

=== TARGET JOB TITLE ===
${jobTitle?.trim() || "(not provided)"}

=== JOB DESCRIPTION ===
${jobDescription}

=== RESUME ===
${resumeText}`;

    const audit = await generateJson<AtsAudit>({
      model: MODELS.PRO_STRATEGY,
      contents: prompt,
      schema: atsAuditSchema,
      temperature: 0.3,
    });

    // Clamp defensively in case the model returns out-of-range values.
    if (typeof audit.match_score === "number") {
      audit.match_score = Math.max(0, Math.min(100, Math.round(audit.match_score)));
    }

    return NextResponse.json(audit);
  } catch (err) {
    console.error("[analyze] error:", err);
    const message = err instanceof Error ? err.message : "Analysis failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
