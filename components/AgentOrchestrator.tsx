"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Brain,
  Download,
  ExternalLink,
  Loader2,
  Play,
  Trash2,
} from "lucide-react";
import { downloadResumePdf, renderResumeDataToText } from "@/lib/export";
import { AnswerPackButton } from "@/components/AnswerPackButton";
import { PrepPackButton } from "@/components/PrepPackButton";
import {
  clearMemory,
  hasSeen,
  loadMemory,
  memoryStats,
  recordJob,
  recordKeywordOutcome,
  saveMemory,
  topKeywords,
  type AgentMemory,
} from "@/lib/agentMemory";
import type {
  AgentPlan,
  ApplicationLogEntry,
  ApplyEligibility,
  JobListing,
  MasterProfile,
  Platform,
  SurgicalTailor,
} from "@/types";

function detectPlatform(url: string): Platform {
  const u = (url || "").toLowerCase();
  if (u.includes("linkedin.")) return "linkedin";
  if (u.includes("naukri.")) return "naukri";
  return "other";
}

function slug(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

interface QueueItem {
  job: JobListing;
  tailor: SurgicalTailor;
  eligibility: ApplyEligibility;
  platform: Platform;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data?.error) throw new Error(data?.error || `${url} failed`);
  return data as T;
}

/**
 * Autonomous run loop: plan → fetch (multi-source) → dedupe vs memory →
 * self-critique tailor + gate each → rank the Ready queue. Learns across runs
 * via agent memory. Nothing is auto-submitted — you review and click.
 */
export function AgentOrchestrator({
  resumeText,
  locations,
  profile,
  onLogged,
}: {
  resumeText: string;
  locations: string[];
  profile: MasterProfile;
  onLogged: (e: ApplicationLogEntry) => void;
}) {
  const hasResume = resumeText.trim().length > 20;

  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [stats, setStats] = useState({ seen: 0, applied: 0 });

  useEffect(() => {
    setStats(memoryStats(loadMemory()));
  }, []);

  function log(line: string) {
    setSteps((s) => [...s, line]);
  }

  async function run() {
    setRunning(true);
    setErr(null);
    setSteps([]);
    setPlan(null);
    setQueue([]);
    setSkipped(0);

    try {
      let mem: AgentMemory = loadMemory();

      log("Planning the run…");
      const p = await postJson<AgentPlan>("/api/agent/plan", {
        resumeText,
        locations,
        memoryHints: topKeywords(mem),
      });
      setPlan(p);
      log(`Plan → "${p.keywords}" · threshold ${p.match_threshold}% · tailoring up to ${p.max_tailor}`);

      log("Fetching live jobs…");
      const { jobs } = await postJson<{ jobs: JobListing[] }>("/api/agent/jobs", {
        keywords: p.keywords,
        locations: p.locations,
      });
      const fresh = jobs.filter((j) => !hasSeen(mem, j));
      log(`${jobs.length} found · ${jobs.length - fresh.length} already seen · ${fresh.length} new`);

      const toProcess = fresh.slice(0, p.max_tailor);
      if (toProcess.length === 0) log("No new jobs to tailor this run.");

      const ready: QueueItem[] = [];
      let skips = 0;

      for (let i = 0; i < toProcess.length; i++) {
        const job = toProcess[i];
        log(`Tailoring ${i + 1}/${toProcess.length}: ${job.title} @ ${job.company}…`);

        const tailor = await postJson<SurgicalTailor>("/api/agent/tailor-loop", {
          originalResumeText: resumeText,
          jobDescription: job.description || job.title,
          minScore: p.match_threshold,
          maxTries: 3,
        });
        const platform = detectPlatform(job.applyUrl);
        const eligibility = await postJson<ApplyEligibility>("/api/agent/prepare-apply", {
          jobUrl: job.applyUrl || "about:blank",
          platform,
          ats_match_score: tailor.ats_match_score,
          dealbreaker_flags: tailor.dealbreaker_flags,
        });

        mem = recordJob(mem, job, tailor.ats_match_score, eligibility.eligible ? "Ready" : "Skipped");
        mem = recordKeywordOutcome(mem, p.keywords, tailor.ats_match_score);

        onLogged({
          id: `${Date.now()}-${i}`,
          company: job.company,
          jobTitle: job.title,
          location: job.location,
          platform,
          atsMatch: tailor.ats_match_score,
          status: eligibility.eligible ? "Ready" : "Skipped",
          reason: eligibility.reason,
          applyUrl: job.applyUrl,
          dealbreakers: tailor.dealbreaker_flags,
        });

        const trail = tailor.attempts?.map((a) => a.score).join("→");
        log(
          `  ${job.title}: ${tailor.ats_match_score}%${trail ? ` (tries ${trail})` : ""} → ${
            eligibility.eligible ? "Ready" : "Skipped"
          }`
        );

        if (eligibility.eligible) ready.push({ job, tailor, eligibility, platform });
        else skips++;

        ready.sort((a, b) => b.tailor.ats_match_score - a.tailor.ats_match_score);
        setQueue([...ready]);
        setSkipped(skips);
      }

      saveMemory(mem);
      setStats(memoryStats(mem));
      log(`Done — ${ready.length} ready to apply, ${skips} skipped.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Agent run failed.");
    } finally {
      setRunning(false);
    }
  }

  async function downloadPdf(item: QueueItem) {
    await downloadResumePdf(
      renderResumeDataToText(item.tailor.tailored_resume_data),
      "classic",
      `tailored-${slug(item.job.company)}.pdf`
    );
  }

  function resetMemory() {
    clearMemory();
    setStats({ seen: 0, applied: 0 });
  }

  return (
    <section className="rounded-2xl border border-brand-200 bg-gradient-to-b from-brand-50/60 to-white p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-white">
            <Bot size={13} />
          </span>
          Autonomous run
        </h2>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Brain size={13} /> {stats.seen} seen · {stats.applied} applied
          </span>
          {stats.seen > 0 && (
            <button onClick={resetMemory} className="inline-flex items-center gap-1 hover:text-rose-600">
              <Trash2 size={12} /> Reset memory
            </button>
          )}
        </div>
      </div>

      <p className="mb-3 text-xs text-slate-500">
        One click: the agent plans, fetches jobs, skips ones it has seen, tailors each with a
        self-critique loop, gates on match score, and ranks what's ready — learning across runs.
      </p>

      <button
        onClick={run}
        disabled={!hasResume || running}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:from-brand-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
        {running ? "Agent running…" : "Run the agent"}
      </button>

      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}

      {plan?.rationale && (
        <p className="mt-3 rounded-lg border border-brand-100 bg-white p-2.5 text-xs text-slate-600">
          <span className="font-semibold text-brand-700">Strategy:</span> {plan.rationale}
        </p>
      )}

      {steps.length > 0 && (
        <div className="scroll-thin mt-3 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
          {steps.map((s, i) => (
            <div key={i} className={s.startsWith("  ") ? "text-slate-400" : ""}>
              {s}
            </div>
          ))}
        </div>
      )}

      {queue.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Ready to apply — ranked ({queue.length}){skipped ? ` · ${skipped} skipped` : ""}
          </p>
          <div className="space-y-2.5">
            {queue.map((item, i) => (
              <div key={item.job.id} className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      <span className="mr-1 text-slate-400">#{i + 1}</span>
                      {item.job.title}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {item.job.company} · {item.job.location} · {item.platform}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    {item.tailor.ats_match_score}%
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => downloadPdf(item)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    <Download size={12} /> Tailored PDF
                  </button>
                  {item.job.applyUrl && (
                    <a
                      href={item.job.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
                    >
                      Open &amp; submit <ExternalLink size={11} />
                    </a>
                  )}
                </div>
                {item.job.description && (
                  <div className="mt-2 space-y-2">
                    <AnswerPackButton
                      profile={profile}
                      jobDescription={item.job.description}
                      company={item.job.company}
                      title={item.job.title}
                      disabled={!hasResume}
                    />
                    <PrepPackButton
                      resumeText={resumeText}
                      jobDescription={item.job.description}
                      company={item.job.company}
                      title={item.job.title}
                      disabled={!hasResume}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
