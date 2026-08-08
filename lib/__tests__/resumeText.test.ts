import { describe, it, expect } from "vitest";
import { renderResumeDataToText } from "@/lib/resumeText";

describe("renderResumeDataToText", () => {
  it("renders sections in order with bullets and headers", () => {
    const text = renderResumeDataToText({
      header: "John Doe\njohn@x.com",
      summary: "Backend engineer.",
      skills: ["Go", "AWS"],
      experience: [
        { company: "Acme", title: "SWE", dates: "2020-Now", bullets: ["Built services.", "Scaled APIs."] },
      ],
      education: [{ institution: "State U", degree: "B.S. CS", dates: "2016-2020" }],
    });
    expect(text).toContain("John Doe");
    expect(text).toContain("SUMMARY");
    expect(text).toContain("SKILLS");
    expect(text).toContain("- Go");
    expect(text).toContain("EXPERIENCE");
    expect(text).toContain("Acme - SWE");
    expect(text).toContain("- Built services.");
    expect(text).toContain("EDUCATION");
    // section order: SUMMARY before SKILLS before EXPERIENCE before EDUCATION
    expect(text.indexOf("SUMMARY")).toBeLessThan(text.indexOf("SKILLS"));
    expect(text.indexOf("SKILLS")).toBeLessThan(text.indexOf("EXPERIENCE"));
    expect(text.indexOf("EXPERIENCE")).toBeLessThan(text.indexOf("EDUCATION"));
  });

  it("omits empty sections", () => {
    const text = renderResumeDataToText({
      header: "Jane",
      summary: "",
      skills: [],
      experience: [],
      education: [],
    });
    expect(text).toBe("Jane");
  });
});
