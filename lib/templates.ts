/**
 * ATS-safe resume templates. Every template stays strictly single-column with
 * no tables, columns, or graphics that break real ATS parsers — the variation
 * is purely typographic (font, header treatment, spacing, accent). Each maps to
 * a PDF style config consumed by ResumePdfDocument, and to a CSS thumbnail in
 * the template gallery.
 */

export type TemplateId =
  | "classic"
  | "modern"
  | "compact"
  | "professional"
  | "technical"
  | "minimal";

export type HeaderStyle = "underline" | "accent" | "rule" | "smallcaps" | "band" | "plain";

export interface ResumeTemplate {
  id: TemplateId;
  name: string;
  blurb: string;
  /** react-pdf built-in font families (no embedding needed). */
  base: "Helvetica" | "Times-Roman" | "Courier";
  bold: "Helvetica-Bold" | "Times-Bold" | "Courier-Bold";
  accent: string;
  header: HeaderStyle;
  nameAlign: "left" | "center";
  fontSize: number;
  lineHeight: number;
  sectionGap: number;
}

export const TEMPLATES: ResumeTemplate[] = [
  {
    id: "classic",
    name: "Classic",
    blurb: "Timeless, recruiter-friendly. Bold underlined section headers.",
    base: "Helvetica",
    bold: "Helvetica-Bold",
    accent: "#111827",
    header: "underline",
    nameAlign: "left",
    fontSize: 10.5,
    lineHeight: 1.4,
    sectionGap: 12,
  },
  {
    id: "modern",
    name: "Modern",
    blurb: "Indigo accent headers and a prominent name. Crisp and current.",
    base: "Helvetica",
    bold: "Helvetica-Bold",
    accent: "#4f46e5",
    header: "accent",
    nameAlign: "left",
    fontSize: 10.5,
    lineHeight: 1.45,
    sectionGap: 13,
  },
  {
    id: "compact",
    name: "Compact",
    blurb: "Fits more on one page. Tight spacing, thin section rules.",
    base: "Helvetica",
    bold: "Helvetica-Bold",
    accent: "#0f172a",
    header: "rule",
    nameAlign: "left",
    fontSize: 9.5,
    lineHeight: 1.3,
    sectionGap: 9,
  },
  {
    id: "professional",
    name: "Professional",
    blurb: "Serif typeface, centered name, small-caps headers. Executive feel.",
    base: "Times-Roman",
    bold: "Times-Bold",
    accent: "#1f2937",
    header: "smallcaps",
    nameAlign: "center",
    fontSize: 11,
    lineHeight: 1.4,
    sectionGap: 12,
  },
  {
    id: "technical",
    name: "Technical",
    blurb: "Teal accent bar beside each header. Great for engineers.",
    base: "Helvetica",
    bold: "Helvetica-Bold",
    accent: "#0d9488",
    header: "band",
    nameAlign: "left",
    fontSize: 10.5,
    lineHeight: 1.42,
    sectionGap: 12,
  },
  {
    id: "minimal",
    name: "Minimal",
    blurb: "Generous whitespace, letter-spaced plain headers. Understated.",
    base: "Helvetica",
    bold: "Helvetica-Bold",
    accent: "#6b7280",
    header: "plain",
    nameAlign: "left",
    fontSize: 10.5,
    lineHeight: 1.55,
    sectionGap: 14,
  },
];

export function getTemplate(id: TemplateId): ResumeTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
