"use client";

import { useMemo, useState } from "react";
import { Bot, FileSearch, Gauge, ListChecks, Wand2 } from "lucide-react";
import { BrandFooter, BrandHeader } from "@/components/Brand";
import { AgentHub } from "@/components/AgentHub";
import { InputPanel } from "@/components/InputPanel";
import { ScoreGauge } from "@/components/ScoreGauge";
import { KeywordList } from "@/components/KeywordList";
import { RecommendationsFeed } from "@/components/RecommendationsFeed";
import { ResumeEditor } from "@/components/ResumeEditor";
import { CoverLetterCard } from "@/components/CoverLetterCard";
import { StandaloneScoreCard } from "@/components/StandaloneScoreCard";
import { TemplateGallery } from "@/components/TemplateGallery";
import type { TemplateId } from "@/lib/templates";
import type {
  ActionableChange,
  AtsAudit,
  AtsReadiness,
  ParseResponse,
  ProcessingPhase,
} from "@/types";

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

  // Standalone (no-JD) ATS score
  const [readiness, setReadiness] = useState<AtsReadiness | null>(null);

  // Selected export template
  const [templateId, setTemplateId] = useState<TemplateId>("classic");

  // Active top-level tab
  const [tab, setTab] = useState<"tailor" | "agent">("tailor");

  const analyzeBusy = phase === "parsing" || phase === "analyzing";
  const quickScoreBusy = phase === "scoring";
  const isBusy = analyzeBusy || quickScoreBusy;
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

  async function handleAnalyze() {
    setError(null);
    setAudit(null);
    setCoverLetter(null);
    setAppliedIndexes(new Set());
    setAddedKeywords(new Set());

    let sourceText = resumeText.trim();

    // If the resume text box is empty but we somehow have no parsed text, bail.
    if (!sourceText) {
      setError("Add your resume (upload a file or paste text) before analyzing.");
      return;
    }

    setOriginalResume(sourceText);
    setEditableResume(sourceText);

    try {
      setPhase("analyzing");
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: sourceText, jobDescription, jobTitle }),
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

  async function handleQuickScore() {
    setError(null);
    const sourceText = resumeText.trim();
    if (!sourceText) {
      setError("Add your resume (upload a file or paste text) to score it.");
      return;
    }
    try {
      setPhase("scoring");
      const res = await fetch("/api/ats-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: sourceText }),
      });
      const data = (await res.json()) as AtsReadiness | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Scoring failed.");
      }
      setReadiness(data);
      setPhase("idle");
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Scoring failed.");
    }
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

      {/* Tabs */}
      <div className="mb-6 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-card">
        <button
          onClick={() => setTab("tailor")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === "tailor" ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Wand2 size={15} /> Resume Tailor
        </button>
        <button
          onClick={() => setTab("agent")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === "agent" ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Bot size={15} /> Agent Hub
        </button>
      </div>

      {error && (
        <div className="animate-in mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {tab === "agent" && (
        <div className="animate-in">
          <AgentHub
            resumeText={resumeText}
            setResumeText={setResumeText}
            onGoToTailor={() => setTab("tailor")}
          />
        </div>
      )}

      {tab === "tailor" && (
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
              onQuickScore={handleQuickScore}
              isBusy={isBusy}
              analyzeBusy={analyzeBusy}
              quickScoreBusy={quickScoreBusy}
              phaseLabel={phaseLabel}
              onFile={handleFile}
              fileName={fileName}
              clearFile={clearFile}
            />
          </div>

          {readiness && (
            <StandaloneScoreCard readiness={readiness} onDismiss={() => setReadiness(null)} />
          )}

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
