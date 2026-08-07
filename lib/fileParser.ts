/**
 * Server-only file text extraction for PDF and DOCX resumes.
 * These libraries are Node-only and must never be imported into client code.
 */

export type SupportedSource = "pdf" | "docx";

export function detectSource(filename: string, mimeType?: string): SupportedSource | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") return "pdf";
  if (
    lower.endsWith(".docx") ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  return null;
}

export async function extractText(buffer: Buffer, source: SupportedSource): Promise<string> {
  if (source === "pdf") {
    // Import the implementation module directly. The package's index.js runs a
    // debug harness that reads a bundled test PDF when required at module load
    // in some setups — importing lib/pdf-parse.js avoids that.
    const mod = await import("pdf-parse/lib/pdf-parse.js");
    const pdfParse = (mod.default ?? mod) as (b: Buffer) => Promise<{ text: string }>;
    const data = await pdfParse(buffer);
    return data.text;
  }

  // docx
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
