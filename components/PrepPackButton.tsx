"use client";

import { useState } from "react";
import { GraduationCap, Lightbulb, Loader2 } from "lucide-react";
import type { PrepPack } from "@/types";

/**
 * Per-role interview prep: a brief, role-specific tips, and likely questions with
 * STAR answers grounded in the resume.
 */
export function PrepPackButton({
  resumeText,
  jobDescription,
  company,
  title,
  disabled,
}: {
  resumeText: string;
  jobDescription: string;
  company: string;
  title: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [pack, setPack] = useState<PrepPack | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/agent/prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, jobDescription, company, title }),
      });
      const data = (await res.json()) as PrepPack | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : "Failed.");
      setPack(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Prep generation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <button
        onClick={generate}
        disabled={disabled || loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <GraduationCap size={12} />}
        {loading ? "Preparing…" : pack ? "Regenerate prep" : "Interview prep"}
      </button>

      {err && <p className="mt-1 text-xs text-rose-600">{err}</p>}

      {pack && (
        <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          {pack.company_brief && <p className="text-xs text-slate-600">{pack.company_brief}</p>}

          {pack.interview_tips?.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                <Lightbulb size={11} /> Tips for this role
              </p>
              <ul className="space-y-0.5">
                {pack.interview_tips.map((t, i) => (
                  <li key={i} className="flex gap-1.5 text-xs text-slate-700">
                    <span className="text-amber-500">•</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pack.questions?.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Likely questions + STAR answers
              </p>
              <div className="space-y-1.5">
                {pack.questions.map((q, i) => (
                  <details key={i} className="rounded border border-slate-200 bg-white p-2">
                    <summary className="cursor-pointer text-xs font-medium text-slate-800">
                      {q.question}
                    </summary>
                    <p className="mt-1 text-xs text-slate-600">{q.star_answer}</p>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
