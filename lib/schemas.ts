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
