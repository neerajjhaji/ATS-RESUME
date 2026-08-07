"use client";

import { Download, FileDown, RotateCcw } from "lucide-react";
import { useState } from "react";
import { downloadMarkdown, downloadResumePdf } from "@/lib/export";
import { getTemplate, type TemplateId } from "@/lib/templates";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
  dirty: boolean;
  templateId: TemplateId;
}

export function ResumeEditor({ value, onChange, onReset, dirty, templateId }: Props) {
  const [exporting, setExporting] = useState(false);

  async function handlePdf() {
    setExporting(true);
    try {
      await downloadResumePdf(value, templateId, `tailored-resume-${templateId}.pdf`);
    } catch (e) {
      console.error(e);
      alert("PDF export failed. See console for details.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Live Resume Editor</h3>
          <p className="text-xs text-slate-400">
            {getTemplate(templateId).name} template · ATS-parsable{dirty ? " · unsaved edits" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onReset}
            disabled={!dirty}
            title="Revert to the originally parsed resume"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            <RotateCcw size={13} /> Reset
          </button>
          <button
            onClick={() => downloadMarkdown(value)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <FileDown size={13} /> .md
          </button>
          <button
            onClick={handlePdf}
            disabled={exporting}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            <Download size={13} /> {exporting ? "…" : "PDF"}
          </button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="resume-mono scroll-thin flex-1 resize-none bg-white p-5 text-slate-800 outline-none"
        spellCheck={false}
      />
    </div>
  );
}
