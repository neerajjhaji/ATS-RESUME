"use client";

import { Lightbulb, X } from "lucide-react";
import { ScoreGauge } from "@/components/ScoreGauge";
import type { AtsReadiness } from "@/types";

function barColor(score: number): string {
  return score >= 75 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";
}

/**
 * Displays the standalone (no job description) ATS readiness result:
 * overall gauge, per-dimension bars, and general quick wins.
 */
export function StandaloneScoreCard({
  readiness,
  onDismiss,
}: {
  readiness: AtsReadiness;
  onDismiss: () => void;
}) {
  return (
    <div className="animate-in rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Standalone ATS Score</h2>
          <p className="text-xs text-slate-400">Resume-only · no job description</p>
        </div>
        <button
          onClick={onDismiss}
          className="rounded p-1 text-slate-400 hover:bg-slate-100"
          aria-label="Dismiss standalone score"
        >
          <X size={15} />
        </button>
      </div>

      <ScoreGauge score={readiness.ats_score} />

      <p className="mt-4 border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-600">
        {readiness.verdict}
      </p>

      {readiness.breakdown?.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {readiness.breakdown.map((b) => (
            <div key={b.category}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600" title={b.note}>
                  {b.category}
                </span>
                <span className="font-semibold tabular-nums" style={{ color: barColor(b.score) }}>
                  {b.score}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${b.score}%`, backgroundColor: barColor(b.score) }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {readiness.quick_wins?.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
            <Lightbulb size={13} /> Quick wins
          </h3>
          <ul className="space-y-1">
            {readiness.quick_wins.map((w, i) => (
              <li key={i} className="flex gap-2 text-sm text-amber-900/90">
                <span className="text-amber-500">•</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
