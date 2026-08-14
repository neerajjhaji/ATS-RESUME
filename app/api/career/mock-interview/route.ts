import { NextRequest, NextResponse } from "next/server";
import { MODELS, assertGeminiConfigured, generateJson } from "@/lib/gemini";
import { rateLimit } from "@/lib/http";
import { humanizeError } from "@/lib/errors";
import { mockEvaluationSchema, mockInterviewSchema } from "@/lib/schemas";
import type { MockEvaluation, MockInterviewSet } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface MockBody {
  mode?: "start" | "evaluate";
  resumeText?: string;
  role?: string;
  jobDescription?: string;
  question?: string;
  answer?: string;
}

/**
 * CAREER INTELLIGENCE — Mock interview.
 *
 *  mode "start"    → generate a role-specific question set from the résumé.
 *  mode "evaluate" → grade one candidate answer and return a model answer.
 *
 * Stateless: the client holds the session and posts one answer at a time.
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<MockInterviewSet | MockEvaluation | { error: string }>> {
  try {
    const limited = rateLimit(req);
    if (limited) return limited;
    assertGeminiConfigured();

    const body = (await req.json()) as MockBody;
    const resumeText = body.resumeText?.trim();
    if (!resumeText) {
      return NextResponse.json({ error: "resumeText is required." }, { status: 400 });
    }

    const roleHint = body.role?.trim() || body.jobDescription?.trim() || "the candidate's target role";

    if (body.mode === "evaluate") {
      if (!body.question?.trim() || !body.answer?.trim()) {
        return NextResponse.json(
          { error: "question and answer are required to evaluate." },
          { status: 400 }
        );
      }
      const evaluation = await generateJson<MockEvaluation>({
        model: MODELS.FLASH_AUX,
        contents: `You are a senior interviewer for ${roleHint}. Evaluate the candidate's ANSWER to the QUESTION. Score it, give concrete strengths and improvements, and write a strong model answer grounded in the candidate's real résumé (use STAR where relevant). Be constructive but honest.

=== QUESTION ===
${body.question}

=== CANDIDATE ANSWER ===
${body.answer}

=== RESUME ===
${resumeText}`,
        schema: mockEvaluationSchema,
        temperature: 0.3,
      });
      if (typeof evaluation.score === "number") {
        evaluation.score = Math.max(0, Math.min(100, Math.round(evaluation.score)));
      }
      return NextResponse.json(evaluation);
    }

    // mode "start"
    const set = await generateJson<MockInterviewSet>({
      model: MODELS.FLASH_AUX,
      contents: `You are an interview coach. Generate a realistic mock-interview question set for ${roleHint}, spanning behavioral, technical, and role-specific angles, calibrated to the candidate's seniority.

=== RESUME ===
${resumeText}`,
      schema: mockInterviewSchema,
      temperature: 0.5,
    });
    return NextResponse.json(set);
  } catch (err) {
    console.error("[career/mock-interview] error:", err);
    return NextResponse.json({ error: humanizeError(err) }, { status: 500 });
  }
}
