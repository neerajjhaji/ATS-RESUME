import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Lightweight health check for uptime monitoring. Reports which optional
 * integrations are configured (booleans only — never the secret values).
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    services: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      adzuna: Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
      email: Boolean(process.env.RESEND_API_KEY && process.env.DIGEST_FROM),
    },
  });
}
