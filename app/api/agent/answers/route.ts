import { NextRequest, NextResponse } from "next/server";
import { MODELS, assertGeminiConfigured, generateJson } from "@/lib/gemini";
import { rateLimit } from "@/lib/http";
import { answerPackSchema } from "@/lib/schemas";
import type { AnswerPack, MasterProfile } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface AnswersBody {
  profile?: Partial<MasterProfile>;
  jobDescription?: string;
  company?: string;
  title?: string;
}

/**
 * AGENT — Answer pack (gemini-2.5-flash / FLASH_AUX)
 *
 * Drafts truthful answers to recurring screening questions from the candidate's
 * saved profile + the JD, so filling an application form is copy-paste fast.
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<AnswerPack | { error: string }>> {
  try {
    const limited = rateLimit(req);
    if (limited) return limited;
    assertGeminiConfigured();
    const { profile, jobDescription, company, title } = (await req.json()) as AnswersBody;

    if (!jobDescription?.trim()) {
      return NextResponse.json({ error: "jobDescription is required." }, { status: 400 });
    }

    const p = profile ?? {};
    const prompt = `Draft concise, truthful answers to common job-application screening questions.

Use ONLY the candidate profile facts below — never invent numbers or claims. Keep each answer tight and ready to paste into a form.

=== CANDIDATE PROFILE ===
Name: ${p.fullName ?? "(n/a)"}
Location: ${p.location ?? "(n/a)"}
Years experience: ${p.yearsExperience ?? "(n/a)"}
Notice period: ${p.noticePeriod ?? "(n/a)"}
Current CTC: ${p.currentCtc ?? "(n/a)"}
Expected CTC: ${p.expectedCtc ?? "(n/a)"}
Work authorization: ${p.workAuth ?? "(n/a)"}

=== TARGET ROLE ===
${title ?? "(role)"} at ${company ?? "(company)"}

=== JOB DESCRIPTION ===
${jobDescription}`;

    const data = await generateJson<AnswerPack>({
      model: MODELS.FLASH_AUX,
      contents: prompt,
      schema: answerPackSchema,
      temperature: 0.5,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[agent/answers] error:", err);
    const message = err instanceof Error ? err.message : "Answer generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
