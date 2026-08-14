import type { AgentEvent } from "@/types";

/**
 * Shared execution context passed to every tool. Tools read their inputs from
 * the résumé / goal / blackboard (outputs of earlier tools) rather than having
 * the planner echo large blobs, and write their structured output back onto the
 * blackboard for downstream tools.
 */
export interface ToolContext {
  goal: string;
  resumeText: string;
  locations: string[];
  jobDescription?: string;
  /** Accumulated structured outputs, keyed by semantic name (profile, matches, …). */
  blackboard: Record<string, unknown>;
  /** Stream a progress event to the client (e.g. a reasoning line). */
  emit: (event: AgentEvent) => void;
  /** Index of the current step, for correlating streamed events. */
  stepId: number;
}

export interface ToolResult {
  /** One-line summary for the live timeline. */
  summary: string;
  /** Structured output; also written to the blackboard under `blackboardKey`. */
  data?: unknown;
  /** Optional short reasoning shown under the step. */
  reasoning?: string;
}

export interface AgentTool {
  name: string;
  description: string;
  /** Semantic key this tool writes its `data` under on the blackboard. */
  blackboardKey: string;
  /** Whether the result should trigger a human checkpoint (surfaced in the plan). */
  requiresApproval?: boolean;
  run: (ctx: ToolContext) => Promise<ToolResult>;
}
