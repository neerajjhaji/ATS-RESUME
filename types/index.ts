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

// ---------------------------------------------------------------------------
// Agent system types
// ---------------------------------------------------------------------------

export interface JobDiscovery {
  search_keywords: string[];
  location_filters: string[];
  target_job_titles: string[];
}

export interface TailoredExperience {
  company: string;
  title: string;
  dates: string;
  bullets: string[];
}

export interface TailoredEducation {
  institution: string;
  degree: string;
  dates: string;
}

export interface TailoredResumeData {
  header: string;
  summary: string;
  skills: string[];
  experience: TailoredExperience[];
  education: TailoredEducation[];
}

export interface TailorAttempt {
  try: number;
  score: number;
}

export interface SurgicalTailor {
  ats_match_score: number;
  dealbreaker_flags: string[];
  key_updates_made: string[];
  tailored_resume_data: TailoredResumeData;
  /** Present when produced by the self-critique loop: score per attempt. */
  attempts?: TailorAttempt[];
}

/** The agent's execution plan, produced by the LLM planner. */
export interface AgentPlan {
  keywords: string;
  target_titles: string[];
  locations: string[];
  match_threshold: number;
  max_tailor: number;
  rationale: string;
}

export type Platform = "naukri" | "linkedin" | "other";

/** A normalized job listing from a job-search API (Adzuna / RemoteOK / Arbeitnow). */
export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  applyUrl: string;
  created?: string;
  salary?: string;
  source: string;
}

/**
 * A job listing enriched with AI match intelligence, for the Career Tool.
 * Extends the raw listing with a profile-based match score and skill breakdown.
 */
export interface JobMatch extends JobListing {
  /** 0-100 fit between the candidate's resume and this role. */
  match_score: number;
  /** Skills the JD calls for that the candidate already has. */
  matched_skills: string[];
  /** Skills the JD calls for that are missing / weak in the resume. */
  missing_skills: string[];
  /** Experience the role expects, e.g. "3–5 years". */
  experience_required: string;
  /** One-line why-this-fits rationale. */
  match_reason: string;
}

/** Career Tool response: ranked, profile-matched roles. */
export interface JobRecommendations {
  matches: JobMatch[];
  /** Optional advisory (e.g. no live sources configured). */
  note?: string;
}

// ---------------------------------------------------------------------------
// Career Intelligence
// ---------------------------------------------------------------------------

export interface SalaryInsight {
  currency: string;
  period: string;
  min: number;
  median: number;
  max: number;
  basis: string;
  market_position: string;
  factors: string[];
  negotiation_tips: string[];
}

export interface MockQuestion {
  question: string;
  focus: string;
}

export interface MockInterviewSet {
  role: string;
  questions: MockQuestion[];
}

export interface MockEvaluation {
  score: number;
  strengths: string[];
  improvements: string[];
  model_answer: string;
}

/** The Career Intelligence overview bundle, produced in one orchestrated call. */
export interface CareerOverview {
  profile: CandidateProfile;
  salary: SalaryInsight;
  learningPath: SkillsGapPlan;
}

// ---------------------------------------------------------------------------
// Career Agent (orchestrator)
// ---------------------------------------------------------------------------

export interface ReadinessDimension {
  label: string;
  score: number;
}

/** Candidate intelligence profile the agent builds from the résumé (memory seed). */
export interface CandidateProfile {
  headline: string;
  seniority: string;
  industry: string;
  years_experience: string;
  skills: string[];
  strengths: string[];
  weaknesses: string[];
  career_readiness: number;
  readiness_breakdown: ReadinessDimension[];
  summary: string;
}

/** One ordered step in the agent's plan. */
export interface AgentPlanStep {
  tool: string;
  why: string;
}

/** The agent's plan, produced before execution and shown to the user for approval. */
export interface AgentPlan {
  goal_understanding: string;
  steps: AgentPlanStep[];
}

export interface AgentCritic {
  verdict: string;
  confidence: number;
  issues: string[];
  improvements: string[];
  headline: string;
}

/**
 * Events streamed from the agent loop to the client, one per line (SSE `data:`).
 * The client renders these as a live execution timeline.
 */
export type AgentEvent =
  | { type: "plan"; plan: AgentPlan }
  | { type: "step_start"; id: number; tool: string; label: string; requiresApproval?: boolean }
  | { type: "step_reasoning"; id: number; text: string }
  | { type: "step_done"; id: number; tool: string; summary: string }
  | { type: "step_skipped"; id: number; tool: string; reason: string }
  | { type: "step_error"; id: number; tool: string; error: string }
  | { type: "critic"; critic: AgentCritic }
  | { type: "final"; result: AgentResult }
  | { type: "error"; message: string };

/** The consolidated output of an agent run, assembled from the tool blackboard. */
export interface AgentResult {
  goal: string;
  profile?: CandidateProfile;
  ats?: AtsReadiness;
  matches?: JobMatch[];
  audit?: AtsAudit;
  tailored?: SurgicalTailor;
  interviewPrep?: PrepPack;
  skillGap?: SkillsGapPlan;
  critic?: AgentCritic;
  /** Ordered human-readable trace summaries, for the collapsed timeline. */
  timeline: { tool: string; summary: string }[];
}

/** Reusable candidate profile — the single source of truth for autofill/answers. */
export interface MasterProfile {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  yearsExperience: string;
  noticePeriod: string;
  currentCtc: string;
  expectedCtc: string;
  workAuth: string;
  linkedinUrl: string;
  portfolioUrl: string;
}

/** Auto-drafted answers to recurring application/screening questions. */
export interface AnswerPack {
  short_intro: string;
  why_this_company: string;
  notice_period: string;
  expected_ctc: string;
  relocation: string;
}

/** Pipeline stages for a tracked application. */
export type ApplicationStatus =
  | "Ready"
  | "Applied"
  | "Interview"
  | "Offer"
  | "Rejected"
  | "Skipped";

/** One row in the application audit log / pipeline tracker. */
export interface ApplicationLogEntry {
  id: string;
  company: string;
  jobTitle: string;
  location: string;
  platform: Platform;
  atsMatch: number;
  status: ApplicationStatus;
  reason?: string;
  applyUrl?: string;
  dealbreakers?: string[];
  appliedAt?: number;
  notes?: string;
}

/** Aggregated missing-skill counts across skipped jobs. */
export interface SkillGap {
  skill: string;
  count: number;
}

export interface UpskillItem {
  skill: string;
  priority: "High" | "Medium" | "Low";
  weeks: number;
  plan: string;
}

export interface SkillsGapPlan {
  summary: string;
  items: UpskillItem[];
}

export interface InterviewQA {
  question: string;
  star_answer: string;
}

/** Per-role interview prep: brief + tips + likely questions with STAR answers. */
export interface PrepPack {
  company_brief: string;
  interview_tips: string[];
  questions: InterviewQA[];
}

/** Eligibility verdict from the Apply Assist gate (human submits, not the app). */
export interface ApplyEligibility {
  eligible: boolean;
  reason: string;
  ats_match_score: number;
  dealbreaker_flags: string[];
  applyUrl: string;
  platform: Platform;
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
