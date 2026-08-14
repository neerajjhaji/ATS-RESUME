import { NextRequest, NextResponse } from "next/server";
import { assertGeminiConfigured } from "@/lib/gemini";
import { rateLimit } from "@/lib/http";
import { planAgent, runAgent, type AgentInput } from "@/lib/agent/loop";
import type { AgentEvent, AgentPlan } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Turn raw provider errors into a message a candidate can act on. */
function humanize(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/api key not valid|api_key_invalid|invalid.*key/i.test(raw)) {
    return "The AI engine isn't configured yet — set a valid GEMINI_API_KEY in .env.local and restart the server.";
  }
  if (/quota|rate|429/i.test(raw)) {
    return "The AI engine is rate-limited right now. Please try again in a moment.";
  }
  return raw.length > 200 ? "Something went wrong running the agent. Please try again." : raw;
}

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
      return NextResponse.json({ error: humanize(err) }, { status: 500 });
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
        emit({ type: "error", message: humanize(err) });
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
