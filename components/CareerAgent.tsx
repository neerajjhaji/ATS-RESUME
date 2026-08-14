"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Loader2,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { ScoreGauge } from "@/components/ScoreGauge";
import { LocationSelect } from "@/components/LocationSelect";
import type { AgentEvent, AgentPlan, AgentResult, JobMatch } from "@/types";

type Phase = "idle" | "planning" | "approve" | "running" | "done" | "error";

interface StepView {
  id: number;
  tool: string;
  label: string;
  status: "running" | "done" | "error";
  summary?: string;
  reasoning?: string;
  requiresApproval?: boolean;
}

const SUGGESTIONS = [
  "Assess my career readiness and find my best job matches",
  "Improve my résumé and raise my ATS score",
  "Find remote roles and tailor my résumé to the best one",
  "Prepare me for interviews for my target role",
];

/**
 * The persistent AI Career Agent that sits above the three workspaces. The user
 * states a goal; the agent plans (shown for approval — the human checkpoint),
 * then executes with a live streaming timeline and a critic pass before results.
 */
export function CareerAgent({
  resumeText,
  locations,
  setLocations,
  onNeedResume,
  onTailorToJob,
  onSendToBuilder,
}: {
  resumeText: string;
  locations: string[];
  setLocations: (v: string[]) => void;
  onNeedResume: () => void;
  onTailorToJob: (job: JobMatch) => void;
  onSendToBuilder: (text: string) => void;
}) {
  const hasResume = resumeText.trim().length > 20;

  const [open, setOpen] = useState(true);
  const [goal, setGoal] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [steps, setSteps] = useState<StepView[]>([]);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function reset() {
    setPlan(null);
    setSteps([]);
    setResult(null);
    setError(null);
  }

  async function makePlan() {
    if (!hasResume) {
      onNeedResume();
      return;
    }
    reset();
    setPhase("planning");
    try {
      const res = await fetch("/api/agent/act", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "plan", goal, resumeText, locations }),
      });
      const data = (await res.json()) as { plan?: AgentPlan; error?: string };
      if (!res.ok || data.error || !data.plan) throw new Error(data.error || "Planning failed.");
      setPlan(data.plan);
      setPhase("approve");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Planning failed.");
      setPhase("error");
    }
  }

  function applyEvent(ev: AgentEvent) {
    switch (ev.type) {
      case "step_start":
        setSteps((prev) => [
          ...prev,
          {
            id: ev.id,
            tool: ev.tool,
            label: ev.label,
            status: "running",
            requiresApproval: ev.requiresApproval,
          },
        ]);
        break;
      case "step_reasoning":
        setSteps((prev) => prev.map((s) => (s.id === ev.id ? { ...s, reasoning: ev.text } : s)));
        break;
      case "step_done":
        setSteps((prev) =>
          prev.map((s) => (s.id === ev.id ? { ...s, status: "done", summary: ev.summary } : s))
        );
        break;
      case "step_error":
        setSteps((prev) =>
          prev.map((s) => (s.id === ev.id ? { ...s, status: "error", summary: ev.error } : s))
        );
        break;
      case "final":
        setResult(ev.result);
        setPhase("done");
        break;
      case "error":
        setError(ev.message);
        setPhase("error");
        break;
      default:
        break;
    }
  }

  async function runPlan() {
    if (!plan) return;
    setSteps([]);
    setResult(null);
    setError(null);
    setPhase("running");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/agent/act", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "run", plan, goal, resumeText, locations }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Agent run failed.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.replace(/^data:\s?/, "").trim();
          if (!line) continue;
          try {
            applyEvent(JSON.parse(line) as AgentEvent);
          } catch {
            /* ignore malformed keepalive */
          }
        }
      }
      setPhase((p) => (p === "running" ? "done" : p));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Agent run failed.");
      setPhase("error");
    }
  }

  function stop() {
    abortRef.current?.abort();
    setPhase("done");
  }

  const busy = phase === "planning" || phase === "running";

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-violet-50 shadow-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-3.5"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2.5 text-[15px] font-bold text-slate-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 text-white">
            <Bot size={16} />
          </span>
          AI Career Agent
          <span className="hidden text-xs font-medium text-slate-400 sm:inline">
            · one copilot for your whole job search
          </span>
        </span>
        {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-brand-100 px-5 py-4">
          {/* Goal input */}
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">
            What do you want to achieve today?
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy) void makePlan();
              }}
              placeholder="e.g. Find remote Cloud Architect roles and tailor my résumé to the best one"
              className="flex-1 rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <button
              onClick={() => void makePlan()}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-card transition hover:from-brand-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {phase === "planning" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {phase === "planning" ? "Planning…" : "Run Agent"}
            </button>
          </div>

          <div className="mt-3">
            <LocationSelect value={locations} onChange={setLocations} />
          </div>

          {!hasResume && (
            <p className="mt-2 text-xs font-medium text-amber-600">
              Add your résumé in the ATS Checker first —{" "}
              <button onClick={onNeedResume} className="font-semibold underline">
                go there
              </button>
              .
            </p>
          )}

          {phase === "idle" && hasResume && (
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setGoal(s)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Plan preview — the human checkpoint */}
          {phase === "approve" && plan && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
                <Target size={15} className="text-brand-600" /> The agent&apos;s plan
              </div>
              <p className="mb-3 text-sm text-slate-600">{plan.goal_understanding}</p>
              <ol className="space-y-1.5">
                {plan.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                      {i + 1}
                    </span>
                    <span className="text-slate-700">
                      <span className="font-semibold">{prettyTool(s.tool)}</span>
                      {" — "}
                      {s.why}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => void runPlan()}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:from-brand-700 hover:to-violet-700"
                >
                  <Check size={16} /> Approve &amp; run
                </button>
                <button
                  onClick={() => {
                    reset();
                    setPhase("idle");
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <X size={16} /> Edit goal
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                The agent only reads and drafts — it never applies to jobs, logs in, or submits
                anything. You stay in control.
              </p>
            </div>
          )}

          {/* Live timeline */}
          {(phase === "running" || (phase === "done" && steps.length > 0) || phase === "error") &&
            steps.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">Execution timeline</span>
                  {phase === "running" && (
                    <button
                      onClick={stop}
                      className="text-xs font-medium text-slate-400 hover:text-rose-600"
                    >
                      Stop
                    </button>
                  )}
                </div>
                <ol className="space-y-2.5">
                  {steps.map((s) => (
                    <li key={s.id} className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0">
                        {s.status === "running" && <Loader2 size={16} className="animate-spin text-brand-600" />}
                        {s.status === "done" && <CheckCircle2 size={16} className="text-emerald-600" />}
                        {s.status === "error" && <AlertTriangle size={16} className="text-rose-500" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {s.label}
                          {s.requiresApproval && (
                            <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                              approved
                            </span>
                          )}
                        </p>
                        {s.summary && <p className="text-xs text-slate-500">{s.summary}</p>}
                        {s.reasoning && <p className="mt-0.5 text-xs italic text-slate-400">{s.reasoning}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

          {/* Results */}
          {phase === "done" && result && (
            <AgentResults
              result={result}
              onTailorToJob={onTailorToJob}
              onSendToBuilder={onSendToBuilder}
            />
          )}
        </div>
      )}
    </section>
  );
}

function AgentResults({
  result,
  onTailorToJob,
  onSendToBuilder,
}: {
  result: AgentResult;
  onTailorToJob: (job: JobMatch) => void;
  onSendToBuilder: (text: string) => void;
}) {
  return (
    <div className="mt-4 space-y-4">
      {result.critic && (
        <div
          className={`rounded-xl border p-4 ${
            result.critic.verdict === "revise"
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <CircleDot size={14} className="text-brand-600" /> {result.critic.headline}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Verified · confidence {result.critic.confidence}%
          </p>
          {result.critic.improvements.length > 0 && (
            <ul className="mt-2 space-y-1">
              {result.critic.improvements.slice(0, 4).map((imp, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="text-brand-500">→</span>
                  {imp}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {result.profile && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">{result.profile.headline}</p>
              <p className="text-xs text-slate-500">
                {result.profile.seniority} · {result.profile.industry} · {result.profile.years_experience}
              </p>
              <p className="mt-2 text-sm text-slate-600">{result.profile.summary}</p>
            </div>
            <div className="w-28 shrink-0">
              <ScoreGauge score={result.profile.career_readiness} />
              <p className="mt-1 text-center text-[10px] font-semibold uppercase text-slate-400">
                Career readiness
              </p>
            </div>
          </div>
          {result.profile.readiness_breakdown.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              {result.profile.readiness_breakdown.map((d) => (
                <div key={d.label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{d.label}</span>
                  <span className="font-semibold tabular-nums text-slate-700">{d.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {result.ats && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold text-slate-900">ATS readiness · {result.ats.ats_score}/100</p>
          <p className="mt-1 text-sm text-slate-600">{result.ats.verdict}</p>
        </div>
      )}

      {result.matches && result.matches.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-sm font-bold text-slate-900">
            Top matches ({result.matches.length})
          </p>
          <div className="space-y-2">
            {result.matches.slice(0, 5).map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{m.title}</p>
                  <p className="truncate text-xs text-slate-500">
                    {m.company} · {m.location} · exp {m.experience_required}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
                    {m.match_score}%
                  </span>
                  <button
                    onClick={() => onTailorToJob(m)}
                    className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    Tailor
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.tailored && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold text-slate-900">
            Tailored résumé · {result.tailored.ats_match_score}% match
          </p>
          {result.tailored.key_updates_made.length > 0 && (
            <ul className="mt-2 space-y-1">
              {result.tailored.key_updates_made.slice(0, 4).map((u, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-600">
                  <span className="text-emerald-500">✓</span>
                  {u}
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => onSendToBuilder(tailoredToText(result.tailored!))}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            <Sparkles size={13} /> Open in Resume Builder
          </button>
        </div>
      )}

      {result.interviewPrep && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold text-slate-900">Interview prep</p>
          <p className="mt-1 text-sm text-slate-600">{result.interviewPrep.company_brief}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {result.interviewPrep.questions.length} likely questions with STAR answers
          </p>
        </div>
      )}

      {result.skillGap && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold text-slate-900">Skill gap plan</p>
          <p className="mt-1 text-sm text-slate-600">{result.skillGap.summary}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {result.skillGap.items.slice(0, 8).map((it) => (
              <span
                key={it.skill}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
              >
                {it.skill} · {it.priority}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function prettyTool(tool: string): string {
  return tool
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Flatten a tailored resume payload into plain text for the Builder editor. */
function tailoredToText(t: NonNullable<AgentResult["tailored"]>): string {
  const d = t.tailored_resume_data;
  const lines: string[] = [];
  if (d.header) lines.push(d.header, "");
  if (d.summary) lines.push("SUMMARY", d.summary, "");
  if (d.skills?.length) lines.push("SKILLS", d.skills.map((s) => `- ${s}`).join("\n"), "");
  if (d.experience?.length) {
    lines.push("EXPERIENCE");
    for (const e of d.experience) {
      lines.push(`${e.title} — ${e.company} (${e.dates})`);
      lines.push(...e.bullets.map((b) => `- ${b}`));
      lines.push("");
    }
  }
  if (d.education?.length) {
    lines.push("EDUCATION");
    for (const ed of d.education) lines.push(`${ed.degree} — ${ed.institution} (${ed.dates})`);
  }
  return lines.join("\n").trim();
}
