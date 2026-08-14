"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MessageSquare, RefreshCw, Send } from "lucide-react";
import type { MockEvaluation, MockInterviewSet } from "@/types";

/**
 * Interactive mock interview. Generates a role-specific question set, then grades
 * one typed answer at a time and shows a model answer — a lightweight coach loop.
 * Stateless server (`/api/career/mock-interview`); the session lives here.
 */
export function MockInterview({ resumeText, role }: { resumeText: string; role?: string }) {
  const hasResume = resumeText.trim().length > 20;

  const [set, setSet] = useState<MockInterviewSet | null>(null);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evalResult, setEvalResult] = useState<MockEvaluation | null>(null);
  const [starting, setStarting] = useState(false);
  const [grading, setGrading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setErr(null);
    setStarting(true);
    setSet(null);
    setEvalResult(null);
    setAnswer("");
    setIdx(0);
    try {
      const res = await fetch("/api/career/mock-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "start", resumeText, role }),
      });
      const data = (await res.json()) as MockInterviewSet | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : "Failed.");
      setSet(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start the interview.");
    } finally {
      setStarting(false);
    }
  }

  async function grade() {
    if (!set) return;
    setErr(null);
    setGrading(true);
    try {
      const res = await fetch("/api/career/mock-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "evaluate",
          resumeText,
          role: set.role,
          question: set.questions[idx].question,
          answer,
        }),
      });
      const data = (await res.json()) as MockEvaluation | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : "Failed.");
      setEvalResult(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not evaluate the answer.");
    } finally {
      setGrading(false);
    }
  }

  function next() {
    setEvalResult(null);
    setAnswer("");
    setIdx((i) => i + 1);
  }

  const q = set?.questions[idx];
  const done = set && idx >= set.questions.length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <h3 className="mb-1 flex items-center gap-2 text-[15px] font-bold text-slate-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-white">
          <MessageSquare size={13} />
        </span>
        Mock interview
      </h3>
      <p className="mb-3 text-sm text-slate-500">
        Practice real questions and get graded answers with a model response.
      </p>

      {!set && (
        <button
          onClick={start}
          disabled={!hasResume || starting}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:from-brand-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {starting ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
          {starting ? "Preparing questions…" : "Start mock interview"}
        </button>
      )}
      {!hasResume && !set && (
        <p className="mt-2 text-[11px] font-medium text-amber-600">Add your résumé above to enable.</p>
      )}

      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}

      {set && q && (
        <div className="mt-2 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Question {idx + 1} of {set.questions.length}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500">
              {q.focus}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-800">{q.question}</p>

          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer…"
            disabled={grading || !!evalResult}
            className="scroll-thin h-28 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
          />

          {!evalResult ? (
            <button
              onClick={grade}
              disabled={grading || answer.trim().length < 10}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {grading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {grading ? "Grading…" : "Submit answer"}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <CheckCircle2 size={15} className="text-emerald-600" /> Score {evalResult.score}/100
                </p>
                {evalResult.strengths.length > 0 && (
                  <FeedbackList label="Strengths" items={evalResult.strengths} tone="good" />
                )}
                {evalResult.improvements.length > 0 && (
                  <FeedbackList label="Improve" items={evalResult.improvements} tone="warn" />
                )}
                <div className="mt-2">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Model answer
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{evalResult.model_answer}</p>
                </div>
              </div>
              {idx + 1 < set.questions.length ? (
                <button
                  onClick={next}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                >
                  Next question →
                </button>
              ) : (
                <button
                  onClick={() => setIdx((i) => i + 1)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Finish
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {done && (
        <div className="mt-2 space-y-3 text-center">
          <p className="text-sm font-semibold text-slate-800">Interview complete 🎉</p>
          <button
            onClick={start}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Run another round
          </button>
        </div>
      )}
    </section>
  );
}

function FeedbackList({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "good" | "warn";
}) {
  return (
    <div className="mt-2">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <ul className="space-y-0.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-600">
            <span className={tone === "good" ? "text-emerald-500" : "text-amber-500"}>
              {tone === "good" ? "✓" : "→"}
            </span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
