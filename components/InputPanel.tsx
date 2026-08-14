"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Sparkles, Upload, X } from "lucide-react";

interface Props {
  resumeText: string;
  setResumeText: (v: string) => void;
  jobDescription: string;
  setJobDescription: (v: string) => void;
  jobTitle: string;
  setJobTitle: (v: string) => void;
  onAnalyze: () => void;
  /** True while a request is in flight (disables actions). */
  isBusy: boolean;
  phaseLabel: string;
  /** Uploads a file, returns extracted text (parent handles the API call). */
  onFile: (file: File) => Promise<void>;
  fileName: string | null;
  clearFile: () => void;
}

export function InputPanel(props: Props) {
  const {
    resumeText,
    setResumeText,
    jobDescription,
    setJobDescription,
    jobTitle,
    setJobTitle,
    onAnalyze,
    isBusy,
    phaseLabel,
    onFile,
    fileName,
    clearFile,
  } = props;

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    setUploadError(null);
    const file = files?.[0];
    if (!file) return;
    const ok = /\.(pdf|docx)$/i.test(file.name);
    if (!ok) {
      setUploadError("Please upload a .pdf or .docx file.");
      return;
    }
    try {
      await onFile(file);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed.");
    }
  }

  const hasResume = resumeText.trim().length > 20;
  const hasJd = jobDescription.trim().length > 20;
  const canAnalyze = hasResume && hasJd && !isBusy;

  // Human-readable reason the Analyze button is disabled, so it never looks broken.
  const missing: string[] = [];
  if (!hasResume) missing.push("your resume");
  if (!hasJd) missing.push("a job description");
  const analyzeHint = missing.length ? `Add ${missing.join(" and ")} to enable` : "";

  return (
    <div className="space-y-5">
      {/* Resume dropzone */}
      <section>
        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Your Resume</label>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
            dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-brand-400 hover:bg-slate-50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          {fileName ? (
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <FileText size={16} className="text-brand-600" />
              {fileName}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-200"
                aria-label="Remove file"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <Upload size={22} className="mb-1.5 text-slate-400" />
              <p className="text-sm text-slate-600">
                Drop your <span className="font-semibold">PDF</span> or{" "}
                <span className="font-semibold">DOCX</span>, or click to browse
              </p>
            </>
          )}
        </div>
        {uploadError && <p className="mt-1.5 text-xs text-rose-600">{uploadError}</p>}

        <div className="my-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
          <span className="h-px flex-1 bg-slate-200" /> or paste text{" "}
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <textarea
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          placeholder="Paste your existing resume text here…"
          className="scroll-thin h-40 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </section>

      {/* Target job title */}
      <section>
        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Target Job Title</label>
        <input
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder="e.g. Senior Backend Engineer"
          className="w-full rounded-xl border border-slate-300 p-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </section>

      {/* Job description */}
      <section>
        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Job Description</label>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the full job description…"
          className="scroll-thin h-44 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </section>

      <div className="space-y-2">
        <button
          onClick={onAnalyze}
          disabled={!canAnalyze}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-card transition hover:from-brand-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy ? (
            <>
              <Loader2 size={17} className="animate-spin" /> {phaseLabel}
            </>
          ) : (
            <>
              <Sparkles size={17} /> Analyze &amp; Tailor
            </>
          )}
        </button>
        {!canAnalyze && !isBusy && analyzeHint && (
          <p className="text-center text-[11px] font-medium text-amber-600">{analyzeHint}</p>
        )}
      </div>
    </div>
  );
}
