// Shared domain types used across API routes and UI components.

export interface KeywordBuckets {
  matched: string[];
  missing_hard_skills: string[];
  missing_tools: string[];
  missing_soft_skills: string[];
}

export interface ActionableChange {
  /** Target section name, e.g. "Work Experience - Acme Corp", "Summary", "Skills". */
  section: string;
  /** Original text snippet flagged for improvement. */
  current_text: string;
  /** Specific issue, e.g. "Missing explicit mention of Kubernetes". */
  flaw_reason: string;
  /** Tailored, ATS-optimized rewrite. */
  suggested_text: string;
}

export interface AtsAudit {
  match_score: number; // 0 - 100
  summary_critique: string;
  keywords: KeywordBuckets;
  actionable_changes: ActionableChange[];
}

export interface ParseResponse {
  text: string;
  /** Whether the text was cleaned/structured by the flash model or returned raw. */
  structured: boolean;
  source: "pdf" | "docx" | "text";
}

export interface CoverLetterResponse {
  cover_letter: string;
}

/** One scored dimension of the standalone (no-JD) ATS readiness check. */
export interface ReadinessCategory {
  category: string; // e.g. "Formatting & Parsability"
  score: number; // 0 - 100
  note: string; // one-line assessment
}

/** Standalone ATS readiness — scores a resume on its own, without a job description. */
export interface AtsReadiness {
  ats_score: number; // 0 - 100 overall
  verdict: string; // brief plain-language summary
  breakdown: ReadinessCategory[];
  quick_wins: string[]; // top general improvements
}

export interface ApiError {
  error: string;
}

/** Loading phases surfaced in the UI while the pipeline runs. */
export type ProcessingPhase =
  | "idle"
  | "parsing"
  | "analyzing"
  | "scoring"
  | "cover-letter"
  | "done"
  | "error";
