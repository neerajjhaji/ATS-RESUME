import { NextRequest, NextResponse } from "next/server";
import { MODELS, assertGeminiConfigured, generateJson } from "@/lib/gemini";
import { rateLimit } from "@/lib/http";
import { humanizeError } from "@/lib/errors";
import { candidateProfileSchema, salaryInsightSchema, skillsGapSchema } from "@/lib/schemas";
import type { CandidateProfile, CareerOverview, SalaryInsight, SkillsGapPlan } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface OverviewBody {
  resumeText?: string;
  role?: string;
  location?: string;
}

/**
 * CAREER INTELLIGENCE — Overview.
 *
 * Produces the standing dashboard bundle in one request: candidate profile +
 * career-readiness, a market salary estimate, and a prioritized learning path.
 * Each is an independent Gemini call, run in parallel; a single failure fails the
 * request (the client shows a friendly message).
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<CareerOverview | { error: string }>> {
  try {
    const limited = rateLimit(req);
    if (limited) return limited;
    assertGeminiConfigured();

    const { resumeText, role, location } = (await req.json()) as OverviewBody;
    if (!resumeText?.trim()) {
      return NextResponse.json({ error: "resumeText is required." }, { status: 400 });
    }

    const targetHint = [role?.trim(), location?.trim()].filter(Boolean).join(" · ");

    const [profile, salary, learningPath] = await Promise.all([
      generateJson<CandidateProfile>({
        model: MODELS.FLASH_AUX,
        contents: `Build a rigorous candidate intelligence profile from the RESUME. Be honest about weaknesses; score career_readiness and its breakdown realistically.

=== RESUME ===
${resumeText}`,
        schema: candidateProfileSchema,
        temperature: 0.3,
      }),
      generateJson<SalaryInsight>({
        model: MODELS.FLASH_AUX,
        contents: `You are a compensation analyst. Estimate a realistic market salary range for this candidate${
          targetHint ? ` targeting: ${targetHint}` : ""
        }. Infer role, seniority, and location from the RESUME if not given. Use the most relevant local currency. Be realistic, not aspirational.

=== RESUME ===
${resumeText}`,
        schema: salaryInsightSchema,
        temperature: 0.3,
      }),
      generateJson<SkillsGapPlan>({
        model: MODELS.FLASH_AUX,
        contents: `You are a career coach. From the RESUME, build a prioritized learning path (highest-leverage skills first) to strengthen this candidate for their next role${
          targetHint ? ` (${targetHint})` : ""
        }, with realistic weeks-to-proficiency.

=== RESUME ===
${resumeText}`,
        schema: skillsGapSchema,
        temperature: 0.4,
      }),
    ]);

    if (typeof profile.career_readiness === "number") {
      profile.career_readiness = Math.max(0, Math.min(100, Math.round(profile.career_readiness)));
    }

    return NextResponse.json({ profile, salary, learningPath });
  } catch (err) {
    console.error("[career/overview] error:", err);
    return NextResponse.json({ error: humanizeError(err) }, { status: 500 });
  }
}
