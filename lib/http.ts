import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side request guards for API routes: a simple in-memory per-IP rate
 * limiter (protects the paid AI routes from abuse / runaway cost) and an input
 * clamp to cap payload sizes.
 *
 * Note: the in-memory window is per-instance — fine for a single server or
 * light use. For multi-instance production, back it with Redis/Upstash.
 */

const hits = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/**
 * Returns a 429 response if the caller exceeded `limit` requests within
 * `windowMs`, otherwise null (allowed). Call at the top of a route handler.
 */
export function rateLimit(
  req: NextRequest,
  { limit = 20, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): NextResponse<{ error: string }> | null {
  const key = clientIp(req);
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);

  if (recent.length > limit) {
    return NextResponse.json(
      { error: "Too many requests — please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(windowMs / 1000)) } }
    );
  }
  return null;
}

/** Trim + cap a text input to avoid oversized (costly) prompts. */
export function clampText(v: unknown, max = 24000): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
