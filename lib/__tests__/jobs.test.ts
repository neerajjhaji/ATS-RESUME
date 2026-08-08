import { describe, it, expect } from "vitest";
import { dedupeJobs, matchesKeywords, stripHtml } from "@/lib/jobs";
import type { JobListing } from "@/types";

function job(over: Partial<JobListing>): JobListing {
  return {
    id: "x",
    title: "t",
    company: "c",
    location: "l",
    description: "",
    applyUrl: "",
    source: "s",
    ...over,
  };
}

describe("dedupeJobs", () => {
  it("removes duplicate apply URLs (case-insensitive)", () => {
    const list = [
      job({ id: "1", applyUrl: "https://X.com/1" }),
      job({ id: "2", applyUrl: "https://x.com/1" }),
      job({ id: "3", applyUrl: "https://x.com/2" }),
    ];
    expect(dedupeJobs(list)).toHaveLength(2);
  });
  it("falls back to id when no URL", () => {
    const list = [job({ id: "a", applyUrl: "" }), job({ id: "a", applyUrl: "" })];
    expect(dedupeJobs(list)).toHaveLength(1);
  });
});

describe("matchesKeywords", () => {
  it("matches on any term > 2 chars", () => {
    expect(matchesKeywords("Senior Go Engineer", "go kubernetes")).toBe(true);
    expect(matchesKeywords("PHP Developer", "go kubernetes")).toBe(false);
  });
  it("returns true when no meaningful terms", () => {
    expect(matchesKeywords("anything", "a b")).toBe(true);
  });
});

describe("stripHtml", () => {
  it("strips tags and entities and collapses whitespace", () => {
    expect(stripHtml("<p>Hello&nbsp;<b>world</b></p>")).toBe("Hello world");
  });
});
