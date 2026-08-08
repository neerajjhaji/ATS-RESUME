import { describe, it, expect } from "vitest";
import {
  EMPTY_MEMORY,
  hasSeen,
  jobKey,
  recordJob,
  recordKeywordOutcome,
  topKeywords,
  memoryStats,
} from "@/lib/agentMemory";
import type { JobListing } from "@/types";

function job(over: Partial<JobListing> = {}): JobListing {
  return {
    id: "id1",
    title: "Backend Engineer",
    company: "Acme",
    location: "Remote",
    description: "",
    applyUrl: "https://x.com/1",
    source: "test",
    ...over,
  };
}

describe("agentMemory", () => {
  it("dedupes by apply URL after recording", () => {
    const j = job();
    let m = EMPTY_MEMORY;
    expect(hasSeen(m, j)).toBe(false);
    m = recordJob(m, j, 80, "Ready");
    expect(hasSeen(m, j)).toBe(true);
    // same URL, different id -> still seen
    expect(hasSeen(m, job({ id: "id2" }))).toBe(true);
  });

  it("jobKey uses applyUrl then falls back to title-company", () => {
    expect(jobKey(job({ applyUrl: "" }))).toBe("backend engineer-acme");
  });

  it("ranks keywords by average score", () => {
    let m = EMPTY_MEMORY;
    m = recordKeywordOutcome(m, "go kubernetes", 90);
    m = recordKeywordOutcome(m, "php", 40);
    const top = topKeywords(m, 3);
    expect(top[0]).toBe("go");
    expect(top).toContain("kubernetes");
    expect(top.indexOf("php")).toBeGreaterThan(top.indexOf("go"));
  });

  it("counts seen + applied", () => {
    let m = EMPTY_MEMORY;
    m = recordJob(m, job({ applyUrl: "a" }), 80, "Applied");
    m = recordJob(m, job({ applyUrl: "b" }), 60, "Skipped");
    expect(memoryStats(m)).toEqual({ seen: 2, applied: 1 });
  });
});
