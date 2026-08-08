"use client";

/**
 * Client-side export helpers. @react-pdf/renderer is imported dynamically so it
 * never gets pulled into the server bundle or the initial client chunk.
 */

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

import type { TemplateId } from "@/lib/templates";

export async function downloadResumePdf(
  text: string,
  templateId: TemplateId = "classic",
  filename = "tailored-resume.pdf"
) {
  const [{ pdf }, { ResumePdfDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/ResumePdfDocument"),
  ]);
  const blob = await pdf(<ResumePdfDocument text={text} templateId={templateId} />).toBlob();
  triggerDownload(blob, filename);
}

export function downloadMarkdown(text: string, filename = "tailored-resume.md") {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  triggerDownload(blob, filename);
}

export function downloadTextFile(text: string, filename: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  triggerDownload(blob, filename);
}

import type { TailoredResumeData } from "@/types";

/**
 * Flatten the structured surgical-tailor output back into the single-column,
 * ATS-parsable plain text the editor + PDF renderer expect. Section order and
 * date formats are preserved as produced by the model.
 */
export function renderResumeDataToText(d: TailoredResumeData): string {
  const out: string[] = [];
  if (d.header) out.push(d.header.trim(), "");
  if (d.summary) out.push("SUMMARY", d.summary.trim(), "");
  if (d.skills?.length) out.push("SKILLS", ...d.skills.map((s) => `- ${s}`), "");
  if (d.experience?.length) {
    out.push("EXPERIENCE");
    d.experience.forEach((e) => {
      out.push(`${e.company} - ${e.title}`.trim());
      if (e.dates) out.push(e.dates);
      (e.bullets ?? []).forEach((b) => out.push(`- ${b}`));
      out.push("");
    });
  }
  if (d.education?.length) {
    out.push("EDUCATION");
    d.education.forEach((e) => {
      out.push([e.degree, e.institution].filter(Boolean).join(" — "));
      if (e.dates) out.push(e.dates);
      out.push("");
    });
  }
  return out.join("\n").trim();
}
