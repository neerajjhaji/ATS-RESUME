"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  MapPin,
  Radar,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import {
  downloadResumePdf,
  renderResumeDataToText,
} from "@/lib/export";
import type {
  ApplicationLogEntry,
  ApplyEligibility,
  JobDiscovery,
  Platform,
  SurgicalTailor,
} from "@/types";

const ALL_LOCATIONS = ["Navi Mumbai", "Mumbai", "Remote"];
const LOG_KEY = "agent-audit-log";

function slug(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function searchUrl(platform: Platform, keyword: string, location: string): string {
  const kw = encodeURIComponent(keyword);
  const loc = encodeURIComponent(location);
  if (platform === "linkedin") {
    return `https://www.linkedin.com/jobs/search/?keywords=${kw}&location=${loc}`;
  }
  // Naukri uses slug-style search paths.
  return `https://www.naukri.com/${slug(keyword)}-jobs-in-${slug(location)}`;
}

export function AgentHub({ resumeText }: { resumeText: string }) {
  const hasResume = resumeText.trim().length > 20;

  const [locations, setLocations] = useState<string[]>([...ALL_LOCATIONS]);
  const [discovery, setDiscovery] = useState<JobDiscovery | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [log, setLog] = useState<ApplicationLogEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      if (raw) setLog(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(log));
    } catch {
      /* ignore */
    }
  }, [log]);

  function toggleLocation(loc: string) {
    setLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    );
  }

  async function discover() {
    setError(null);
    setDiscovering(true);
    try {
      const res = await fetch("/api/agent/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, locations }),
      });
      const data = (await res.json()) as JobDiscovery | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : "Failed.");
      setDiscovery(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discovery failed.");
    } finally {
      setDiscovering(false);
    }
  }

  function addLogEntry(entry: ApplicationLogEntry) {
    setLog((prev) => [entry, ...prev]);
  }
  function updateStatus(id: string, status: ApplicationLogEntry["status"]) {
    setLog((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
  }
  function clearLog() {
    setLog([]);
  }

  return (
    <div className="space-y-6">
      {/* ToS / safety notice */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="flex items-start gap-2">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong>Human-in-the-loop by design.</strong> This hub discovers roles, surgically
            tailors your resume, and gates each job on match score — then hands you a review link to
            submit yourself. It does <strong>not</strong> auto-submit or automate your LinkedIn/Naukri
            login, which would violate their terms and risk your account.
          </span>
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!hasResume && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-card">
          Add your resume in the <strong>Tailor</strong> tab first — the agent uses it to discover and
          tailor.
        </div>
      )}

      {/* 1 · Discover */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-slate-900">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-white">
            <Radar size={13} />
          </span>
          1 · Discover jobs
        </h2>

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
                <span
                  className={`h-2 w-2 rounded-full ${on ? "bg-brand-500" : "bg-slate-300"}`}
                />
                {loc}
              </button>
            );
          })}
        </div>

        <button
          onClick={discover}
          disabled={!hasResume || locations.length === 0 || discovering}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:from-brand-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {discovering ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Discovering…
            </>
          ) : (
            <>
              <Radar size={16} /> Discover roles for me
            </>
          )}
        </button>

        {discovery && (
          <div className="mt-5 space-y-4">
            <Chips label="Target titles" items={discovery.target_job_titles} tone="brand" />
            <Chips label="Search keywords" items={discovery.search_keywords} tone="slate" />

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Open searches (you browse &amp; pick)
              </p>
              <div className="space-y-2">
                {discovery.target_job_titles.slice(0, 4).map((title) => (
                  <div key={title} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-slate-700">{title}</span>
                    {(discovery.location_filters ?? locations).map((loc) =>
                      (["naukri", "linkedin"] as Platform[]).map((p) => (
                        <a
                          key={p + loc}
                          href={searchUrl(p, title, loc)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
                        >
                          {p === "linkedin" ? "LinkedIn" : "Naukri"} · {loc}
                          <ExternalLink size={11} />
                        </a>
                      ))
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 2 · Tailor + gate */}
      <TailorAndGate resumeText={resumeText} hasResume={hasResume} onLogged={addLogEntry} />

      {/* 3 · Audit log */}
      <AuditLog log={log} onUpdateStatus={updateStatus} onClear={clearLog} />
    </div>
  );
}

function Chips({ label, items, tone }: { label: string; items: string[]; tone: "brand" | "slate" }) {
  if (!items?.length) return null;
  const cls =
    tone === "brand"
      ? "border-brand-200 bg-brand-50 text-brand-700"
      : "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span key={it} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}>
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

function TailorAndGate({
  resumeText,
  hasResume,
  onLogged,
}: {
  resumeText: string;
  hasResume: boolean;
  onLogged: (e: ApplicationLogEntry) => void;
}) {
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState(ALL_LOCATIONS[0]);
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [jobUrl, setJobUrl] = useState("");
  const [jd, setJd] = useState("");

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SurgicalTailor | null>(null);
  const [eligibility, setEligibility] = useState<ApplyEligibility | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canRun = hasResume && jd.trim().length > 20 && company.trim() && title.trim() && !busy;

  async function run() {
    setErr(null);
    setBusy(true);
    setResult(null);
    setEligibility(null);
    try {
      const tRes = await fetch("/api/agent/tailor-diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalResumeText: resumeText, jobDescription: jd }),
      });
      const tData = (await tRes.json()) as SurgicalTailor | { error: string };
      if (!tRes.ok || "error" in tData) throw new Error("error" in tData ? tData.error : "Failed.");
      setResult(tData);

      const pRes = await fetch("/api/agent/prepare-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobUrl: jobUrl || "about:blank",
          platform,
          ats_match_score: tData.ats_match_score,
          dealbreaker_flags: tData.dealbreaker_flags,
        }),
      });
      const pData = (await pRes.json()) as ApplyEligibility | { error: string };
      if (!pRes.ok || "error" in pData) throw new Error("error" in pData ? pData.error : "Failed.");
      setEligibility(pData);

      onLogged({
        id: `${Date.now()}-${Math.round(tData.ats_match_score)}`,
        company: company.trim(),
        jobTitle: title.trim(),
        location,
        platform,
        atsMatch: tData.ats_match_score,
        status: pData.eligible ? "Ready" : "Skipped",
        reason: pData.reason,
        applyUrl: jobUrl || undefined,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Tailoring failed.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf() {
    if (!result) return;
    await downloadResumePdf(
      renderResumeDataToText(result.tailored_resume_data),
      "classic",
      `tailored-${slug(company || "resume")}.pdf`
    );
  }

  const input =
    "w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-slate-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-white">
          <Wand2 size={13} />
        </span>
        2 · Tailor &amp; check eligibility
      </h2>

      {err && <p className="mb-3 text-sm text-rose-600">{err}</p>}

      <div className="grid grid-cols-2 gap-2">
        <input className={input} placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
        <input className={input} placeholder="Job title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className={input} value={location} onChange={(e) => setLocation(e.target.value)}>
          {ALL_LOCATIONS.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <select className={input} value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
          <option value="linkedin">LinkedIn</option>
          <option value="naukri">Naukri</option>
        </select>
      </div>
      <input
        className={`${input} mt-2`}
        placeholder="Job listing URL (optional — used for the review link)"
        value={jobUrl}
        onChange={(e) => setJobUrl(e.target.value)}
      />
      <textarea
        className={`${input} mt-2 h-32 resize-y`}
        placeholder="Paste the job description…"
        value={jd}
        onChange={(e) => setJd(e.target.value)}
      />

      <button
        onClick={run}
        disabled={!canRun}
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:from-brand-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Tailoring &amp; scoring…
          </>
        ) : (
          <>
            <Wand2 size={16} /> Tailor &amp; check eligibility
          </>
        )}
      </button>

      {result && eligibility && (
        <div className="mt-4 space-y-3">
          <div
            className={`rounded-xl border p-3 ${
              eligibility.eligible
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              {eligibility.eligible ? (
                <CheckCircle2 size={16} className="text-emerald-600" />
              ) : (
                <AlertTriangle size={16} className="text-amber-600" />
              )}
              <span className={eligibility.eligible ? "text-emerald-700" : "text-amber-700"}>
                {result.ats_match_score}% match — {eligibility.eligible ? "Ready to apply" : "Skipped"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">{eligibility.reason}</p>
          </div>

          {result.dealbreaker_flags.length > 0 && (
            <Chips label="Dealbreakers" items={result.dealbreaker_flags} tone="slate" />
          )}
          {result.key_updates_made.length > 0 && (
            <Chips label="Updates made" items={result.key_updates_made} tone="brand" />
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={downloadPdf}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              <Download size={13} /> Download tailored PDF
            </button>
            {eligibility.eligible && jobUrl && (
              <a
                href={jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300"
              >
                <ExternalLink size={13} /> Open apply page &amp; submit
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function AuditLog({
  log,
  onUpdateStatus,
  onClear,
}: {
  log: ApplicationLogEntry[];
  onUpdateStatus: (id: string, status: ApplicationLogEntry["status"]) => void;
  onClear: () => void;
}) {
  const badge: Record<ApplicationLogEntry["status"], string> = {
    Applied: "bg-emerald-100 text-emerald-700",
    Ready: "bg-brand-100 text-brand-700",
    Skipped: "bg-slate-200 text-slate-600",
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-slate-900">Application audit log</h2>
        {log.length > 0 && (
          <button onClick={onClear} className="text-xs font-medium text-slate-400 hover:text-rose-600">
            Clear
          </button>
        )}
      </div>

      {log.length === 0 ? (
        <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-400">
          No applications yet. Tailor a job above to add a row.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-2 py-2">Company</th>
                <th className="px-2 py-2">Job title</th>
                <th className="px-2 py-2">Location</th>
                <th className="px-2 py-2">Platform</th>
                <th className="px-2 py-2 text-right">ATS %</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {log.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="px-2 py-2 font-medium text-slate-700">{e.company}</td>
                  <td className="px-2 py-2 text-slate-600">{e.jobTitle}</td>
                  <td className="px-2 py-2 text-slate-600">{e.location}</td>
                  <td className="px-2 py-2 capitalize text-slate-600">{e.platform}</td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums text-slate-700">
                    {e.atsMatch}
                  </td>
                  <td className="px-2 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge[e.status]}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    {e.status === "Ready" && (
                      <button
                        onClick={() => onUpdateStatus(e.id, "Applied")}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
                      >
                        Mark applied
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
