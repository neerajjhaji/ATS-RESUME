import { NextRequest, NextResponse } from "next/server";
import { MODELS, assertGeminiConfigured, generateJson } from "@/lib/gemini";
import { rateLimit } from "@/lib/http";
import { planSchema } from "@/lib/schemas";
import type { AgentPlan } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface PlanBody {
  resumeText?: string;
  locations?: string[];
  memoryHints?: string[];
}

const DEFAULT_LOCATIONS = ["Navi Mumbai", "Mumbai", "Remote"];

/**
 * AGENT — Planner (gemini-2.5-pro / PRO_STRATEGY)
 *
 * The agent's "decide what to do" step: from the resume + target locations (and
 * hints about which keywords have historically matched well), it produces a
 * structured plan — keywords, titles, match threshold, and how many jobs to
 * tailor this run — that the orchestrator then executes.
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<AgentPlan | { error: string }>> {
  try {
    const limited = rateLimit(req);
    if (limited) return limited;
    assertGeminiConfigured();
    const { resumeText, locations, memoryHints } = (await req.json()) as PlanBody;

    if (!resumeText?.trim()) {
      return NextResponse.json({ error: "resumeText is required." }, { status: 400 });
    }
    const locs = locations?.length ? locations : DEFAULT_LOCATIONS;

    const hints = memoryHints?.length
      ? `\n\nKeywords that matched well in past runs (favor these if relevant): ${memoryHints.join(", ")}.`
      : "";

    const prompt = `You are the planning module of a job-search agent. Devise a focused plan for THIS run.

Rules:
- locations MUST be exactly: ${locs.map((l) => `"${l}"`).join(", ")}.
- Choose keywords + titles the candidate is genuinely competitive for (max one seniority stretch).
- match_threshold: 75 unless the resume is unusually strong/weak.
- max_tailor: 3-6 (tailoring is expensive; pick the most promising count).${hints}

=== RESUME ===
${resumeText}`;

    const plan = await generateJson<AgentPlan>({
      model: MODELS.PRO_STRATEGY,
      contents: prompt,
      schema: planSchema,
      temperature: 0.4,
    });
    // Clamp to safe bounds.
    plan.locations = plan.locations?.length ? plan.locations : locs;
    plan.match_threshold = Math.max(60, Math.min(90, Math.round(plan.match_threshold || 75)));
    plan.max_tailor = Math.max(1, Math.min(8, Math.round(plan.max_tailor || 5)));

    return NextResponse.json(plan);
  } catch (err) {
    console.error("[agent/plan] error:", err);
    const message = err instanceof Error ? err.message : "Planning failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
