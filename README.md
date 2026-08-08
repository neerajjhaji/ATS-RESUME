# Resume Tailor — ATS Optimizer

A full-stack Next.js (App Router) application that tailors a resume to a specific job
description using a **dual-engine Google Gemini pipeline**. Upload a PDF/DOCX (or paste
text), drop in a job description, and get an ATS match score, a keyword-gap breakdown,
and one-click line-by-line rewrites — plus an optional tailored cover letter.

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + **lucide-react** icons
- **@google/genai** (official Gemini SDK) with `responseSchema` structured output
- **pdf-parse** / **mammoth** for server-side file extraction
- **@react-pdf/renderer** for ATS-compliant PDF export

## Model routing

Every call reads its model from one table in [`lib/gemini.ts`](lib/gemini.ts):

| Task                                              | Model              |
| ------------------------------------------------- | ------------------ |
| Phase 1 — fast text extraction / normalization    | `gemini-2.0-flash` |
| Phase 2 — deep ATS audit, gap detection, rewrites | `gemini-2.5-pro`   |
| Phase 3 — cover letter / auxiliary generation     | `gemini-2.5-flash` |

> These are real, generally-available Gemini models. If your key/region can't access one,
> list what you can use and swap the value in the `MODELS` table in
> [`lib/gemini.ts`](lib/gemini.ts) — one change propagates everywhere:
>
> ```bash
> curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" | grep '"name"'
> ```

## Setup

```bash
npm install
cp .env.example .env.local   # then edit .env.local and paste your key
npm run dev
```

Get a key at <https://aistudio.google.com/apikey>. The key is read **only** on the
server (`process.env.GEMINI_API_KEY`) and is never exposed to the browser or requested
in the UI.

Open <http://localhost:3000>.

## Run on macOS (VS Code)

Step-by-step for a fresh Mac.

**1. Install prerequisites** (one-time). Easiest with [Homebrew](https://brew.sh):

```bash
brew install node git
```

Or download the Node.js 18+ installer from <https://nodejs.org>. Verify:

```bash
node -v && npm -v
```

Install VS Code from <https://code.visualstudio.com> (or `brew install --cask visual-studio-code`).

**2. Clone the repo:**

```bash
git clone https://github.com/neerajjhaji/ATS-RESUME.git
```

**3. Open it in VS Code:**

```bash
code ATS-RESUME
```

> If `code` isn't found: open VS Code → `⇧⌘P` → "Shell Command: Install 'code' command in PATH".

**4. Install dependencies** — open the VS Code terminal (`` ⌃` ``) and run:

```bash
npm install
```

**5. Add your Gemini API key.** Get one at <https://aistudio.google.com/apikey>, then:

```bash
cp .env.example .env.local
```

Open `.env.local` and set `GEMINI_API_KEY=your_real_key_here`.

_(Optional)_ For the Agent Hub live job feed, also add a free
[Adzuna](https://developer.adzuna.com) key: `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`.
**Never put site passwords in `.env` — only API keys.**

**6. ⚠️ Fix the model IDs (required).** Edit the `MODELS` table in [`lib/gemini.ts`](lib/gemini.ts)
— the spec's IDs don't exist in the API. Use real ones your key can access, e.g.:

```ts
export const MODELS = {
  FLASH_FAST: "gemini-2.0-flash",
  PRO_STRATEGY: "gemini-2.5-pro",
  FLASH_AUX: "gemini-2.5-flash",
} as const;
```

Check availability at <https://ai.google.dev/gemini-api/docs/models>.

**7. Run it:**

```bash
npm run dev
```

Open <http://localhost:3000>. Edits hot-reload automatically.

**8. Production build (optional):**

```bash
npm run build && npm start
```

**Recommended VS Code extensions:** ESLint (`dbaeumer.vscode-eslint`),
Tailwind CSS IntelliSense (`bradlc.vscode-tailwindcss`), Prettier (`esbenp.prettier-vscode`).

## How it works

```
Upload PDF/DOCX ──► /api/parse          (Phase 1: extract + normalize) ─► clean resume text
Analyze         ──► /api/analyze        (Phase 2: match_score + gaps + actionable_changes)
Cover letter    ──► /api/cover-letter   (Phase 3: tailored letter)
Quick score     ──► /api/ats-score      (standalone: resume-only ATS readiness, no JD)

Agent Hub:
Discover        ──► /api/agent/discover      (search keywords + target titles)
Live job feed   ──► /api/agent/jobs          (Adzuna listings, filtered to your locations)
Surgical tailor ──► /api/agent/tailor-diff   (structure-preserving rewrite + score + dealbreakers)
Eligibility gate──► /api/agent/prepare-apply (score ≥ 75 & no dealbreakers → review link)
```

### Structured output

Phase 2 enforces this JSON shape via `config.responseSchema` (see
[`lib/schemas.ts`](lib/schemas.ts)):

```jsonc
{
  "match_score": 72,
  "summary_critique": "…",
  "keywords": {
    "matched": ["…"],
    "missing_hard_skills": ["…"],
    "missing_tools": ["…"],
    "missing_soft_skills": ["…"]
  },
  "actionable_changes": [
    {
      "section": "Work Experience - Acme Corp",
      "current_text": "Managed the backend.",
      "flaw_reason": "Lacks quantifiable metrics and JD keywords.",
      "suggested_text": "Led a 4-service Go/Kubernetes backend serving 2M req/day…"
    }
  ]
}
```

## Agent Hub

A second tab that turns the tailor into a job-discovery + application‑prep agent for
**Navi Mumbai, Mumbai, and Remote** roles across **Naukri** and **LinkedIn**.

1. **Discover** — from your resume, generate target titles + search keywords and ready-made
   Naukri/LinkedIn search links per location.
2. **Live job feed** — pull real listings via the Adzuna API, filtered to your selected
   locations (needs the optional Adzuna keys).
3. **Surgical tailor + eligibility gate** — for a chosen job, rewrite the resume
   (preserving structure, tone, and date formats — never inventing experience), score it,
   and flag dealbreakers. A job is marked **Ready** only when `ats_match_score ≥ 75` **and**
   there are zero dealbreakers; otherwise **Skipped**.
4. **Audit log** — `Company | Job Title | Location | Platform | ATS % | Status`, persisted in
   your browser, with one-click PDF export and a review link.

> ### Why there's no fully-automated auto-apply
> The Agent Hub is **human-in-the-loop by design**. It does **not** log into LinkedIn/Naukri
> or auto-submit applications. Driving those sites with stored session cookies or passwords
> violates their Terms of Service and risks a **permanent account ban**, and there is no
> official job-seeker API for submitting applications. The hub automates everything up to the
> submit click, then hands you a tailored PDF + a review link so **you** submit.

## Interactive dashboard

- **Left panel** — inputs + ATS audit: score gauge, keyword gap chips (click a missing
  keyword to inject it into your Skills section), and the cover-letter card.
- **Right panel** — the "Where & What to Change" feed with **Apply Edit** buttons, and a
  live, editable single-column resume (the exact plain-text shape ATS parsers ingest).
- **Export** — download the tailored resume as an ATS-compliant **PDF** or **Markdown**.

## Project structure

```
resume-tailor/
├─ app/
│  ├─ api/
│  │  ├─ parse/route.ts         # Phase 1 — extraction (flash)
│  │  ├─ analyze/route.ts       # Phase 2 — ATS audit (pro)
│  │  ├─ cover-letter/route.ts  # Phase 3 — cover letter (flash-aux)
│  │  ├─ ats-score/route.ts     # standalone ATS score (no JD)
│  │  └─ agent/
│  │     ├─ discover/route.ts       # keywords + target titles
│  │     ├─ jobs/route.ts           # Adzuna live job feed
│  │     ├─ tailor-diff/route.ts    # surgical tailor + score + dealbreakers
│  │     └─ prepare-apply/route.ts  # eligibility gate (human submits)
│  ├─ globals.css · layout.tsx
│  └─ page.tsx                  # tabbed orchestrator (Tailor + Agent Hub)
├─ components/                  # InputPanel, ScoreGauge, KeywordList,
│                               # RecommendationsFeed, ResumeEditor, CoverLetterCard,
│                               # StandaloneScoreCard, TemplateGallery, AgentHub, Brand
├─ lib/                         # gemini, schemas, fileParser, export, templates, jobs
├─ types/index.ts
└─ .env.example
```

## Security notes

- API keys (`GEMINI_API_KEY`, optional `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`) live only in
  `.env.local` (gitignored) and are used server-side. No key input field exists in the UI.
- **No site passwords, ever.** The app never stores or uses LinkedIn/Naukri credentials and
  never automates authenticated submissions — only public, read-only job listings and a
  human-submitted review link.
- File parsing and all Gemini/Adzuna calls run in Node runtime API routes, never the browser.
```
