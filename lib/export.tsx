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

// Re-exported from a framework-free module so it stays unit-testable.
export { renderResumeDataToText } from "@/lib/resumeText";
