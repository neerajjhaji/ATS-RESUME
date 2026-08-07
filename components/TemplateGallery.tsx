"use client";

import { useState } from "react";
import { Check, Download, LayoutTemplate, Loader2 } from "lucide-react";
import { TEMPLATES, type ResumeTemplate, type TemplateId } from "@/lib/templates";
import { downloadResumePdf } from "@/lib/export";

interface Props {
  resumeText: string;
  selected: TemplateId;
  onSelect: (id: TemplateId) => void;
}

/**
 * Gallery of ATS-safe resume templates shown after analysis. Each card renders
 * a small CSS thumbnail reflecting the template's real header/typography style,
 * lets the user pick it as the active template, and can export the current
 * resume directly in that template.
 */
export function TemplateGallery({ resumeText, selected, onSelect }: Props) {
  const [busy, setBusy] = useState<TemplateId | null>(null);

  async function download(id: TemplateId) {
    onSelect(id);
    setBusy(id);
    try {
      await downloadResumePdf(resumeText, id, `resume-${id}.pdf`);
    } catch (e) {
      console.error(e);
      alert("PDF export failed. See console for details.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="animate-in rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-white">
          <LayoutTemplate size={13} />
        </span>
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Convert to a resume template</h2>
          <p className="text-xs text-slate-500">
            Pick a look and export your tailored resume — every template is single-column and ATS-safe.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {TEMPLATES.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            active={selected === t.id}
            busy={busy === t.id}
            onSelect={() => onSelect(t.id)}
            onDownload={() => download(t.id)}
          />
        ))}
      </div>
    </section>
  );
}

function TemplateCard({
  template: t,
  active,
  busy,
  onSelect,
  onDownload,
}: {
  template: ResumeTemplate;
  active: boolean;
  busy: boolean;
  onSelect: () => void;
  onDownload: () => void;
}) {
  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-xl border transition ${
        active
          ? "border-brand-500 ring-2 ring-brand-500/30"
          : "border-slate-200 hover:border-brand-300"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="relative block bg-slate-50 p-2.5 text-left"
        aria-label={`Select ${t.name} template`}
      >
        <Thumbnail t={t} />
        {active && (
          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
            <Check size={12} />
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-1 border-t border-slate-100 p-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800">{t.name}</h3>
        </div>
        <p className="line-clamp-2 min-h-[28px] text-[11px] leading-snug text-slate-400">
          {t.blurb}
        </p>
        <button
          onClick={onDownload}
          disabled={busy}
          className="mt-1 inline-flex items-center justify-center gap-1 rounded-lg bg-brand-600 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          {busy ? "Exporting…" : "PDF"}
        </button>
      </div>
    </div>
  );
}

/** A tiny CSS mock of the page that reflects the template's header treatment. */
function Thumbnail({ t }: { t: ResumeTemplate }) {
  const serif = t.base === "Times-Roman";
  const nameStyle: React.CSSProperties = {
    color: t.accent,
    textAlign: t.nameAlign,
    fontFamily: serif ? "Georgia, serif" : "system-ui, sans-serif",
    fontWeight: 800,
    fontSize: 8,
    letterSpacing: t.header === "smallcaps" ? 0.5 : 0,
  };

  function Header({ label }: { label: string }) {
    if (t.header === "band") {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 5 }}>
          <span style={{ width: 2, height: 6, background: t.accent, display: "inline-block" }} />
          <span style={headerText()}>{label}</span>
        </div>
      );
    }
    const wrap: React.CSSProperties = { marginTop: 5 };
    if (t.header === "underline") wrap.borderBottom = `1px solid ${t.accent}`;
    if (t.header === "rule") wrap.borderTop = "1px solid #cbd5e1";
    return (
      <div style={wrap}>
        <span style={{ ...headerText(), textAlign: t.header === "smallcaps" ? "center" : "left", display: "block" }}>
          {label}
        </span>
      </div>
    );
  }

  function headerText(): React.CSSProperties {
    return {
      fontSize: 5.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: t.header === "plain" || t.header === "smallcaps" ? 1 : 0.3,
      color: t.header === "accent" || t.header === "band" ? t.accent : "#334155",
      fontFamily: serif ? "Georgia, serif" : "system-ui, sans-serif",
    };
  }

  const bar = (w: string) => (
    <span style={{ display: "block", height: 2, width: w, background: "#e2e8f0", borderRadius: 2, marginTop: 2.5 }} />
  );

  return (
    <div
      className="mx-auto rounded-sm bg-white shadow-sm ring-1 ring-slate-200"
      style={{ width: "100%", aspectRatio: "3 / 4", padding: 7, overflow: "hidden" }}
    >
      <div style={nameStyle}>Alex Morgan</div>
      {bar(t.nameAlign === "center" ? "70%" : "45%")}
      <Header label="Experience" />
      {bar("92%")}
      {bar("85%")}
      {bar("60%")}
      <Header label="Skills" />
      {bar("80%")}
      {bar("50%")}
    </div>
  );
}
