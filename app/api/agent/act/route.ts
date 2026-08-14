import { NextRequest, NextResponse } from "next/server";
import { assertGeminiConfigured } from "@/lib/gemini";
import { rateLimit } from "@/lib/http";
import { planAgent, runAgent, type AgentInput } from "@/lib/agent/loop";
import { humanizeError } from "@/lib/errors";
import type { AgentEvent, AgentPlan } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

interface ActBody extends Partial<AgentInput> {
  mode?: "plan" | "run";
  plan?: AgentPlan;
}

/**
 * CAREER AGENT — the orchestrator endpoint.
 *
 *  mode: "plan"  → returns an ordered tool plan (JSON) for the user to approve.
 *  mode: "run"   → executes an approved plan, streaming a live timeline as SSE
 *                  (`data: <AgentEvent JSON>\n\n` per event) and ending with a
 *                  `final` event carrying the consolidated result.
 *
 * Human checkpoint: the plan is approved by the user before "run" is ever called,
 * and any tool that requires approval is flagged in the plan. Nothing irreversible
 * or outward-facing happens without that approval.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const limited = rateLimit(req);
  if (limited) return limited;

  let body: ActBody;
  try {
    body = (await req.json()) as ActBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const resumeText = body.resumeText?.trim();
  if (!resumeText) {
    return NextResponse.json({ error: "resumeText is required." }, { status: 400 });
  }

  const input: AgentInput = {
    goal: body.goal?.trim() || "",
    resumeText,
    locations: body.locations?.length ? body.locations : ["Navi Mumbai", "Mumbai", "Remote"],
    jobDescription: body.jobDescription,
  };

  // PLAN phase — plain JSON.
  if (body.mode !== "run") {
    try {
      assertGeminiConfigured();
      const plan = await planAgent(input);
      return NextResponse.json({ plan });
    } catch (err) {
      return NextResponse.json({ error: humanizeError(err) }, { status: 500 });
    }
  }

  // RUN phase — SSE stream.
  if (!body.plan?.steps?.length) {
    return NextResponse.json({ error: "An approved plan is required to run." }, { status: 400 });
  }
  const plan = body.plan;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        assertGeminiConfigured();
        emit({ type: "plan", plan });
        await runAgent(input, plan, emit);
      } catch (err) {
        emit({ type: "error", message: humanizeError(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
