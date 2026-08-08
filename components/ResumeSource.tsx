"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, FileText, Loader2, Upload } from "lucide-react";

/**
 * Résumé input embedded in the Agent Hub, so the résumé can be added/updated
 * without switching to the Resume Tailor tab. Uploads go through /api/parse;
 * paste is instant. The value is shared page state, so the whole agent sees it.
 */
export function ResumeSource({
  resumeText,
  setResumeText,
  onGoToTailor,
}: {
  resumeText: string;
  setResumeText: (v: string) => void;
  onGoToTailor?: () => void;
}) {
  const has = resumeText.trim().length > 20;
  const [open, setOpen] = useState(!has);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    setErr(null);
    if (!file) return;
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setErr("Please upload a .pdf or .docx file.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/parse", { method: "POST", body: form });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Could not read that file.");
      setResumeText(data.text ?? "");
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={`rounded-2xl border bg-white p-5 shadow-card ${
        has ? "border-slate-200" : "border-brand-300 ring-1 ring-brand-200"
      }`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-white">
            <FileText size={13} />
          </span>
          Your résumé
          {has ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
              <Check size={13} /> loaded ({resumeText.trim().length} chars)
            </span>
          ) : (
            <span className="text-xs font-medium text-brand-600">— add it to start</span>
          )}
        </span>
        {open ? (
          <ChevronUp size={18} className="text-slate-400" />
        ) : (
          <ChevronDown size={18} className="text-slate-400" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-4 py-5 text-center transition hover:border-brand-400 hover:bg-slate-50"
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            {busy ? (
              <span className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 size={16} className="animate-spin" /> Reading résumé…
              </span>
            ) : (
              <>
                <Upload size={20} className="mb-1.5 text-slate-400" />
                <p className="text-sm text-slate-600">
                  Drop or click to upload <span className="font-semibold">PDF</span> /{" "}
                  <span className="font-semibold">DOCX</span>
                </p>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> or paste{" "}
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste your résumé text here…"
            className="scroll-thin h-32 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />

          {err && <p className="text-xs text-rose-600">{err}</p>}

          {onGoToTailor && (
            <p className="text-xs text-slate-400">
              Prefer the full editor?{" "}
              <button onClick={onGoToTailor} className="font-semibold text-brand-600 hover:underline">
                Open the Resume Tailor tab →
              </button>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
