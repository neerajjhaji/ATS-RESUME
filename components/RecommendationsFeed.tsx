"use client";

import { useState } from "react";
import { ArrowRight, Check, ChevronDown, ChevronUp, Wand2 } from "lucide-react";
import type { ActionableChange } from "@/types";

interface Props {
  changes: ActionableChange[];
  onApply: (change: ActionableChange, index: number) => void;
  appliedIndexes: Set<number>;
}

export function RecommendationsFeed({ changes, onApply, appliedIndexes }: Props) {
  if (!changes?.length) {
    return (
      <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
        No specific rewrites suggested — your resume already aligns well.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {changes.map((change, i) => (
        <RecommendationCard
          key={i}
          change={change}
          applied={appliedIndexes.has(i)}
          onApply={() => onApply(change, i)}
        />
      ))}
    </div>
  );
}

function RecommendationCard({
  change,
  applied,
  onApply,
}: {
  change: ActionableChange;
  applied: boolean;
  onApply: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div
      className={`rounded-xl border p-3.5 transition ${
        applied ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-brand-600">
            {change.section}
          </p>
          <p className="mt-0.5 text-sm font-medium text-slate-700">{change.flaw_reason}</p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2 text-sm">
          <div className="rounded-lg border border-rose-100 bg-rose-50 p-2.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rose-400">
              Current
            </p>
            <p className="text-slate-600 line-through decoration-rose-300/70">
              {change.current_text}
            </p>
          </div>
          <div className="flex justify-center text-slate-300">
            <ArrowRight size={16} className="rotate-90" />
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
              Suggested
            </p>
            <p className="text-slate-800">{change.suggested_text}</p>
          </div>
        </div>
      )}

      <button
        onClick={onApply}
        disabled={applied}
        className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
          applied
            ? "cursor-default bg-emerald-100 text-emerald-700"
            : "bg-brand-600 text-white hover:bg-brand-700"
        }`}
      >
        {applied ? (
          <>
            <Check size={15} /> Applied
          </>
        ) : (
          <>
            <Wand2 size={15} /> Apply Edit
          </>
        )}
      </button>
    </div>
  );
}
