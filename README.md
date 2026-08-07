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
| Phase 1 — fast text extraction / normalization    | `gemini-3.6-flash` |
| Phase 2 — deep ATS audit, gap detection, rewrites | `gemini-3.1-pro`   |
| Phase 3 — cover letter / auxiliary generation     | `gemini-3.5-flash` |

> **⚠️ Verify these model IDs.** The IDs above come from the project spec. Confirm your
> API key has access to them at <https://ai.google.dev/gemini-api/docs/models> and edit
> the `MODELS` table in `lib/gemini.ts` if needed — one change propagates everywhere.

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

## How it works

```
Upload PDF/DOCX ──► /api/parse    (Phase 1: extract + normalize)  ─► clean resume text
Analyze         ──► /api/analyze  (Phase 2: match_score + gaps + actionable_changes)
Cover letter    ──► /api/cover-letter (Phase 3: tailored letter)
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
│  │  └─ cover-letter/route.ts  # Phase 3 — cover letter (flash-aux)
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx                  # split-panel orchestrator + state
├─ components/                  # InputPanel, ScoreGauge, KeywordList,
│                               # RecommendationsFeed, ResumeEditor,
│                               # CoverLetterCard, ResumePdfDocument
├─ lib/                         # gemini (client+routing), schemas, fileParser, export
├─ types/index.ts
└─ .env.example
```

## Security notes

- The API key lives only in `.env.local` (gitignored) and is used server-side.
- No key input field exists in the UI by design.
- File parsing and all Gemini calls run in Node runtime API routes, never the browser.
```
