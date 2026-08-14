import { MODELS, generateJson } from "@/lib/gemini";
import { fetchAllJobs } from "@/lib/jobs";
import {
  atsReadinessSchema,
  candidateProfileSchema,
  jobDiscoverySchema,
  prepPackSchema,
  recommendMatchesSchema,
  skillsGapSchema,
  surgicalTailorSchema,
} from "@/lib/schemas";
import type {
  AtsReadiness,
  CandidateProfile,
  JobDiscovery,
  JobListing,
  JobMatch,
  PrepPack,
  SkillsGapPlan,
  SurgicalTailor,
} from "@/types";
import type { AgentTool, ToolContext } from "@/lib/agent/types";

/**
 * Central Career-Agent tool registry.
 *
 * Every tool is a thin, typed wrapper over the app's EXISTING logic — the same
 * Gemini wrapper (`generateJson`), the same response schemas (`lib/schemas.ts`),
 * and the same job-fetch layer (`lib/jobs.ts`) the API routes use. Tools read
 * their inputs from the shared context/blackboard and write structured output
 * back, so the loop can chain them without the planner passing large blobs.
 */

const MAX_JOBS = 12;

/** Pick a job description to tailor / prep against: explicit JD → top match → the goal. */
function pickJobDescription(ctx: ToolContext): string {
  if (ctx.jobDescription?.trim()) return ctx.jobDescription;
  const matches = ctx.blackboard.matches as JobMatch[] | undefined;
  if (matches?.length) return matches[0].description || matches[0].title;
  return ctx.goal;
}

/** Ensure live listings exist on the blackboard, fetching them if a prior step didn't. */
async function ensureJobs(ctx: ToolContext): Promise<JobListing[]> {
  const existing = ctx.blackboard.jobs as JobListing[] | undefined;
  if (existing?.length) return existing;
  const terms = ctx.blackboard.terms as JobDiscovery | undefined;
  const what = terms?.search_keywords?.slice(0, 5).join(" ").trim() || ctx.goal || "software engineer";
  const { jobs } = await fetchAllJobs({ what, locations: ctx.locations });
  ctx.blackboard.jobs = jobs;
  return jobs;
}

export const TOOLS: AgentTool[] = [
  {
    name: "build_profile",
    description:
      "Analyze the résumé into a candidate intelligence profile: headline, seniority, industry, skills, strengths, weaknesses, and an overall career-readiness score. Run this first for almost any goal.",
    blackboardKey: "profile",
    run: async (ctx) => {
      const profile = await generateJson<CandidateProfile>({
        model: MODELS.FLASH_AUX,
        contents: `You are a career strategist. Build a rigorous candidate intelligence profile from the RESUME. Be honest about weaknesses. Score career_readiness and its breakdown realistically.

=== RESUME ===
${ctx.resumeText}`,
        schema: candidateProfileSchema,
        temperature: 0.3,
      });
      return {
        summary: `${profile.headline} · readiness ${profile.career_readiness}/100`,
        data: profile,
        reasoning: profile.summary,
      };
    },
  },
  {
    name: "score_ats",
    description:
      "Score the résumé's standalone ATS-readiness (no job description needed): overall score, per-dimension breakdown, and quick wins.",
    blackboardKey: "ats",
    run: async (ctx) => {
      const ats = await generateJson<AtsReadiness>({
        model: MODELS.FLASH_AUX,
        contents: `You are an ATS optimization expert. Score this RESUME on its own (formatting, parsability, impact, clarity). Return the standalone readiness assessment.

=== RESUME ===
${ctx.resumeText}`,
        schema: atsReadinessSchema,
        temperature: 0.3,
      });
      return { summary: `ATS readiness ${ats.ats_score}/100`, data: ats, reasoning: ats.verdict };
    },
  },
  {
    name: "discover_terms",
    description:
      "Derive high-signal job-search keywords and realistic target titles from the résumé, scoped to the target locations.",
    blackboardKey: "terms",
    run: async (ctx) => {
      const terms = await generateJson<JobDiscovery>({
        model: MODELS.FLASH_AUX,
        contents: `You are a job-search strategist. From the RESUME produce search keywords and realistic target titles. location_filters MUST be exactly: ${ctx.locations
          .map((l) => `"${l}"`)
          .join(", ")}.

=== RESUME ===
${ctx.resumeText}`,
        schema: jobDiscoverySchema,
        temperature: 0.4,
      });
      if (!terms.location_filters?.length) terms.location_filters = ctx.locations;
      return {
        summary: `Targeting ${terms.target_job_titles.slice(0, 3).join(", ")}`,
        data: terms,
        reasoning: `Keywords: ${terms.search_keywords.slice(0, 6).join(", ")}`,
      };
    },
  },
  {
    name: "fetch_jobs",
    description:
      "Fetch live job listings from multiple sources (Adzuna + keyless Remote feeds) for the discovered keywords and target locations.",
    blackboardKey: "jobs",
    run: async (ctx) => {
      const jobs = await ensureJobs(ctx);
      return {
        summary: jobs.length ? `${jobs.length} live roles found` : "No live roles for these filters",
        data: jobs,
      };
    },
  },
  {
    name: "match_jobs",
    description:
      "Score every fetched job against the résumé and rank them: match score, matching skills, missing skills, and experience required per role. Recommends the best-fit roles.",
    blackboardKey: "matches",
    run: async (ctx) => {
      const jobs = (await ensureJobs(ctx)).slice(0, MAX_JOBS);
      if (!jobs.length) return { summary: "No jobs to rank", data: [] };

      const jobsForScoring = jobs.map((j) => ({
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        description: (j.description || "").slice(0, 700),
      }));

      const scored = await generateJson<{ matches: ScoredMatch[] }>({
        model: MODELS.FLASH_AUX,
        contents: `You are a senior technical recruiter. Score how well the CANDIDATE RESUME fits each JOB (match by exact "id"). Be realistic — strong fit 80+, stretch <60. Return one entry per job.

=== CANDIDATE RESUME ===
${ctx.resumeText}

=== JOBS (JSON) ===
${JSON.stringify(jobsForScoring)}`,
        schema: recommendMatchesSchema,
        temperature: 0.3,
      });

      const byId = new Map<string, ScoredMatch>();
      for (const m of scored.matches ?? []) byId.set(m.id, m);
      const matches: JobMatch[] = jobs
        .map((job) => {
          const s = byId.get(job.id);
          return {
            ...job,
            match_score: clamp(s?.match_score),
            matched_skills: s?.matched_skills ?? [],
            missing_skills: s?.missing_skills ?? [],
            experience_required: s?.experience_required || "Not specified",
            match_reason: s?.match_reason || "",
          };
        })
        .sort((a, b) => b.match_score - a.match_score);

      ctx.blackboard.matches = matches;
      const top = matches[0];
      return {
        summary: top ? `Top match ${top.match_score}% — ${top.title} @ ${top.company}` : "No matches",
        data: matches,
        reasoning: top?.match_reason,
      };
    },
  },
  {
    name: "tailor_resume",
    description:
      "Surgically rewrite the résumé toward a specific job (the top match or a provided JD), self-critiquing to raise the ATS match score. Never fabricates experience. IRREVERSIBLE to the working résumé — requires approval.",
    blackboardKey: "tailored",
    requiresApproval: true,
    run: async (ctx) => {
      const jd = pickJobDescription(ctx);
      const tailored = await tailorWithCritique(ctx.resumeText, jd);
      return {
        summary: `Tailored résumé · ${tailored.ats_match_score}% match`,
        data: tailored,
        reasoning: tailored.key_updates_made.slice(0, 3).join("; "),
      };
    },
  },
  {
    name: "interview_prep",
    description:
      "Produce a role-specific interview prep pack: company brief, tailored tips, and likely questions with STAR answers grounded in the résumé.",
    blackboardKey: "interviewPrep",
    run: async (ctx) => {
      const jd = pickJobDescription(ctx);
      const prep = await generateJson<PrepPack>({
        model: MODELS.FLASH_AUX,
        contents: `You are an interview coach. Build a prep pack for this candidate and role. Ground STAR answers in the candidate's real résumé.

=== ROLE / JD ===
${jd}

=== RESUME ===
${ctx.resumeText}`,
        schema: prepPackSchema,
        temperature: 0.4,
      });
      return { summary: `${prep.questions.length} likely questions with STAR answers`, data: prep };
    },
  },
  {
    name: "skill_gap",
    description:
      "Identify the highest-leverage skill gaps for the candidate's target roles and produce a prioritized upskilling plan with realistic timelines.",
    blackboardKey: "skillGap",
    run: async (ctx) => {
      const matches = ctx.blackboard.matches as JobMatch[] | undefined;
      const missing = matches?.flatMap((m) => m.missing_skills).slice(0, 20) ?? [];
      const plan = await generateJson<SkillsGapPlan>({
        model: MODELS.FLASH_AUX,
        contents: `You are a career coach. From the RESUME, the GOAL, and any RECURRING MISSING SKILLS, build a prioritized upskilling plan (highest leverage first) with realistic weeks-to-proficiency.

=== GOAL ===
${ctx.goal}

=== RECURRING MISSING SKILLS ===
${missing.join(", ") || "(none captured — infer from goal + résumé)"}

=== RESUME ===
${ctx.resumeText}`,
        schema: skillsGapSchema,
        temperature: 0.4,
      });
      return { summary: `${plan.items.length} skills prioritized`, data: plan, reasoning: plan.summary };
    },
  },
];

export const TOOL_MAP: Record<string, AgentTool> = Object.fromEntries(
  TOOLS.map((t) => [t.name, t])
);

/** Catalog string handed to the planner so it selects only real tool names. */
export function toolCatalog(): string {
  return TOOLS.map(
    (t) => `- ${t.name}${t.requiresApproval ? " (requires approval)" : ""}: ${t.description}`
  ).join("\n");
}

// --- internals -------------------------------------------------------------

interface ScoredMatch {
  id: string;
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  experience_required: string;
  match_reason: string;
}

function clamp(n: unknown): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Compact self-critique tailoring loop (mirrors agent/run's tailorLoop; reuses the schema). */
async function tailorWithCritique(resume: string, jd: string): Promise<SurgicalTailor> {
  let best: SurgicalTailor | null = null;
  let feedback = "";
  for (let i = 0; i < 2; i++) {
    const data = await generateJson<SurgicalTailor>({
      model: MODELS.PRO_STRATEGY,
      contents: `Surgically tailor the résumé to the JD. Preserve structure, tone, and date formats; inject only genuinely-supported skills; never fabricate. Flag unmeetable hard requirements in dealbreaker_flags.${
        feedback ? `\nREVISION FEEDBACK:\n${feedback}` : ""
      }

=== JOB DESCRIPTION ===
${jd}

=== RESUME ===
${resume}`,
      schema: surgicalTailorSchema,
      temperature: 0.25,
    });
    data.ats_match_score = clamp(data.ats_match_score);
    data.dealbreaker_flags = data.dealbreaker_flags ?? [];
    data.key_updates_made = data.key_updates_made ?? [];
    if (!best || data.ats_match_score > best.ats_match_score) best = data;
    if (data.ats_match_score >= 85) break;
    feedback = `Previous attempt scored ${data.ats_match_score}. Surface every genuinely-relevant skill and quantify real impact — no fabrication.`;
  }
  return best as SurgicalTailor;
}
