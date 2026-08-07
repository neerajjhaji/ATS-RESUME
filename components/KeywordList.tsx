"use client";

import { Check, Plus } from "lucide-react";
import type { KeywordBuckets } from "@/types";

interface Props {
  keywords: KeywordBuckets;
  onAddKeyword: (keyword: string) => void;
  addedKeywords: Set<string>;
}

const MISSING_GROUPS: { key: keyof KeywordBuckets; label: string; tone: string }[] = [
  { key: "missing_hard_skills", label: "Missing Hard Skills", tone: "rose" },
  { key: "missing_tools", label: "Missing Tools", tone: "amber" },
  { key: "missing_soft_skills", label: "Missing Soft Skills", tone: "sky" },
];

const toneClasses: Record<string, string> = {
  rose: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  amber: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
  sky: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
};

export function KeywordList({ keywords, onAddKeyword, addedKeywords }: Props) {
  return (
    <div className="space-y-4">
      {keywords.matched?.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Matched ({keywords.matched.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {keywords.matched.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
              >
                <Check size={12} /> {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {MISSING_GROUPS.map(({ key, label, tone }) => {
        const items = keywords[key] ?? [];
        if (items.length === 0) return null;
        return (
          <div key={key}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {label} ({items.length}) — click to add
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {items.map((kw) => {
                const added = addedKeywords.has(kw.toLowerCase());
                return (
                  <button
                    key={kw}
                    type="button"
                    disabled={added}
                    onClick={() => onAddKeyword(kw)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                      added
                        ? "border-slate-200 bg-slate-100 text-slate-400"
                        : toneClasses[tone]
                    }`}
                  >
                    {added ? <Check size={12} /> : <Plus size={12} />} {kw}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
