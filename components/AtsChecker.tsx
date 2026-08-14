"use client";

import { useState } from "react";
import { Gauge, Loader2, Sparkles, Wand2 } from "lucide-react";
import { ResumeSource } from "@/components/ResumeSource";
import { StandaloneScoreCard } from "@/components/StandaloneScoreCard";
import type { AtsReadiness } from "@/types";

/**
 * ATS Resume Checker — the entry point of the flow.
 *
 * Upload / paste a résumé → it's parsed → score it on its own (no job
 * description needed). Once the résumé is successfully in place, the Analyse and
 * Tailor buttons unlock and hand off to the AI Resume Builder for job-specific
 * work.
 */
export function AtsChecker({
  resumeText,
  setResumeText,
  onAnalyse,
  onTailor,
}: {
  resumeText: string;
  setResumeText: (v: string) => void;
  /** Hand off to the Builder to run a job-specific analysis. */
  onAnalyse: () => void;
  /** Hand off to the Builder to tailor toward a job. */
  onTailor: () => void;
}) {
  // A résumé is "ready" (parsed or pasted) once there's real text to work with.
  const ready = resumeText.trim().length > 20;
  const [loading, setLoading] = useState(false);
  const [readiness, setReadiness] = useState<AtsReadiness | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function check() {
    setErr(null);
    setLoading(true);
    setReadiness(null);
    try {
      const res = await fetch("/api/ats-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText }),
      });
      const data = (await res.json()) as AtsReadiness | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : "Failed.");
      setReadiness(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Scoring failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">ATS Resume Checker</h2>
        <p className="text-sm text-slate-500">
          Upload or paste your résumé to parse it, then score its ATS-readiness — no job
          description needed. Analyse &amp; Tailor unlock once it&apos;s parsed.
        </p>
      </div>

      <ResumeSource resumeText={resumeText} setResumeText={setResumeText} />

      <div>
        <button
          onClick={check}
          disabled={!ready || loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-card transition hover:from-brand-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={17} className="animate-spin" /> Scoring résumé…
            </>
          ) : (
            <>
              <Gauge size={17} /> Check ATS Score
            </>
          )}
        </button>
        {!ready && (
          <p className="mt-2 text-center text-[11px] font-medium text-amber-600">
            Add your résumé above to enable.
          </p>
        )}
      </div>

      {err && <p className="text-sm text-rose-600">{err}</p>}

      {readiness && <StandaloneScoreCard readiness={readiness} onDismiss={() => setReadiness(null)} />}

      {/* Next-step handoff — enabled only once the résumé is parsed/loaded. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Next step
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            onClick={onAnalyse}
            disabled={!ready}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles size={16} /> Analyse vs. a job
          </button>
          <button
            onClick={onTailor}
            disabled={!ready}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Wand2 size={16} /> Tailor my résumé
          </button>
        </div>
        {!ready && (
          <p className="mt-2 text-[11px] font-medium text-amber-600">
            Parse your résumé above to unlock Analyse &amp; Tailor.
          </p>
        )}
      </div>
    </div>
  );
}
