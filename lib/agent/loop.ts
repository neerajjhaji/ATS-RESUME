import { MODELS, generateJson } from "@/lib/gemini";
import { agentCriticSchema, agentDecisionSchema, agentPlanSchema } from "@/lib/schemas";
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

interface AgentDecision {
  thought: string;
  action: string;
  reason?: string;
}

const MAX_STEPS = 8;

/**
 * RUN phase — a dynamic reason→act→observe loop. Instead of blindly executing a
 * fixed plan, the agent decides each next tool from what it has already observed,
 * streaming its thinking. When it decides it's done, a critic verifies the work;
 * if the critic says "revise", the agent reflects on the feedback and keeps going
 * (once) rather than shipping a weak result. The approved plan is guidance, not a
 * script.
 */
export async function runAgent(
  input: AgentInput,
  plan: AgentPlan,
  emit: (e: AgentEvent) => void
): Promise<void> {
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
  const executed = new Set<string>();
  let stepId = 0;
  let critic: AgentCritic | undefined;
  let reflectionUsed = false;
  let reflectionNote = "";

  for (let iter = 0; iter < MAX_STEPS; iter++) {
    let decision: AgentDecision;
    try {
      decision = await decideNext(input, plan, timeline, reflectionNote);
    } catch (err) {
      emit({ type: "error", message: err instanceof Error ? err.message : "Agent reasoning failed." });
      break;
    }
    if (decision.thought) emit({ type: "thought", text: decision.thought });

    const chosen = TOOL_MAP[decision.action];
    const finishing = decision.action === "finish" || !chosen;

    // Reached a natural stop: verify, and reflect once if the critic is unhappy.
    if (finishing) {
      if (!critic) {
        try {
          critic = await runCritic(input.goal, timeline, ctx.blackboard);
        } catch {
          /* best-effort */
        }
      }
      if (
        critic &&
        !reflectionUsed &&
        /revise/i.test(critic.verdict) &&
        executed.size > 0 &&
        iter < MAX_STEPS - 1
      ) {
        reflectionUsed = true;
        reflectionNote = `${critic.headline} Address: ${critic.issues.join("; ")}`;
        emit({ type: "thought", text: `Reflecting on the critique and improving: ${critic.headline}` });
        continue;
      }
      break;
    }

    // Avoid loops: don't re-run a tool that already succeeded (tailoring may repeat).
    if (executed.has(decision.action) && decision.action !== "tailor_resume") {
      continue;
    }

    const tool = chosen;
    const id = stepId++;
    ctx.stepId = id;
    emit({
      type: "step_start",
      id,
      tool: tool.name,
      label: humanLabel(tool.name),
      requiresApproval: tool.requiresApproval,
    });
    try {
      const result = await tool.run(ctx);
      ctx.blackboard[tool.blackboardKey] = result.data;
      if (result.reasoning) emit({ type: "step_reasoning", id, text: result.reasoning });
      emit({ type: "step_done", id, tool: tool.name, summary: result.summary });
      timeline.push({ tool: tool.name, summary: result.summary });
      executed.add(tool.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Tool failed.";
      emit({ type: "step_error", id, tool: tool.name, error: msg });
      timeline.push({ tool: tool.name, summary: `Failed: ${msg}` });
      executed.add(tool.name);
    }
  }

  // Ensure a critic verdict is always produced and streamed.
  if (!critic) {
    try {
      critic = await runCritic(input.goal, timeline, ctx.blackboard);
    } catch {
      /* best-effort */
    }
  }
  if (critic) emit({ type: "critic", critic });

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

/** Decide the single next action from the goal + everything observed so far. */
async function decideNext(
  input: AgentInput,
  plan: AgentPlan,
  timeline: { tool: string; summary: string }[],
  reflectionNote: string
): Promise<AgentDecision> {
  const done = timeline.length
    ? timeline.map((t, i) => `${i + 1}. ${t.tool}: ${t.summary}`).join("\n")
    : "(nothing yet)";
  const intended = plan.steps.map((s) => s.tool).join(" → ") || "(none)";
  return generateJson<AgentDecision>({
    model: MODELS.PRO_STRATEGY,
    contents: `You are an autonomous AI Career Agent running a reason-act loop. Decide the SINGLE next action that best advances the GOAL for this candidate.

Rules:
- Choose exactly one tool name from the CATALOG, or "finish" when the goal is genuinely satisfied.
- Build on what's already been done; do NOT repeat a completed tool unless clearly necessary.
- Be efficient — don't run tools irrelevant to the goal.

=== GOAL ===
${input.goal || "Assess the candidate and surface their best opportunities."}

=== TOOL CATALOG ===
${toolCatalog()}

=== INTENDED PLAN (user-approved guidance; adapt freely) ===
${intended}

=== ALREADY DONE (observations) ===
${done}${reflectionNote ? `\n\n=== CRITIC FEEDBACK TO ADDRESS BEFORE FINISHING ===\n${reflectionNote}` : ""}`,
    schema: agentDecisionSchema,
    temperature: 0.2,
  });
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
