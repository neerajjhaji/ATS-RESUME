import type { Platform } from "@/types";

/** Detect the job platform from an apply URL (used for the audit log). */
export function detectPlatform(url: string): Platform {
  const u = (url || "").toLowerCase();
  if (u.includes("linkedin.")) return "linkedin";
  if (u.includes("naukri.")) return "naukri";
  return "other";
}
