import { NextRequest, NextResponse } from "next/server";
import { MODELS, assertGeminiConfigured, generateJson } from "@/lib/gemini";
import { rateLimit } from "@/lib/http";
import { prepPackSchema } from "@/lib/schemas";
import type { PrepPack } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface PrepBody {
  resumeText?: string;
  jobDescription?: string;
  company?: string;
  title?: string;
}

/**
 * AGENT — Interview prep pack (gemini-2.5-flash / FLASH_AUX)
 *
 * Per role: a short brief, tailored interview tips, and likely questions with
 * STAR answers grounded in the candidate's real resume.
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<PrepPack | { error: string }>> {
  try {
    const limited = rateLimit(req);
    if (limited) return limited;
    assertGeminiConfigured();
    const { resumeText, jobDescription, company, title } = (await req.json()) as PrepBody;

    if (!jobDescription?.trim()) {
      return NextResponse.json({ error: "jobDescription is required." }, { status: 400 });
    }

    const prompt = `Prepare interview material for this specific role. Base STAR answers ONLY on the candidate's real resume — never invent experience.

Return:
- company_brief: what this role/team likely values, inferred from the JD.
- interview_tips: 5-7 specific tips for THIS role (not generic advice).
- questions: 6-8 likely questions with concise STAR answers drawn from the resume.

=== ROLE ===
${title ?? "(role)"} at ${company ?? "(company)"}

=== JOB DESCRIPTION ===
${jobDescription}

=== RESUME ===
${resumeText ?? "(not provided — keep STAR answers general but honest)"}`;

    const pack = await generateJson<PrepPack>({
      model: MODELS.FLASH_AUX,
      contents: prompt,
      schema: prepPackSchema,
      temperature: 0.5,
    });
    return NextResponse.json(pack);
  } catch (err) {
    console.error("[agent/prep] error:", err);
    const message = err instanceof Error ? err.message : "Prep generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
