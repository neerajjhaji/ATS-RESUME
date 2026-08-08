"use client";

import { useState } from "react";
import { Check, Copy, Loader2, MessageSquareText } from "lucide-react";
import type { AnswerPack, MasterProfile } from "@/types";

const LABELS: { key: keyof AnswerPack; label: string }[] = [
  { key: "short_intro", label: "Tell me about yourself" },
  { key: "why_this_company", label: "Why this company?" },
  { key: "notice_period", label: "Notice period" },
  { key: "expected_ctc", label: "Expected CTC" },
  { key: "relocation", label: "Relocation / location" },
];

/**
 * Generates copy-paste-ready answers to recurring screening questions for one
 * job, from the saved profile + JD.
 */
export function AnswerPackButton({
  profile,
  jobDescription,
  company,
  title,
  disabled,
}: {
  profile: MasterProfile;
  jobDescription: string;
  company: string;
  title: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [pack, setPack] = useState<AnswerPack | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/agent/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, jobDescription, company, title }),
      });
      const data = (await res.json()) as AnswerPack | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : "Failed.");
      setPack(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Answer generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function copy(key: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  }

  return (
    <div className="w-full">
      <button
        onClick={generate}
        disabled={disabled || loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <MessageSquareText size={12} />}
        {loading ? "Drafting…" : pack ? "Regenerate answers" : "Answer pack"}
      </button>

      {err && <p className="mt-1 text-xs text-rose-600">{err}</p>}

      {pack && (
        <div className="mt-2 space-y-1.5">
          {LABELS.map(({ key, label }) => (
            <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="mb-0.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {label}
                </span>
                <button
                  onClick={() => copy(key, pack[key])}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-brand-600"
                >
                  {copied === key ? <Check size={11} /> : <Copy size={11} />}
                  {copied === key ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-slate-700">{pack[key]}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
