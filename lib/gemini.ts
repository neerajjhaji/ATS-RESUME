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
 * These are real, generally-available Gemini models that support
 * generateContent + JSON responseSchema. If your key/region can't access one,
 * list what you can use and swap the value here (every call site reads this
 * single table):
 *
 *   curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" \
 *     | grep '"name"'
 *
 * See https://ai.google.dev/gemini-api/docs/models for the current lineup.
 */
export const MODELS = {
  /** Fast text parsing / extraction / real-time streaming. */
  FLASH_FAST: "gemini-2.0-flash",
  /** Deep strategic ATS analysis, gap detection, line-by-line rewrites. */
  PRO_STRATEGY: "gemini-2.5-pro",
  /** Auxiliary quick generation: cover letters, summary rewrites, interview prep. */
  FLASH_AUX: "gemini-2.5-flash",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];
