/**
 * Small resilience helpers: retry-with-backoff for transient failures, and a
 * fetch with a hard timeout. Used to keep Gemini/job-API calls robust against
 * rate limits (429), server blips (5xx), and network hangs.
 */

interface RetryOpts {
  retries?: number;
  baseMs?: number;
  shouldRetry?: (err: unknown) => boolean;
}

function statusOf(err: unknown): number | undefined {
  if (err && typeof err === "object" && "status" in err) {
    const s = (err as { status?: unknown }).status;
    if (typeof s === "number") return s;
  }
  return undefined;
}

/** Default: retry on 429, any 5xx, or unknown (network) errors — not other 4xx. */
export function isTransient(err: unknown): boolean {
  const s = statusOf(err);
  if (s === undefined) return true;
  return s === 429 || s >= 500;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts = {}): Promise<T> {
  const { retries = 2, baseMs = 700, shouldRetry = isTransient } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !shouldRetry(err)) break;
      // Exponential backoff with light jitter (index-based, deterministic-ish).
      const delay = baseMs * 2 ** attempt + attempt * 50;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/** fetch() with an AbortController timeout (default 20s). */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 20000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
