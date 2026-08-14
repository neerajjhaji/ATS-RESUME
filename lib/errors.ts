/**
 * Turn raw provider/runtime errors into a message a candidate can act on.
 * Used across API routes so the UI never shows raw Gemini JSON.
 */
export function humanizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/api key not valid|api_key_invalid|invalid.*api.*key/i.test(raw)) {
    return "The AI engine isn't configured yet — set a valid GEMINI_API_KEY in .env.local and restart the server.";
  }
  if (/quota|rate limit|429|resource.*exhausted/i.test(raw)) {
    return "The AI engine is rate-limited right now. Please try again in a moment.";
  }
  return raw.length > 200 ? "Something went wrong. Please try again." : raw;
}
