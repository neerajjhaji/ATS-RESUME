"use client";

import { useMemo, useState } from "react";
import { Bot, FileSearch, Gauge, ListChecks, Wand2 } from "lucide-react";
import { BrandFooter, BrandHeader } from "@/components/Brand";
import { CareerTool } from "@/components/CareerTool";
import { AtsChecker } from "@/components/AtsChecker";
import { InputPanel } from "@/components/InputPanel";
import { ScoreGauge } from "@/components/ScoreGauge";
import { KeywordList } from "@/components/KeywordList";
import { RecommendationsFeed } from "@/components/RecommendationsFeed";
import { ResumeEditor } from "@/components/ResumeEditor";
import { CoverLetterCard } from "@/components/CoverLetterCard";
import { TemplateGallery } from "@/components/TemplateGallery";
import type { TemplateId } from "@/lib/templates";
import type { ActionableChange, AtsAudit, JobMatch, ParseResponse, ProcessingPhase } from "@/types";

type Module = "builder" | "checker" | "career";

const PHASE_LABEL: Record<ProcessingPhase, string> = {
  idle: "Analyze & Tailor",
  parsing: "Parsing resume…",
  analyzing: "Analyzing gaps & drafting rewrites…",
  scoring: "Scoring resume…",
  "cover-letter": "Writing cover letter…",
  done: "Analyze & Tailor",
  error: "Analyze & Tailor",
};

export default function Home() {
  // Inputs
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  // Pipeline state
  const [phase, setPhase] = useState<ProcessingPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<AtsAudit | null>(null);

  // Editor state
  const [originalResume, setOriginalResume] = useState("");
  const [editableResume, setEditableResume] = useState("");
  const [appliedIndexes, setAppliedIndexes] = useState<Set<number>>(new Set());
  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(new Set());

  // Cover letter
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [generatingCover, setGeneratingCover] = useState(false);

  // Selected export template
  const [templateId, setTemplateId] = useState<TemplateId>("classic");

  // Active module — the flow starts at the ATS Checker (upload → parse).
  const [module, setModule] = useState<Module>("checker");

  const isBusy = phase === "parsing" || phase === "analyzing";
  const dirty = editableResume !== originalResume;

  async function handleFile(file: File) {
    setPhase("parsing");
    setError(null);
    setFileName(file.name);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/parse", { method: "POST", body: form });
    const data = (await res.json()) as ParseResponse | { error: string };
    setPhase("idle");
    if (!res.ok || "error" in data) {
      const msg = "error" in data ? data.error : "Failed to parse file.";
      setFileName(null);
      throw new Error(msg);
    }
    setResumeText(data.text);
  }

  function clearFile() {
    setFileName(null);
  }

  function handleAnalyze() {
    return analyzeWith(resumeText, jobDescription, jobTitle);
  }

  /** Run the ATS audit with explicit inputs (used by both the builder and job-tailor handoff). */
  async function analyzeWith(resume: string, jd: string, title: string) {
    setError(null);
    setAudit(null);
    setCoverLetter(null);
    setAppliedIndexes(new Set());
    setAddedKeywords(new Set());

    const sourceText = resume.trim();
    if (!sourceText) {
      setError("Add your resume (upload a file or paste text) before analyzing.");
      return;
    }
    if (jd.trim().length < 20) {
      setError("Paste the job description below, then run the analysis.");
      return;
    }

    setOriginalResume(sourceText);
    setEditableResume(sourceText);

    try {
      setPhase("analyzing");
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: sourceText, jobDescription: jd, jobTitle: title }),
      });
      const data = (await res.json()) as AtsAudit | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Analysis failed.");
      }
      setAudit(data);
      setPhase("done");
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Analysis failed.");
    }
  }

  /** Career Tool → Builder handoff: load the selected job and tailor toward it. */
  function tailorToJob(job: JobMatch) {
    setJobTitle(job.title);
    setJobDescription(job.description || job.title);
    setModule("builder");
    void analyzeWith(resumeText, job.description || job.title, job.title);
  }

  function applyChange(change: ActionableChange, index: number) {
    setEditableResume((prev) => {
      if (change.current_text && prev.includes(change.current_text)) {
        return prev.replace(change.current_text, change.suggested_text);
      }
      // Snippet not found verbatim — append it under a clearly marked section.
      return `${prev.trimEnd()}\n\n${change.suggested_text}`;
    });
    setAppliedIndexes((prev) => new Set(prev).add(index));
  }

  function addKeyword(keyword: string) {
    const key = keyword.toLowerCase();
    if (addedKeywords.has(key)) return;

    setEditableResume((prev) => {
      const lines = prev.split("\n");
      const skillsIdx = lines.findIndex((l) => /^\s*(technical\s+)?skills\b/i.test(l.trim()));
      if (skillsIdx !== -1) {
        // Insert the keyword on the line right after the SKILLS header.
        const insertAt = skillsIdx + 1;
        const bullet = `- ${keyword}`;
        lines.splice(insertAt, 0, bullet);
        return lines.join("\n");
      }
      // No skills section — create one at the end.
      return `${prev.trimEnd()}\n\nSKILLS\n- ${keyword}`;
    });
    setAddedKeywords((prev) => new Set(prev).add(key));
  }

  async function generateCoverLetter() {
    setGeneratingCover(true);
    try {
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: editableResume,
          jobDescription,
          jobTitle,
          analysis: audit,
        }),
      });
      const data = (await res.json()) as { cover_letter?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed.");
      setCoverLetter(data.cover_letter ?? "");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Cover letter generation failed.");
    } finally {
      setGeneratingCover(false);
    }
  }

  const hasResult = audit !== null;

  const phaseLabel = useMemo(() => PHASE_LABEL[phase], [phase]);

  return (
    <>
    <main className="mx-auto min-h-screen max-w-[1500px] px-4 py-6 lg:px-8">
      {/* Header */}
      <header className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
        <BrandHeader />
        <span className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-500 shadow-card sm:inline-flex">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Gemini-powered ATS engine
        </span>
      </header>

      {/* Modules */}
      <div className="mb-6 inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-card">
        {(
          [
            { id: "checker", label: "ATS Checker", icon: Gauge },
            { id: "builder", label: "AI Resume Builder", icon: Wand2 },
            { id: "career", label: "Career Tool", icon: Bot },
          ] as { id: Module; label: string; icon: typeof Wand2 }[]
        ).map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => setModule(m.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                module === m.id ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon size={15} /> {m.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="animate-in mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {module === "career" && (
        <div className="animate-in">
          <CareerTool
            resumeText={resumeText}
            setResumeText={setResumeText}
            onTailorToJob={tailorToJob}
          />
        </div>
      )}

      {module === "checker" && (
        <div className="animate-in">
          <AtsChecker
            resumeText={resumeText}
            setResumeText={setResumeText}
            onAnalyse={() => setModule("builder")}
            onTailor={() => setModule("builder")}
          />
        </div>
      )}

      {module === "builder" && (
      <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* LEFT: inputs + audit dashboard */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <InputPanel
              resumeText={resumeText}
              setResumeText={setResumeText}
              jobDescription={jobDescription}
              setJobDescription={setJobDescription}
              jobTitle={jobTitle}
              setJobTitle={setJobTitle}
              onAnalyze={handleAnalyze}
              isBusy={isBusy}
              phaseLabel={phaseLabel}
              onFile={handleFile}
              fileName={fileName}
              clearFile={clearFile}
            />
          </div>

          {audit && (
            <>
              <div className="animate-in rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
                <ScoreGauge score={audit.match_score} />
                <p className="mt-4 border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-600">
                  {audit.summary_critique}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
                <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-slate-900">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-white">
                    <Gauge size={13} />
                  </span>
                  Keyword Gap
                </h2>
                <KeywordList
                  keywords={audit.keywords}
                  onAddKeyword={addKeyword}
                  addedKeywords={addedKeywords}
                />
              </div>

              <CoverLetterCard
                coverLetter={coverLetter}
                isGenerating={generatingCover}
                onGenerate={generateCoverLetter}
              />
            </>
          )}
        </div>

        {/* RIGHT: recommendations + live editor */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Recommendations feed */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-slate-900">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-white">
                <ListChecks size={13} />
              </span>
              Where &amp; What to Change
            </h2>
            {hasResult ? (
              <div className="scroll-thin max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                <RecommendationsFeed
                  changes={audit!.actionable_changes}
                  onApply={applyChange}
                  appliedIndexes={appliedIndexes}
                />
              </div>
            ) : (
              <EmptyState />
            )}
          </div>

          {/* Live editor */}
          <div className="min-h-[400px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
            {hasResult ? (
              <ResumeEditor
                value={editableResume}
                onChange={setEditableResume}
                onReset={() => {
                  setEditableResume(originalResume);
                  setAppliedIndexes(new Set());
                  setAddedKeywords(new Set());
                }}
                dirty={dirty}
                templateId={templateId}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8">
                <EmptyState editor />
              </div>
            )}
          </div>
        </div>
      </div>

      {hasResult && (
        <div className="mt-6">
          <TemplateGallery
            resumeText={editableResume}
            selected={templateId}
            onSelect={setTemplateId}
          />
        </div>
      )}
      </>
      )}
    </main>
    <BrandFooter />
    </>
  );
}

function EmptyState({ editor = false }: { editor?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
      <FileSearch size={32} className="mb-3" />
      <p className="text-sm">
        {editor
          ? "Your tailored resume will appear here, fully editable."
          : "Run an analysis to see targeted, one-click rewrites."}
      </p>
    </div>
  );
}
