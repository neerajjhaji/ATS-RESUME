"use client";

import { useMemo, useState } from "react";
import { GraduationCap, Loader2, TrendingUp } from "lucide-react";
import type { ApplicationLogEntry, SkillGap, SkillsGapPlan } from "@/types";

/**
 * Skills-gap intelligence: aggregates the dealbreakers the agent recorded across
 * skipped jobs, then turns the most common ones into a prioritized upskilling
 * plan. Rejections → roadmap.
 */
export function SkillsGapPanel({ log }: { log: ApplicationLogEntry[] }) {
  const gaps = useMemo<SkillGap[]>(() => {
    const counts: Record<string, number> = {};
    log.forEach((e) => {
      (e.dealbreakers ?? []).forEach((d) => {
        const key = d.trim();
        if (key) counts[key] = (counts[key] ?? 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count);
  }, [log]);

  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<SkillsGapPlan | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/agent/skills-gap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gaps }),
      });
      const data = (await res.json()) as SkillsGapPlan | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : "Failed.");
      setPlan(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  const priorityCls: Record<string, string> = {
    High: "bg-rose-100 text-rose-700",
    Medium: "bg-amber-100 text-amber-700",
    Low: "bg-slate-200 text-slate-600",
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-slate-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-white">
          <TrendingUp size={13} />
        </span>
        Skills-gap intelligence
      </h2>

      {gaps.length === 0 ? (
        <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-400">
          No gaps recorded yet. As the agent skips jobs, the blocking skills collect here.
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Most common blockers
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {gaps.slice(0, 12).map((g) => (
              <span
                key={g.skill}
                className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700"
              >
                {g.skill}
                <span className="rounded-full bg-rose-200 px-1.5 text-[10px] font-bold">{g.count}</span>
              </span>
            ))}
          </div>

          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:from-brand-700 hover:to-violet-700 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <GraduationCap size={16} />}
            {loading ? "Building plan…" : "Build upskilling plan"}
          </button>

          {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}

          {plan && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-600">{plan.summary}</p>
              <div className="space-y-2">
                {plan.items.map((it) => (
                  <div key={it.skill} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800">{it.skill}</span>
                      <span className="flex items-center gap-2 text-xs">
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${priorityCls[it.priority] ?? priorityCls.Low}`}>
                          {it.priority}
                        </span>
                        <span className="text-slate-400">~{it.weeks}w</span>
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{it.plan}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
