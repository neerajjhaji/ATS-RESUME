import { NextRequest, NextResponse } from "next/server";
import { ai, MODELS, assertGeminiConfigured } from "@/lib/gemini";
import { coverLetterSchema } from "@/lib/schemas";
import type { AtsAudit, CoverLetterResponse } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface CoverLetterBody {
  resumeText?: string;
  jobDescription?: string;
  jobTitle?: string;
  analysis?: AtsAudit;
}

/**
 * PHASE 3 — Cover letter generation (gemini-3.5-flash)
 *
 * Uses the parsed resume + the Phase 2 gap analysis to write a highly aligned
 * cover letter that leans into matched strengths and addresses gaps credibly.
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<CoverLetterResponse | { error: string }>> {
  try {
    assertGeminiConfigured();

    const { resumeText, jobDescription, jobTitle, analysis } =
      (await req.json()) as CoverLetterBody;

    if (!resumeText?.trim() || !jobDescription?.trim()) {
      return NextResponse.json(
        { error: "resumeText and jobDescription are required." },
        { status: 400 }
      );
    }

    const gapContext = analysis
      ? `\n\n=== ATS GAP ANALYSIS (lean into matched strengths; frame gaps as growth) ===\nMatched keywords: ${analysis.keywords?.matched?.join(", ") || "n/a"}\nEmphasize these where truthful: ${[
          ...(analysis.keywords?.missing_hard_skills ?? []),
          ...(analysis.keywords?.missing_tools ?? []),
        ].join(", ") || "n/a"}`
      : "";

    const prompt = `Write a compelling, concise cover letter for the role "${
      jobTitle?.trim() || "the target role"
    }".

Guidelines:
- 250-350 words, professional but warm, first person.
- Open with a specific hook tied to the role/company, not a generic greeting.
- Use concrete achievements pulled from the resume; do not invent facts.
- Naturally weave in high-value JD keywords.
- End with a confident call to action.
- Plain text with paragraph breaks. No markdown, no bracketed placeholders.
${gapContext}

=== JOB DESCRIPTION ===
${jobDescription}

=== RESUME ===
${resumeText}`;

    const response = await ai.models.generateContent({
      model: MODELS.FLASH_AUX,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: coverLetterSchema,
        temperature: 0.7,
      },
    });

    const parsed = JSON.parse(response.text ?? "{}") as CoverLetterResponse;
    return NextResponse.json({ cover_letter: parsed.cover_letter ?? "" });
  } catch (err) {
    console.error("[cover-letter] error:", err);
    const message = err instanceof Error ? err.message : "Cover letter generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
