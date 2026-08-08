import { NextRequest, NextResponse } from "next/server";
import { MODELS, assertGeminiConfigured, generateJson } from "@/lib/gemini";
import { rateLimit } from "@/lib/http";
import { skillsGapSchema } from "@/lib/schemas";
import type { SkillGap, SkillsGapPlan } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface GapBody {
  gaps?: SkillGap[];
}

/**
 * AGENT — Skills-gap intelligence (gemini-2.5-flash / FLASH_AUX)
 *
 * Turns the recurring dealbreakers across skipped jobs into a prioritized,
 * time-boxed upskilling plan — so rejections become a roadmap.
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<SkillsGapPlan | { error: string }>> {
  try {
    const limited = rateLimit(req);
    if (limited) return limited;
    assertGeminiConfigured();
    const { gaps } = (await req.json()) as GapBody;

    if (!gaps?.length) {
      return NextResponse.json(
        { error: "No skill gaps yet — tailor some jobs first so the agent can learn what's blocking you." },
        { status: 400 }
      );
    }

    const list = gaps
      .sort((a, b) => b.count - a.count)
      .map((g) => `- ${g.skill} (blocked ${g.count} job${g.count === 1 ? "" : "s"})`)
      .join("\n");

    const prompt = `A candidate keeps getting filtered out of jobs for these missing skills (with how often each blocked a role):

${list}

Produce a prioritized, realistic upskilling plan. Prioritize by impact (how many roles it unlocks) × learnability. For each skill give a priority, realistic weeks-to-job-ready, and a concrete plan (what to build/learn). Be practical, not generic.`;

    const plan = await generateJson<SkillsGapPlan>({
      model: MODELS.FLASH_AUX,
      contents: prompt,
      schema: skillsGapSchema,
      temperature: 0.5,
    });
    return NextResponse.json(plan);
  } catch (err) {
    console.error("[agent/skills-gap] error:", err);
    const message = err instanceof Error ? err.message : "Skills-gap analysis failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
