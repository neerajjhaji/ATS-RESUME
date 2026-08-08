import type { TailoredResumeData } from "@/types";

/**
 * Flatten the structured surgical-tailor output back into the single-column,
 * ATS-parsable plain text the editor + PDF renderer expect. Section order and
 * date formats are preserved as produced by the model. Pure + framework-free so
 * it's trivially unit-testable.
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
