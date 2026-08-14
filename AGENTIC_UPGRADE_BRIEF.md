# ATS-RESUME — State of the App & Agentic Upgrade Brief

> One document to (a) understand exactly what exists today, (b) run it, and (c) drive the next phase toward a genuinely *agentic* career platform. The last section is a ready-to-paste master prompt.

---

## 1. What this app is

A **Next.js 14 (App Router)** résumé/ATS optimizer + job-search assistant, powered by **Google Gemini**. Single-page client with three modules over shared résumé state; a set of server API routes that call Gemini and public job APIs. Everything is human-in-the-loop — the app **never** logs into a job site or auto-submits an application.

**Repo:** https://github.com/neerajjhaji/ATS-RESUME · **Local path:** `D:\Store\resume-tailor` · **Branch of this work:** `three-module-career-platform`

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14.2.35 (App Router, server routes + client components) |
| Language / UI | TypeScript, React, TailwindCSS |
| AI SDK | `@google/genai` (Gemini), structured JSON via `responseSchema` |
| Models (see `lib/gemini.ts`) | `gemini-2.0-flash` (parse), `gemini-2.5-flash` (aux), `gemini-2.5-pro` (deep audit/tailor) |
| Job data | Adzuna (needs keys) + RemoteOK & Arbeitnow (keyless, remote roles) |
| Résumé parsing | `lib/fileParser.ts` (PDF/DOCX → text) |
| Export | React-PDF (`components/ResumePdfDocument.tsx`, `lib/export.tsx`) |
| Email digests | Resend (optional) |
| Tests / CI | Vitest + `.github/workflows/ci.yml`, scheduled `daily-digest.yml` |
| Resilience | `lib/retry.ts` (backoff), `lib/http.ts` (rate limiting) |

---

## 3. Current architecture — the 3 modules

`app/page.tsx` is the single owner of shared state (`resumeText`, `jobDescription`, `jobTitle`, active `module`) and routes between three views. The résumé is entered once and every module sees it.

```
                       ┌─────────────────────────────────────────────┐
                       │            app/page.tsx (shared state)        │
                       │   resumeText · jobDescription · jobTitle      │
                       └───────────────┬───────────────┬──────────────┘
        module="checker"               │ builder       │ career
        ┌──────────────────┐   ┌───────▼─────────┐   ┌─▼───────────────────┐
        │  ATS Checker      │   │ AI Resume Builder│   │  Career Tool         │
        │  AtsChecker.tsx   │   │ (InputPanel +    │   │  CareerTool.tsx      │
        │                   │   │  Recommendations │   │                      │
        │ upload→parse→     │   │  + ResumeEditor +│   │ résumé → ranked      │
        │ score; Analyse &  │──▶│  TemplateGallery)│◀──│ job matches; "Tailor │
        │ Tailor unlock     │   │                  │   │ to this job" hands   │
        │ once parsed       │   │ analyze vs a JD, │   │ the JD to Builder    │
        └──────────────────┘   │ 1-click rewrites │   └──────────────────────┘
                               └──────────────────┘
```

**Flow:** Upload → Parse → (score) → Analyse/Tailor → Build/Improve → Find matching jobs → Tailor to a chosen job. Buttons enable/disable based on progress (e.g. Analyse & Tailor are disabled until a résumé is parsed).

---

## 4. Component inventory

**Live / routed today**

| Component | Role |
|---|---|
| `AtsChecker.tsx` | Module 1. Parse + standalone ATS score; parse-gated Analyse/Tailor handoff. |
| `CareerTool.tsx` | Module 3 (new, simplified). Profile-matched job list w/ score, matched/missing skills, location, experience; "Tailor to this job". |
| `InputPanel.tsx` | Builder inputs: résumé dropzone/paste, target title, JD, Analyze button (gated). |
| `ResumeSource.tsx` | Reusable upload/paste résumé block (used by Checker & Career). |
| `ScoreGauge.tsx`, `StandaloneScoreCard.tsx` | Score visualizations. |
| `KeywordList.tsx`, `RecommendationsFeed.tsx` | Keyword gap + one-click actionable rewrites. |
| `ResumeEditor.tsx`, `TemplateGallery.tsx`, `ResumePdfDocument.tsx` | Live editor + template export to PDF. |
| `CoverLetterCard.tsx` | Cover-letter generation. |
| `Brand.tsx` | Header/footer. |

**Legacy — present but no longer routed** (kept, not deleted, after the "simplify Career" decision)

`AgentHub.tsx`, `AgentOrchestrator.tsx`, `ProfilePanel.tsx`, `DigestPanel.tsx`, `SkillsGapPanel.tsx`, `AnswerPackButton.tsx`, `PrepPackButton.tsx`. These hold real agentic value (see §7) and are the natural seed for the upgrade.

---

## 5. API route inventory (`app/api/**`)

| Route | Model | Purpose |
|---|---|---|
| `parse` | flash-fast | PDF/DOCX → clean single-column text |
| `ats-score` | flash/pro | Standalone ATS readiness (no JD): score, breakdown, quick wins |
| `analyze` | **pro** | Deep ATS audit vs a JD: match score, keyword buckets, line-by-line rewrites |
| `cover-letter` | flash-aux | Tailored cover letter |
| `agent/recommend` **(new)** | flash-aux | Résumé → discover terms → fetch live jobs → **batch-score all** → ranked `JobMatch[]` |
| `agent/discover` | flash-aux | Résumé → search keywords + target titles |
| `agent/jobs` | — | Live listings (Adzuna + keyless feeds) |
| `agent/tailor-diff`, `agent/tailor-loop` | pro | Surgical tailor to a JD; self-critique loop to hit a target score |
| `agent/prepare-apply` | flash | Eligibility gate (score + dealbreakers) — human still submits |
| `agent/plan` | flash | LLM **planner**: keywords, titles, thresholds, how many to tailor |
| `agent/run` | pro | **Unattended orchestrator**: fetch → self-critique tailor → gate → rank → email kit (cron-guarded) |
| `agent/skills-gap`, `agent/prep`, `agent/answers`, `agent/digest` | flash/pro | Upskilling plan, interview prep, screening answers, daily digest |
| `health` | — | Liveness |

Shared types in `types/index.ts`; Gemini response schemas in `lib/schemas.ts`.

---

## 6. What works vs. what's blocked

**Works (verified in the dev server):** module nav + order, Checker-first default, parse-gating of Analyse/Tailor, shared résumé across modules, Career→Builder tailor handoff, `tsc --noEmit` clean.

**Blocked right now (config, not code):**
- 🔴 **`GEMINI_API_KEY` in `.env.local` is invalid** → every AI call returns `500 API key not valid`. This is why the app feels dead. **Fix first** (see §8).
- 🟡 **No Adzuna keys** → only the keyless Remote feeds return jobs; keep "Remote" selected or add keys for India on-site roles.

**Debt / rough edges:**
- API errors are surfaced as raw Gemini JSON in the UI banner — should be humanized.
- Legacy `AgentHub` tree is dead code in the main flow (decide: revive as the agent surface, or remove).
- No persistence of résumé/audits beyond localStorage; no auth/multi-user.

---

## 7. Agentic capabilities **already** in the codebase (the seed)

You are closer to "agentic" than it looks. These exist today:
- **Planner** (`agent/plan`) — turns a résumé into a strategy (keywords, titles, thresholds, budget).
- **Self-critique loop** (`agent/run` `tailorLoop`, `agent/tailor-loop`) — retries tailoring up to 3× against a target score with revision feedback. This is a real critic/actor loop.
- **Unattended orchestrator** (`agent/run`) — end-to-end fetch → tailor → gate → rank → email, cron-guarded, no auto-submit.
- **Memory** (`lib/agentMemory.ts`) — localStorage dedupe of seen jobs + per-keyword score learning to improve future planning.
- **Eligibility gate** (`agent/prepare-apply`) — dealbreaker detection so the agent skips bad-fit roles.
- **Tool-like data layer** (`lib/jobs.ts`) — multi-source job fetch with per-source isolation.

The gap is that these are scattered across one-shot routes and a hidden hub, not unified behind a single **agent loop with tool-calling, a visible plan, and human checkpoints**.

---

## 8. How to run

```bash
cd D:/Store/resume-tailor
# 1. Put a REAL key in .env.local (this is the current blocker):
#    GEMINI_API_KEY=...   (https://aistudio.google.com/apikey)
#    optional: ADZUNA_APP_ID / ADZUNA_APP_KEY, RESEND_* for digests
npm install
npm run dev          # http://localhost:3000
npm run typecheck    # tsc --noEmit
npm test             # vitest
```
`.env.example` documents every variable. Keys are server-only (never shipped to the browser).

---

## 9. Gap analysis — what "better agentic" means here

| Dimension | Today | Agentic target |
|---|---|---|
| Control | User clicks each step | User states a **goal**; agent plans + executes multi-step, pausing at checkpoints |
| Transparency | Hidden one-shot calls | A visible **plan + live trace** (what it's doing, why, tokens/cost) |
| Tools | Routes called ad hoc | A typed **tool registry** the model calls (parse, score, discover, fetch_jobs, match, tailor, gate, prep) |
| Memory | localStorage dedupe | Durable **candidate profile + run history** informing every step |
| Recovery | Single try (except tailor) | **Reflect-and-retry** across the whole loop; graceful degradation on missing keys |
| Verification | Model's own score | Independent **critic pass** before anything is shown as "ready" |

---

## 10. Recommended agentic roadmap (phased)

**Phase 0 — Unblock (minutes):** valid `GEMINI_API_KEY`; humanize API error messages.

**Phase 1 — One agent loop, visible (core of the ask):**
- Add `POST /api/agent/act` implementing an **actor–critic loop with tool-calling**: the model is given a goal + a tool registry and drives itself, emitting a step trace.
- Define tools as thin wrappers over existing routes/libs: `parse_resume`, `score_ats`, `discover_terms`, `fetch_jobs`, `match_jobs`, `tailor_resume`, `check_eligibility`, `make_prep_pack`.
- New UI surface **"Career Agent"**: user picks a goal ("Find & tailor me to 5 remote backend roles"), sees the **plan**, a **live step timeline**, and **checkpoints** (approve before it tailors / spends budget).

**Phase 2 — Memory & verification:** durable candidate profile + run history (persist beyond localStorage); an **independent critic** that re-checks each "ready" match before it's surfaced; reflect-and-retry on the whole loop.

**Phase 3 — Polish & trust:** streaming trace (SSE), token/cost meter, budget caps, resumable runs, clear "human submits, never auto-apply" guarantees throughout.

**Guardrails (non-negotiable):** no credential entry, no auto-login, no auto-submit; every outward/irreversible action is a human checkpoint; keys stay server-side.

---

## 11. ▶ MASTER PROMPT — paste this into Claude Code (or your agent) to drive Phase 1

```
You are upgrading an existing Next.js 14 (App Router) + TypeScript + Gemini app
called ATS-RESUME (path: D:/Store/resume-tailor) into a genuinely agentic career
platform. Read AGENTIC_UPGRADE_BRIEF.md first — it documents the current modules,
API routes, types (types/index.ts), schemas (lib/schemas.ts), and the existing
agentic seed (agent/plan, agent/run self-critique loop, lib/agentMemory.ts).

GOAL
Add ONE unified, transparent agent loop that turns a user goal into a planned,
tool-driven, human-checkpointed run — without breaking the existing 3 modules.

BUILD
1. Tool registry (lib/agent/tools.ts): typed tools that wrap EXISTING logic, each
   with a name, JSON-schema input, and a handler:
   parse_resume, score_ats, discover_terms, fetch_jobs, match_jobs (reuse
   /api/agent/recommend logic), tailor_resume (reuse the self-critique tailorLoop),
   check_eligibility, make_prep_pack. Reuse lib/gemini.ts, lib/jobs.ts, lib/schemas.ts;
   do not duplicate model-calling code.
2. Agent loop (app/api/agent/act/route.ts): given {goal, resumeText, constraints},
   run an actor–critic loop with Gemini tool-calling — plan → call tools → observe →
   reflect → continue, up to a step/budget cap. Emit a structured trace
   (step, tool, args, result-summary, tokens). Add an independent critic step that
   re-verifies any job marked "ready" before returning it. Stream progress if feasible
   (SSE); otherwise return the full trace.
3. UI ("Career Agent" — a 4th module or a mode inside Career Tool): a goal box, the
   generated PLAN shown before execution, a LIVE STEP TIMELINE, and HUMAN CHECKPOINTS
   (approve before tailoring / before spending beyond a budget). Reuse existing card
   components for match/tailor results.
4. Memory: promote lib/agentMemory.ts into the loop (dedupe seen jobs, feed prior
   keyword scores into planning). Persist the candidate profile + last run.

CONSTRAINTS
- Never enter credentials, never auto-login, never auto-submit an application. Every
  outward/irreversible action is a human checkpoint. Keys stay server-side.
- Keep it SIMPLE and legible: one clear agent surface, a readable trace, no feature soup.
- Degrade gracefully when ADZUNA/RESEND keys are absent (use keyless remote feeds; say so).
- Humanize all API errors (no raw Gemini JSON in the UI).

QUALITY BAR
- tsc --noEmit clean; add Vitest coverage for the tool registry + loop control flow
  (mock Gemini). Verify in the dev server: a full goal → plan → trace → checkpointed
  results run. Update README + this brief. Commit on a feature branch with a clear message.

DELIVERABLE
A working "state a goal → watch the agent plan and execute with checkpoints → get
tailored, verified matches" experience, built on the existing routes, with the three
current modules still working.
```

---

*Generated to accompany the 3-module restructure on branch `three-module-career-platform`.*
