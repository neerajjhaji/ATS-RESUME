"use client";

import { useState } from "react";
import { CalendarClock, Loader2, Mail } from "lucide-react";
import type { MasterProfile } from "@/types";

/**
 * On-demand digest sender + docs for scheduling. Emails the current keyword/
 * location matches via the /api/agent/digest route (Resend). The daily automation
 * is a cron (GitHub Actions / Vercel) hitting the same route — see README.
 */
export function DigestPanel({
  profile,
  keywords,
  locations,
}: {
  profile: MasterProfile;
  keywords: string;
  locations: string[];
}) {
  const [to, setTo] = useState(profile.email || "");
  const [kw, setKw] = useState(keywords);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function sendNow() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/agent/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: kw, locations, to }),
      });
      const data = (await res.json()) as { sent?: boolean; count?: number; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Failed.");
      setMsg(`Sent a digest of ${data.count} job(s) to ${to}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Digest failed.");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-slate-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-white">
          <CalendarClock size={13} />
        </span>
        Daily digest
      </h2>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className={input} placeholder="Send to (email)" value={to} onChange={(e) => setTo(e.target.value)} />
        <input className={input} placeholder="Keywords" value={kw} onChange={(e) => setKw(e.target.value)} />
      </div>

      <button
        onClick={sendNow}
        disabled={busy || !to.trim()}
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:from-brand-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
        {busy ? "Sending…" : "Email me these jobs now"}
      </button>

      {msg && <p className="mt-2 text-sm text-emerald-600">{msg}</p>}
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}

      <p className="mt-3 text-[11px] text-slate-400">
        Needs RESEND_API_KEY + DIGEST_FROM in <code>.env.local</code>. For a hands-off daily run,
        schedule the <code>/api/agent/digest</code> route with the included GitHub Actions workflow
        (see README).
      </p>
    </section>
  );
}
