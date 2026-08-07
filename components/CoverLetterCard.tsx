"use client";

import { Copy, Download, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { downloadTextFile } from "@/lib/export";

interface Props {
  coverLetter: string | null;
  isGenerating: boolean;
  onGenerate: () => void;
}

export function CoverLetterCard({ coverLetter, isGenerating, onGenerate }: Props) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <FileText size={15} className="text-brand-600" /> Cover Letter
        </h3>
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60"
        >
          {isGenerating ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Generating…
            </>
          ) : coverLetter ? (
            "Regenerate"
          ) : (
            "Generate"
          )}
        </button>
      </div>

      {coverLetter && (
        <>
          <textarea
            readOnly
            value={coverLetter}
            className="scroll-thin mt-3 h-56 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(coverLetter);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Copy size={13} /> {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={() => downloadTextFile(coverLetter, "cover-letter.txt")}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Download size={13} /> Download
            </button>
          </div>
        </>
      )}
    </div>
  );
}
