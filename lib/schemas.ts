import { Type } from "@google/genai";

/**
 * Gemini structured-output schemas. Passed as `config.responseSchema` so the
 * model is forced to return JSON matching the shape our TypeScript types expect.
 */

export const parseSchema = {
  type: Type.OBJECT,
  properties: {
    full_text: {
      type: Type.STRING,
      description:
        "The complete resume rendered as clean, single-column plain text. Preserve section headers (SUMMARY, EXPERIENCE, SKILLS, EDUCATION), bullet points as '- ', and chronology. Strip page numbers, headers/footers, and layout artifacts.",
    },
  },
  required: ["full_text"],
};

export const atsAuditSchema = {
  type: Type.OBJECT,
  properties: {
    match_score: {
      type: Type.INTEGER,
      description: "Overall ATS match score for the target role, 0 to 100.",
    },
    summary_critique: {
      type: Type.STRING,
      description:
        "2-4 sentence assessment of how well the resume aligns with the target role and the single biggest opportunity.",
    },
    keywords: {
      type: Type.OBJECT,
      properties: {
        matched: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Important JD keywords already present in the resume.",
        },
        missing_hard_skills: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Hard/technical skills in the JD but absent from the resume.",
        },
        missing_tools: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Specific tools, platforms, or technologies missing from the resume.",
        },
        missing_soft_skills: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Soft skills / competencies emphasized in the JD but missing.",
        },
      },
      required: ["matched", "missing_hard_skills", "missing_tools", "missing_soft_skills"],
    },
    actionable_changes: {
      type: Type.ARRAY,
      description:
        "Concrete, high-impact rewrites. Each targets a specific snippet in the resume.",
      items: {
        type: Type.OBJECT,
        properties: {
          section: {
            type: Type.STRING,
            description:
              "Target section, e.g. 'Work Experience - Acme Corp', 'Summary', 'Skills'.",
          },
          current_text: {
            type: Type.STRING,
            description:
              "The EXACT original snippet from the resume that should be replaced. Must be copied verbatim so it can be found and swapped.",
          },
          flaw_reason: {
            type: Type.STRING,
            description:
              "Why it's weak, e.g. 'Missing explicit mention of Kubernetes', 'Lacks quantifiable metrics'.",
          },
          suggested_text: {
            type: Type.STRING,
            description:
              "ATS-optimized rewrite using JD impact verbs and quantified metrics. Keep it truthful and same length range as the original.",
          },
        },
        required: ["section", "current_text", "flaw_reason", "suggested_text"],
      },
    },
  },
  required: ["match_score", "summary_critique", "keywords", "actionable_changes"],
};

export const atsReadinessSchema = {
  type: Type.OBJECT,
  properties: {
    ats_score: {
      type: Type.INTEGER,
      description:
        "Overall ATS-readiness score 0-100, judging the resume ON ITS OWN (formatting, parsability, impact, clarity) with NO target job in mind.",
    },
    verdict: {
      type: Type.STRING,
      description: "2-3 sentence plain-language summary of the resume's general ATS health.",
    },
    breakdown: {
      type: Type.ARRAY,
      description:
        "Score each core dimension: Formatting & Parsability, Quantified Impact, Action Verbs & Clarity, Section Completeness, Keyword Density, Length & Contact Info.",
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          score: { type: Type.INTEGER, description: "0-100 for this dimension." },
          note: { type: Type.STRING, description: "One concise sentence explaining the score." },
        },
        required: ["category", "score", "note"],
      },
    },
    quick_wins: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-6 concrete, general improvements that would raise the score, independent of any role.",
    },
  },
  required: ["ats_score", "verdict", "breakdown", "quick_wins"],
};

export const coverLetterSchema = {
  type: Type.OBJECT,
  properties: {
    cover_letter: {
      type: Type.STRING,
      description:
        "A concise, tailored cover letter (250-350 words) in plain text with paragraph breaks. No placeholders like [Company] — infer from the JD where possible.",
    },
  },
  required: ["cover_letter"],
};

// ---------------------------------------------------------------------------
// Career Intelligence schemas
// ---------------------------------------------------------------------------

/** Market salary estimate for the candidate's target role + location. */
export const salaryInsightSchema = {
  type: Type.OBJECT,
  properties: {
    currency: { type: Type.STRING, description: "ISO-ish currency label, e.g. 'INR', 'USD'." },
    period: { type: Type.STRING, description: "Pay period, e.g. 'per year'." },
    min: { type: Type.INTEGER, description: "Low end of the realistic market range (annual, in the currency)." },
    median: { type: Type.INTEGER, description: "Median / most-likely market figure." },
    max: { type: Type.INTEGER, description: "High end of the realistic market range." },
    basis: { type: Type.STRING, description: "What this is based on, e.g. 'Senior Backend Engineer · Mumbai · 6 yrs'." },
    market_position: {
      type: Type.STRING,
      description: "One sentence on where the candidate likely sits in this range and why.",
    },
    factors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 factors that move the number up or down for this candidate.",
    },
    negotiation_tips: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-4 concrete, honest negotiation tips.",
    },
  },
  required: ["currency", "period", "min", "median", "max", "basis", "market_position", "factors", "negotiation_tips"],
};

/** A generated mock-interview question set. */
export const mockInterviewSchema = {
  type: Type.OBJECT,
  properties: {
    role: { type: Type.STRING, description: "The role these questions target." },
    questions: {
      type: Type.ARRAY,
      description: "5-7 realistic interview questions spanning behavioral, technical, and role-specific.",
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          focus: { type: Type.STRING, description: "What it probes, e.g. 'System design', 'Leadership', 'Go concurrency'." },
        },
        required: ["question", "focus"],
      },
    },
  },
  required: ["role", "questions"],
};

/** Evaluation of one answer the candidate gives during a mock interview. */
export const mockEvaluationSchema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.INTEGER, description: "0-100 quality of the answer for this role." },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "What worked in the answer." },
    improvements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific ways to make it stronger." },
    model_answer: {
      type: Type.STRING,
      description: "A concise, strong model answer grounded in the candidate's real résumé (STAR where relevant).",
    },
  },
  required: ["score", "strengths", "improvements", "model_answer"],
};

// ---------------------------------------------------------------------------
// Career Agent (orchestrator) schemas
// ---------------------------------------------------------------------------

/** Candidate intelligence profile built from the résumé — the agent's memory seed. */
export const candidateProfileSchema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING, description: "One-line professional headline, e.g. 'Senior Backend Engineer · Fintech'." },
    seniority: { type: Type.STRING, description: "Seniority level, e.g. 'Junior', 'Mid', 'Senior', 'Staff', 'Leadership'." },
    industry: { type: Type.STRING, description: "Primary industry / domain." },
    years_experience: { type: Type.STRING, description: "Total professional experience, e.g. '6 years'." },
    skills: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Top 8-15 concrete skills/tools." },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-6 genuine strengths." },
    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-6 honest gaps / areas to improve." },
    career_readiness: { type: Type.INTEGER, description: "Overall career-readiness score 0-100." },
    readiness_breakdown: {
      type: Type.ARRAY,
      description: "Dimensions of readiness, e.g. Resume, ATS, Market Demand, Leadership, Interview.",
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          score: { type: Type.INTEGER, description: "0-100." },
        },
        required: ["label", "score"],
      },
    },
    summary: { type: Type.STRING, description: "2-4 sentence plain-language snapshot of the candidate." },
  },
  required: [
    "headline",
    "seniority",
    "industry",
    "years_experience",
    "skills",
    "strengths",
    "weaknesses",
    "career_readiness",
    "readiness_breakdown",
    "summary",
  ],
};

/** The agent's execution plan: an ordered list of tool steps toward the user's goal. */
export const agentPlanSchema = {
  type: Type.OBJECT,
  properties: {
    goal_understanding: {
      type: Type.STRING,
      description: "1-2 sentences restating what the user wants, in the agent's own words.",
    },
    steps: {
      type: Type.ARRAY,
      description: "Ordered tool steps. Use ONLY tool names from the provided catalog. Keep it minimal — no redundant steps.",
      items: {
        type: Type.OBJECT,
        properties: {
          tool: { type: Type.STRING, description: "Exact tool name from the catalog." },
          why: { type: Type.STRING, description: "One concise sentence: why this step, toward the goal." },
        },
        required: ["tool", "why"],
      },
    },
  },
  required: ["goal_understanding", "steps"],
};

/** Critic verdict over the agent's produced artifacts before they're shown to the user. */
export const agentCriticSchema = {
  type: Type.OBJECT,
  properties: {
    verdict: { type: Type.STRING, description: "'pass', 'pass_with_notes', or 'revise'." },
    confidence: { type: Type.INTEGER, description: "0-100 confidence the results genuinely serve the goal." },
    issues: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Concrete problems found (empty if none)." },
    improvements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Actionable next steps for the candidate." },
    headline: { type: Type.STRING, description: "One-line summary of the outcome for the user." },
  },
  required: ["verdict", "confidence", "issues", "improvements", "headline"],
};

// ---------------------------------------------------------------------------
// Agent system schemas
// ---------------------------------------------------------------------------

/** Job-discovery output: search terms + titles optimized for Naukri/LinkedIn. */
export const jobDiscoverySchema = {
  type: Type.OBJECT,
  properties: {
    search_keywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "8-15 high-signal search keywords/phrases (skills, tools, role terms) to query on Naukri and LinkedIn, ranked by relevance to the resume.",
    },
    location_filters: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'Location filters to apply. Use exactly the user-provided locations, e.g. "Navi Mumbai", "Mumbai", "Remote".',
    },
    target_job_titles: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "5-10 realistic target job titles the candidate is competitive for, based on their resume seniority and skills.",
    },
  },
  required: ["search_keywords", "location_filters", "target_job_titles"],
};

/**
 * Career Tool — batch job-match scoring. Scores every candidate job against the
 * resume in one call, returning a fit score + skill breakdown keyed by job id.
 */
export const recommendMatchesSchema = {
  type: Type.OBJECT,
  properties: {
    matches: {
      type: Type.ARRAY,
      description: "One entry per input job, scored against the resume.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "The exact id of the job being scored (copied from the input).",
          },
          match_score: {
            type: Type.INTEGER,
            description:
              "0-100 fit between the resume and this role, based on genuine skill + experience overlap. Be realistic, not optimistic.",
          },
          matched_skills: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Key skills the role requires that the candidate already demonstrates.",
          },
          missing_skills: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Key skills the role requires that are absent or weak in the resume.",
          },
          experience_required: {
            type: Type.STRING,
            description: 'Experience the role expects, e.g. "3–5 years". Infer from the JD; "Not specified" if unclear.',
          },
          match_reason: {
            type: Type.STRING,
            description: "One concise sentence on why this role fits (or doesn't) the candidate.",
          },
        },
        required: [
          "id",
          "match_score",
          "matched_skills",
          "missing_skills",
          "experience_required",
          "match_reason",
        ],
      },
    },
  },
  required: ["matches"],
};

/**
 * Surgical tailor output. tailored_resume_data preserves the ORIGINAL resume
 * structure exactly — section titles, ordering, date formats, tone — only
 * injecting genuinely-supported JD keywords into existing bullets. Never invents
 * experience.
 */
export const surgicalTailorSchema = {
  type: Type.OBJECT,
  properties: {
    ats_match_score: {
      type: Type.INTEGER,
      description: "Post-tailoring ATS match score for the target job, 0-100.",
    },
    dealbreaker_flags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Hard disqualifiers the resume genuinely cannot satisfy (e.g. 'Requires active security clearance', 'Requires 10+ yrs; candidate has 3'). Empty if none.",
    },
    key_updates_made: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Concise list of the specific surgical edits applied.",
    },
    tailored_resume_data: {
      type: Type.OBJECT,
      description: "The full tailored resume, preserving the original structure exactly.",
      properties: {
        header: {
          type: Type.STRING,
          description: "Name + contact block, unchanged from the original.",
        },
        summary: { type: Type.STRING, description: "Tailored professional summary." },
        skills: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Skills list, with genuinely-supported JD skills surfaced.",
        },
        experience: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              company: { type: Type.STRING },
              title: { type: Type.STRING },
              dates: { type: Type.STRING, description: "Preserve the ORIGINAL date format verbatim." },
              bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["company", "title", "dates", "bullets"],
          },
        },
        education: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              institution: { type: Type.STRING },
              degree: { type: Type.STRING },
              dates: { type: Type.STRING },
            },
            required: ["institution", "degree", "dates"],
          },
        },
      },
      required: ["header", "summary", "skills", "experience", "education"],
    },
  },
  required: ["ats_match_score", "dealbreaker_flags", "key_updates_made", "tailored_resume_data"],
};

/** Upskilling plan derived from recurring dealbreakers across skipped jobs. */
export const skillsGapSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "2-3 sentence summary of the biggest systemic gaps and the payoff of closing them.",
    },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          skill: { type: Type.STRING },
          priority: { type: Type.STRING, description: "High | Medium | Low" },
          weeks: { type: Type.INTEGER, description: "Realistic weeks to reach job-ready proficiency." },
          plan: { type: Type.STRING, description: "A concrete, practical learning plan for this skill." },
        },
        required: ["skill", "priority", "weeks", "plan"],
      },
    },
  },
  required: ["summary", "items"],
};

/** Per-role interview prep pack. */
export const prepPackSchema = {
  type: Type.OBJECT,
  properties: {
    company_brief: {
      type: Type.STRING,
      description: "3-5 sentence brief on the role and what they'll likely care about, inferred from the JD.",
    },
    interview_tips: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "5-7 specific, actionable interview tips tailored to THIS role.",
    },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          star_answer: {
            type: Type.STRING,
            description: "A concise STAR-format answer grounded in the candidate's real resume.",
          },
        },
        required: ["question", "star_answer"],
      },
      description: "6-8 likely interview questions with tailored STAR answers.",
    },
  },
  required: ["company_brief", "interview_tips", "questions"],
};

/** The agent planner's structured plan for a run. */
export const planSchema = {
  type: Type.OBJECT,
  properties: {
    keywords: {
      type: Type.STRING,
      description:
        "A single space-separated search string of the candidate's strongest role terms + tools, for querying job APIs.",
    },
    target_titles: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-6 realistic target job titles the candidate is competitive for.",
    },
    locations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "The locations to search — use exactly the user-provided locations.",
    },
    match_threshold: {
      type: Type.INTEGER,
      description: "Minimum ATS match score (60-90) to consider a job worth applying to. Default 75.",
    },
    max_tailor: {
      type: Type.INTEGER,
      description: "How many top jobs to tailor this run (1-8), balancing coverage vs cost. Default 5.",
    },
    rationale: {
      type: Type.STRING,
      description: "1-2 sentences explaining the strategy for this run.",
    },
  },
  required: ["keywords", "target_titles", "locations", "match_threshold", "max_tailor", "rationale"],
};

/** Auto-drafted answers to recurring screening questions, grounded in the profile + JD. */
export const answerPackSchema = {
  type: Type.OBJECT,
  properties: {
    short_intro: {
      type: Type.STRING,
      description: "A 2-3 sentence 'tell me about yourself' intro tailored to the role. Truthful to the profile.",
    },
    why_this_company: {
      type: Type.STRING,
      description: "3-4 sentence answer to 'Why do you want to work here?', tied to the JD/company.",
    },
    notice_period: {
      type: Type.STRING,
      description: "A concise notice-period answer using the candidate's stated notice period.",
    },
    expected_ctc: {
      type: Type.STRING,
      description: "A concise expected-compensation answer using the candidate's expected CTC.",
    },
    relocation: {
      type: Type.STRING,
      description: "A concise answer about relocation/work-location fit for this role's location.",
    },
  },
  required: ["short_intro", "why_this_company", "notice_period", "expected_ctc", "relocation"],
};
