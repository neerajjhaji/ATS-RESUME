import { NextRequest, NextResponse } from "next/server";
import { ai, MODELS, assertGeminiConfigured } from "@/lib/gemini";
import { parseSchema } from "@/lib/schemas";
import { detectSource, extractText } from "@/lib/fileParser";
import type { ParseResponse } from "@/types";

// pdf-parse / mammoth need the Node runtime (not the edge runtime).
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * PHASE 1 — Extraction (gemini-3.6-flash)
 *
 * Accepts multipart/form-data with a `file` (PDF or DOCX). Extracts raw text
 * locally, then uses the fast flash model to normalize it into clean,
 * single-column, ATS-parsable plain text.
 *
 * If Gemini extraction fails for any reason, we gracefully fall back to the
 * locally-extracted raw text so the user is never blocked.
 */
export async function POST(req: NextRequest): Promise<NextResponse<ParseResponse | { error: string }>> {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided under field 'file'." }, { status: 400 });
    }

    const source = detectSource(file.name, file.type);
    if (!source) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload a .pdf or .docx, or paste your resume as text." },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawText = (await extractText(buffer, source)).trim();

    if (!rawText) {
      return NextResponse.json(
        { error: "Could not read any text from that file. It may be scanned/image-only." },
        { status: 422 }
      );
    }

    // Best-effort cleanup with the flash model. Fall back to raw on any error.
    try {
      assertGeminiConfigured();
      const response = await ai.models.generateContent({
        model: MODELS.FLASH_FAST,
        contents: `Normalize the following extracted resume text into clean, single-column, ATS-parsable plain text. Fix broken line wraps, preserve section headers and bullet points, and remove page numbers / headers / footers. Do NOT invent content.\n\n--- RAW RESUME TEXT ---\n${rawText}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: parseSchema,
          temperature: 0.1,
        },
      });

      const parsed = JSON.parse(response.text ?? "{}") as { full_text?: string };
      const cleaned = (parsed.full_text ?? "").trim();

      if (cleaned) {
        return NextResponse.json({ text: cleaned, structured: true, source });
      }
    } catch (err) {
      console.warn("[parse] flash normalization failed, returning raw text:", err);
    }

    return NextResponse.json({ text: rawText, structured: false, source });
  } catch (err) {
    console.error("[parse] error:", err);
    const message = err instanceof Error ? err.message : "Failed to parse the uploaded file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
