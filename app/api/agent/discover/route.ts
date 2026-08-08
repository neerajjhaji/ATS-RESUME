import { NextRequest, NextResponse } from "next/server";
import { ai, MODELS, assertGeminiConfigured } from "@/lib/gemini";
import { jobDiscoverySchema } from "@/lib/schemas";
import type { JobDiscovery } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface DiscoverBody {
  resumeText?: string;
  locations?: string[];
}

const DEFAULT_LOCATIONS = ["Navi Mumbai", "Mumbai", "Remote"];

/**
 * AGENT — Job discovery (gemini-2.5-flash / FLASH_AUX)
 *
 * Turns a resume into search keywords + realistic target titles, scoped to the
 * chosen locations, ready to drive Naukri/LinkedIn searches.
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<JobDiscovery | { error: string }>> {
  try {
    assertGeminiConfigured();
    const { resumeText, locations } = (await req.json()) as DiscoverBody;

    if (!resumeText?.trim()) {
      return NextResponse.json({ error: "resumeText is required." }, { status: 400 });
    }

    const locs = locations?.length ? locations : DEFAULT_LOCATIONS;

    const prompt = `You are a job-search strategist. From the RESUME below, produce search terms and target titles optimized for Naukri and LinkedIn in India.

Rules:
- target_job_titles must match the candidate's real seniority and domain — no aspirational stretch beyond one level.
- search_keywords should combine role terms with the candidate's strongest tools/skills.
- location_filters MUST be exactly: ${locs.map((l) => `"${l}"`).join(", ")}.

=== RESUME ===
${resumeText}`;

    const response = await ai.models.generateContent({
      model: MODELS.FLASH_AUX,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: jobDiscoverySchema,
        temperature: 0.4,
      },
    });

    const data = JSON.parse(response.text ?? "{}") as JobDiscovery;
    // Guarantee the requested locations survive even if the model drops them.
    if (!data.location_filters?.length) data.location_filters = locs;

    return NextResponse.json(data);
  } catch (err) {
    console.error("[agent/discover] error:", err);
    const message = err instanceof Error ? err.message : "Discovery failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
