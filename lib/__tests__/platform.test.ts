import { describe, it, expect } from "vitest";
import { detectPlatform } from "@/lib/platform";

describe("detectPlatform", () => {
  it("detects linkedin", () => {
    expect(detectPlatform("https://www.linkedin.com/jobs/view/1")).toBe("linkedin");
  });
  it("detects naukri", () => {
    expect(detectPlatform("https://www.naukri.com/job-2")).toBe("naukri");
  });
  it("falls back to other", () => {
    expect(detectPlatform("https://example.com/careers/3")).toBe("other");
    expect(detectPlatform("")).toBe("other");
  });
});
