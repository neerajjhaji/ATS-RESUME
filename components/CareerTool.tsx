"use client";

import { useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Radar,
  Sparkles,
} from "lucide-react";
import { ResumeSource } from "@/components/ResumeSource";
import type { JobMatch, JobRecommendations } from "@/types";

const ALL_LOCATIONS = ["Navi Mumbai", "Mumbai", "Remote"];

/**
 * Career Tool — profile-matched job search.
 *
 * Uses the candidate's résumé to surface real, ranked roles, each showing a
 * match score, matched/missing skills, location, and experience required — then
 * lets the user tailor their résumé to any role in one click (hands off to the
 * AI Resume Builder).
 */
export function CareerTool({
  resumeText,
  setResumeText,
  onTailorToJob,
}: {
  resumeText: string;
  setResumeText: (v: string) => void;
  onTailorToJob: (job: JobMatch) => void;
}) {
  const hasResume = resumeText.trim().length > 20;

  const [locations, setLocations] = useState<string[]>([...ALL_LOCATIONS]);
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<JobMatch[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function toggleLocation(loc: string) {
    setLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    );
  }

  async function findMatches() {
    setErr(null);
    setNote(null);
    setLoading(true);
    setMatches(null);
    try {
      const res = await fetch("/api/agent/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, locations }),
      });
      const data = (await res.json()) as JobRecommendations | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Could not find matches.");
      }
      setMatches(data.matches);
      setNote(data.note ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Job matching failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Career Intelligence · Job matches</h2>
        <p className="text-sm text-slate-500">
          Real roles ranked against your résumé — with match score, matching &amp; missing skills,
          location, and experience. Tailor to any role in one click.
        </p>
      </div>

      <ResumeSource resumeText={resumeText} setResumeText={setResumeText} />

      {/* Locations + action */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <MapPin size={12} className="mr-1 inline" /> Target locations
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {ALL_LOCATIONS.map((loc) => {
            const on = locations.includes(loc);
            return (
              <button
                key={loc}
                onClick={() => toggleLocation(loc)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  on
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${on ? "bg-brand-500" : "bg-slate-300"}`} />
                {loc}
              </button>
            );
          })}
        </div>

        <button
          onClick={findMatches}
          disabled={!hasResume || locations.length === 0 || loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-card transition hover:from-brand-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={17} className="animate-spin" /> Finding your best matches…
            </>
          ) : (
            <>
              <Radar size={17} /> Find matching jobs
            </>
          )}
        </button>
        {!hasResume && (
          <p className="mt-2 text-center text-[11px] font-medium text-amber-600">
            Add your résumé above to enable.
          </p>
        )}
      </section>

      {err && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {err}
        </div>
      )}

      {note && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {note}
        </div>
      )}

      {matches && matches.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-500">
            {matches.length} roles ranked by fit
          </p>
          {matches.map((job) => (
            <MatchCard key={job.id} job={job} onTailor={() => onTailorToJob(job)} />
          ))}
        </div>
      )}

      {matches && matches.length === 0 && !note && (
        <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-400">
          No matching roles found. Try adding “Remote” or adjusting your locations.
        </div>
      )}
    </div>
  );
}

function scoreTone(score: number): { ring: string; text: string; label: string } {
  if (score >= 80) return { ring: "border-emerald-400", text: "text-emerald-600", label: "Strong match" };
  if (score >= 60) return { ring: "border-amber-400", text: "text-amber-600", label: "Possible match" };
  return { ring: "border-slate-300", text: "text-slate-500", label: "Stretch" };
}

function MatchCard({ job, onTailor }: { job: JobMatch; onTailor: () => void }) {
  const tone = scoreTone(job.match_score);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-bold text-slate-900">
            <Briefcase size={14} className="shrink-0 text-brand-600" />
            {job.title}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {job.company} · {job.location}
            {job.salary ? ` · ${job.salary}` : ""}
          </p>
        </div>
        {/* Match score dial */}
        <div
          className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-2 ${tone.ring}`}
        >
          <span className={`text-base font-extrabold leading-none tabular-nums ${tone.text}`}>
            {job.match_score}
          </span>
          <span className="text-[9px] font-semibold uppercase text-slate-400">match</span>
        </div>
      </div>

      <p className={`mt-1.5 text-[11px] font-semibold uppercase tracking-wide ${tone.text}`}>
        {tone.label}
        <span className="ml-2 font-medium normal-case tracking-normal text-slate-400">
          Experience: {job.experience_required}
        </span>
      </p>

      {job.match_reason && <p className="mt-2 text-sm text-slate-600">{job.match_reason}</p>}

      {job.matched_skills.length > 0 && (
        <SkillRow label="You have" items={job.matched_skills} tone="matched" />
      )}
      {job.missing_skills.length > 0 && (
        <SkillRow label="Missing" items={job.missing_skills} tone="missing" />
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={onTailor}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
        >
          <Sparkles size={13} /> Tailor résumé to this job
        </button>
        {job.applyUrl && (
          <a
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
          >
            Open listing <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

function SkillRow({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "matched" | "missing";
}) {
  const chip =
    tone === "matched"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  const Icon = tone === "matched" ? CheckCircle2 : null;
  return (
    <div className="mt-2.5">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => (
          <span
            key={s}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${chip}`}
          >
            {Icon && <Icon size={11} />}
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
