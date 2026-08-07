import { GoogleGenAI } from "@google/genai";

/**
 * Central Gemini SDK client + model-routing table.
 *
 * The API key is read exclusively from the server-side environment. It is never
 * shipped to the client (no NEXT_PUBLIC_ prefix) and the UI never asks the user
 * to type a key.
 */

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  // Don't throw at import time (that would break `next build`); surface a clear
  // runtime warning instead. Route handlers additionally guard on this.
  console.warn(
    "[gemini] GEMINI_API_KEY is not set. Copy .env.example to .env.local and add your key."
  );
}

export const ai = new GoogleGenAI({ apiKey: apiKey ?? "" });

export function assertGeminiConfigured(): void {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not configured on the server. Add it to .env.local and restart the dev server."
    );
  }
}

/**
 * Task-to-model routing.
 *
 * NOTE: these model IDs come from the project spec. Verify them against the
 * models your API key can access (https://ai.google.dev/gemini-api/docs/models)
 * and adjust here — every call site reads from this single table, so changing a
 * value propagates everywhere.
 */
export const MODELS = {
  /** Fast text parsing / extraction / real-time streaming. */
  FLASH_FAST: "gemini-3.6-flash",
  /** Deep strategic ATS analysis, gap detection, line-by-line rewrites. */
  PRO_STRATEGY: "gemini-3.1-pro",
  /** Auxiliary quick generation: cover letters, summary rewrites, interview prep. */
  FLASH_AUX: "gemini-3.5-flash",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];
