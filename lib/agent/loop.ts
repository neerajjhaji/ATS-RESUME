import { MODELS, generateJson } from "@/lib/gemini";
import { agentCriticSchema, agentPlanSchema } from "@/lib/schemas";
import { TOOL_MAP, TOOLS, toolCatalog } from "@/lib/agent/tools";
import type { ToolContext } from "@/lib/agent/types";
import type {
  AgentCritic,
  AgentEvent,
  AgentPlan,
  AgentResult,
  AtsAudit,
  AtsReadiness,
  CandidateProfile,
  JobMatch,
  PrepPack,
  SkillsGapPlan,
  SurgicalTailor,
} from "@/types";

export interface AgentInput {
  goal: string;
  resumeText: string;
  locations: string[];
  jobDescription?: string;
}

/**
 * PLAN phase — turn the user's goal + résumé into an ordered tool plan. Shown to
 * the user for approval before anything executes (the plan-level human checkpoint).
 */
export async function planAgent(input: AgentInput): Promise<AgentPlan> {
  const plan = await generateJson<AgentPlan>({
    model: MODELS.PRO_STRATEGY,
    contents: `You are an AI Career Agent orchestrator. Produce a MINIMAL ordered plan of tool steps to achieve the user's GOAL for this candidate. Use ONLY tool names from the CATALOG. Prefer starting with build_profile. Do not add redundant steps; each step must move toward the goal.

=== GOAL ===
${input.goal || "Give me a complete career readiness assessment and my best job matches."}

=== TOOL CATALOG ===
${toolCatalog()}

=== RESUME (context) ===
${input.resumeText.slice(0, 4000)}`,
    schema: agentPlanSchema,
    temperature: 0.3,
  });

  // Keep only real tools; guarantee a sensible non-empty plan.
  plan.steps = (plan.steps ?? []).filter((s) => TOOL_MAP[s.tool]);
  if (plan.steps.length === 0) {
    plan.steps = defaultPlan();
    plan.goal_understanding =
      plan.goal_understanding || "Assess the candidate and surface their best opportunities.";
  }
  return plan;
}

function defaultPlan(): AgentPlan["steps"] {
  return [
    { tool: "build_profile", why: "Understand the candidate before acting." },
    { tool: "score_ats", why: "Establish the résumé's baseline ATS health." },
    { tool: "discover_terms", why: "Derive realistic target roles and keywords." },
    { tool: "match_jobs", why: "Find and rank the best-fit live roles." },
  ];
}

/**
 * RUN phase — execute the approved plan, streaming a live timeline, then run a
 * critic over the results before delivering. `emit` pushes one AgentEvent per
 * SSE line.
 */
export async function runAgent(
  input: AgentInput,
  plan: AgentPlan,
  emit: (e: AgentEvent) => void
): Promise<void> {
  const steps = (plan.steps ?? []).filter((s) => TOOL_MAP[s.tool]);
  const ctx: ToolContext = {
    goal: input.goal,
    resumeText: input.resumeText,
    locations: input.locations,
    jobDescription: input.jobDescription,
    blackboard: {},
    emit,
    stepId: 0,
  };

  const timeline: { tool: string; summary: string }[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const tool = TOOL_MAP[step.tool];
    ctx.stepId = i;
    emit({
      type: "step_start",
      id: i,
      tool: tool.name,
      label: humanLabel(tool.name),
      requiresApproval: tool.requiresApproval,
    });
    try {
      const result = await tool.run(ctx);
      ctx.blackboard[tool.blackboardKey] = result.data;
      if (result.reasoning) emit({ type: "step_reasoning", id: i, text: result.reasoning });
      emit({ type: "step_done", id: i, tool: tool.name, summary: result.summary });
      timeline.push({ tool: tool.name, summary: result.summary });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Tool failed.";
      emit({ type: "step_error", id: i, tool: tool.name, error: msg });
      timeline.push({ tool: tool.name, summary: `Failed: ${msg}` });
    }
  }

  // CRITIC — verify the results genuinely serve the goal before delivery.
  let critic: AgentCritic | undefined;
  try {
    critic = await runCritic(input.goal, timeline, ctx.blackboard);
    emit({ type: "critic", critic });
  } catch {
    /* critic is best-effort; never block delivery on it */
  }

  const result: AgentResult = {
    goal: input.goal,
    profile: ctx.blackboard.profile as CandidateProfile | undefined,
    ats: ctx.blackboard.ats as AtsReadiness | undefined,
    matches: ctx.blackboard.matches as JobMatch[] | undefined,
    audit: ctx.blackboard.audit as AtsAudit | undefined,
    tailored: ctx.blackboard.tailored as SurgicalTailor | undefined,
    interviewPrep: ctx.blackboard.interviewPrep as PrepPack | undefined,
    skillGap: ctx.blackboard.skillGap as SkillsGapPlan | undefined,
    critic,
    timeline,
  };
  emit({ type: "final", result });
}

async function runCritic(
  goal: string,
  timeline: { tool: string; summary: string }[],
  blackboard: Record<string, unknown>
): Promise<AgentCritic> {
  const profile = blackboard.profile as CandidateProfile | undefined;
  const matches = blackboard.matches as JobMatch[] | undefined;
  const highlights = {
    readiness: profile?.career_readiness,
    top_matches: matches?.slice(0, 3).map((m) => ({ title: m.title, score: m.match_score })),
    steps: timeline.map((t) => t.summary),
  };
  return generateJson<AgentCritic>({
    model: MODELS.FLASH_AUX,
    contents: `You are a critical reviewer of an AI career agent's run. Given the GOAL and a summary of what it produced, judge whether the results genuinely serve the candidate. Be skeptical. Give a verdict (pass / pass_with_notes / revise), a confidence 0-100, concrete issues, and actionable improvements for the candidate.

=== GOAL ===
${goal}

=== RUN SUMMARY (JSON) ===
${JSON.stringify(highlights)}`,
    schema: agentCriticSchema,
    temperature: 0.3,
  });
}

const LABELS: Record<string, string> = {
  build_profile: "Building candidate profile",
  score_ats: "Scoring ATS readiness",
  discover_terms: "Discovering target roles",
  fetch_jobs: "Fetching live jobs",
  match_jobs: "Ranking best-fit jobs",
  tailor_resume: "Tailoring résumé",
  interview_prep: "Preparing interview kit",
  skill_gap: "Analyzing skill gaps",
};

function humanLabel(tool: string): string {
  return LABELS[tool] ?? tool;
}

/** Names of tools that require a human checkpoint — surfaced in the plan preview. */
export const APPROVAL_TOOLS = TOOLS.filter((t) => t.requiresApproval).map((t) => t.name);
