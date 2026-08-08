"use client";

import type { JobListing } from "@/types";

/**
 * Client-side agent memory (localStorage). Lets the agent dedupe jobs across
 * runs, avoid re-tailoring, and learn which keywords surface the best matches so
 * future planning improves.
 */

export interface SeenRecord {
  key: string;
  title: string;
  company: string;
  score: number;
  status: string;
  ts: number;
}

export interface AgentMemory {
  seen: Record<string, SeenRecord>;
  keywordScores: Record<string, { sum: number; count: number }>;
}

const MEMORY_KEY = "agent-memory";

export const EMPTY_MEMORY: AgentMemory = { seen: {}, keywordScores: {} };

export function loadMemory(): AgentMemory {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return { ...EMPTY_MEMORY };
    const parsed = JSON.parse(raw) as Partial<AgentMemory>;
    return { seen: parsed.seen ?? {}, keywordScores: parsed.keywordScores ?? {} };
  } catch {
    return { ...EMPTY_MEMORY };
  }
}

export function saveMemory(m: AgentMemory): void {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export function jobKey(job: JobListing): string {
  return (job.applyUrl || `${job.title}-${job.company}`).toLowerCase();
}

export function hasSeen(m: AgentMemory, job: JobListing): boolean {
  return Boolean(m.seen[jobKey(job)]);
}

export function recordJob(
  m: AgentMemory,
  job: JobListing,
  score: number,
  status: string
): AgentMemory {
  const key = jobKey(job);
  return {
    ...m,
    seen: {
      ...m.seen,
      [key]: { key, title: job.title, company: job.company, score, status, ts: Date.now() },
    },
  };
}

/** Attribute a run's outcome scores back to its keywords for future planning. */
export function recordKeywordOutcome(m: AgentMemory, keywords: string, score: number): AgentMemory {
  const next = { ...m.keywordScores };
  keywords
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .forEach((t) => {
      const cur = next[t] ?? { sum: 0, count: 0 };
      next[t] = { sum: cur.sum + score, count: cur.count + 1 };
    });
  return { ...m, keywordScores: next };
}

/** Best-performing keywords (highest average match), for planner hints. */
export function topKeywords(m: AgentMemory, limit = 6): string[] {
  return Object.entries(m.keywordScores)
    .map(([k, v]) => ({ k, avg: v.count ? v.sum / v.count : 0 }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, limit)
    .map((x) => x.k);
}

export function memoryStats(m: AgentMemory): { seen: number; applied: number } {
  const seen = Object.keys(m.seen).length;
  const applied = Object.values(m.seen).filter((s) => s.status === "Applied").length;
  return { seen, applied };
}

export function clearMemory(): AgentMemory {
  try {
    localStorage.removeItem(MEMORY_KEY);
  } catch {
    /* ignore */
  }
  return { ...EMPTY_MEMORY };
}
