"use client";

import { useState } from "react";
import { Banknote, GraduationCap, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { ResumeSource } from "@/components/ResumeSource";
import { ScoreGauge } from "@/components/ScoreGauge";
import { CareerTool } from "@/components/CareerTool";
import { MockInterview } from "@/components/MockInterview";
import type { CareerOverview, JobMatch, SalaryInsight } from "@/types";

/**
 * Career Intelligence — a single dashboard around career growth: standing
 * readiness score, salary insights, a learning path, an interactive mock
 * interview, and profile-matched jobs (the existing CareerTool, embedded).
 */
export function CareerDashboard({
  resumeText,
  setResumeText,
  onTailorToJob,
}: {
  resumeText: string;
  setResumeText: (v: string) => void;
  onTailorToJob: (job: JobMatch) => void;
}) {
  const hasResume = resumeText.trim().length > 20;
  const [overview, setOverview] = useState<CareerOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function analyze() {
    setErr(null);
    setLoading(true);
    setOverview(null);
    try {
      const res = await fetch("/api/career/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText }),
      });
      const data = (await res.json()) as CareerOverview | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : "Failed.");
      setOverview(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Career Intelligence</h2>
        <p className="text-sm text-slate-500">
          Your standing career readiness, salary position, learning path, interview practice, and
          best-fit jobs — all in one place.
        </p>
      </div>

      <ResumeSource resumeText={resumeText} setResumeText={setResumeText} />

      {/* Readiness / salary / learning path */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-white">
              <TrendingUp size={13} />
            </span>
            Career readiness
          </h3>
          <button
            onClick={analyze}
            disabled={!hasResume || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:from-brand-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? "Analyzing…" : overview ? "Re-analyze" : "Analyze my career"}
          </button>
        </div>
        {!hasResume && (
          <p className="mt-2 text-[11px] font-medium text-amber-600">Add your résumé above to enable.</p>
        )}
        {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}

        {overview && (
          <div className="mt-4 space-y-4">
            {/* Readiness */}
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="w-32 shrink-0">
                <ScoreGauge score={overview.profile.career_readiness} />
                <p className="mt-1 text-center text-[10px] font-semibold uppercase text-slate-400">
                  Career readiness
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">{overview.profile.headline}</p>
                <p className="text-xs text-slate-500">
                  {overview.profile.seniority} · {overview.profile.industry} ·{" "}
                  {overview.profile.years_experience}
                </p>
                <p className="mt-1.5 text-sm text-slate-600">{overview.profile.summary}</p>
                {overview.profile.readiness_breakdown.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                    {overview.profile.readiness_breakdown.map((d) => (
                      <div key={d.label} className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{d.label}</span>
                        <span className="font-semibold tabular-nums text-slate-700">{d.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <SalaryCard salary={overview.salary} />

            {/* Learning path */}
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <GraduationCap size={15} className="text-brand-600" /> Learning path
              </p>
              <p className="mt-1 text-sm text-slate-600">{overview.learningPath.summary}</p>
              <div className="mt-2 space-y-1.5">
                {overview.learningPath.items.slice(0, 6).map((it) => (
                  <div key={it.skill} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-700">{it.skill}</span>
                    <span className="flex items-center gap-2 text-xs text-slate-400">
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ${
                          it.priority === "High"
                            ? "bg-rose-100 text-rose-700"
                            : it.priority === "Medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {it.priority}
                      </span>
                      ~{it.weeks}w
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Mock interview */}
      <MockInterview resumeText={resumeText} />

      {/* Job matches (existing tool, embedded) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h3 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-slate-900">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-white">
            <Sparkles size={13} />
          </span>
          Best-fit jobs
        </h3>
        <CareerTool
          resumeText={resumeText}
          setResumeText={setResumeText}
          onTailorToJob={onTailorToJob}
          embedded
        />
      </section>
    </div>
  );
}

function formatMoney(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: /^[A-Z]{3}$/.test(currency) ? currency : "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}

function SalaryCard({ salary }: { salary: SalaryInsight }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <Banknote size={15} className="text-emerald-600" /> Salary insight
      </p>
      <p className="text-xs text-slate-400">{salary.basis}</p>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-2xl font-extrabold tabular-nums text-slate-900">
          {formatMoney(salary.median, salary.currency)}
        </span>
        <span className="pb-1 text-xs text-slate-400">{salary.period}</span>
      </div>
      <p className="text-xs text-slate-500">
        Range {formatMoney(salary.min, salary.currency)} – {formatMoney(salary.max, salary.currency)}
      </p>
      <p className="mt-2 text-sm text-slate-600">{salary.market_position}</p>
      {salary.negotiation_tips.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {salary.negotiation_tips.slice(0, 3).map((t, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-600">
              <span className="text-emerald-500">→</span>
              {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
