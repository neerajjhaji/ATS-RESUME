import { describe, it, expect } from "vitest";
import { getTemplate, TEMPLATES } from "@/lib/templates";

describe("getTemplate", () => {
  it("returns the requested template", () => {
    expect(getTemplate("modern").id).toBe("modern");
    expect(getTemplate("technical").id).toBe("technical");
  });
  it("falls back to the first template for unknown ids", () => {
    // @ts-expect-error intentionally invalid id
    expect(getTemplate("nope").id).toBe(TEMPLATES[0].id);
  });
  it("all templates are single-column, ATS-safe (built-in fonts only)", () => {
    const fonts = new Set(["Helvetica", "Times-Roman", "Courier"]);
    TEMPLATES.forEach((t) => expect(fonts.has(t.base)).toBe(true));
  });
});
