import type { JobListing } from "@/types";

/**
 * Server-only Adzuna job-search client. Adzuna authenticates with an app id +
 * key (query params, their required scheme) — both read from server env, never
 * shipped to the client. This fetches public job LISTINGS only; it never touches
 * any user account or submits anything.
 */

interface AdzunaResult {
  id?: string;
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  description?: string;
  redirect_url?: string;
  created?: string;
  salary_min?: number;
  salary_max?: number;
}

export function adzunaConfigured(): boolean {
  return Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
}

export async function fetchAdzunaJobs(opts: {
  what: string;
  locations: string[];
  perLocation?: number;
  country?: string;
}): Promise<JobListing[]> {
  const id = process.env.ADZUNA_APP_ID;
  const key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) {
    throw new Error(
      "Adzuna keys missing. Add ADZUNA_APP_ID and ADZUNA_APP_KEY to .env.local (free key at developer.adzuna.com)."
    );
  }

  const { what, locations, perLocation = 8, country = "in" } = opts;
  const locs = locations.length ? locations : ["Mumbai"];
  const all: JobListing[] = [];

  for (const loc of locs) {
    const params = new URLSearchParams({
      app_id: id,
      app_key: key,
      what,
      where: loc,
      results_per_page: String(perLocation),
      "content-type": "application/json",
    });
    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Adzuna request failed (${res.status}). ${body.slice(0, 140)}`);
    }
    const data = (await res.json()) as { results?: AdzunaResult[] };

    for (const r of data.results ?? []) {
      all.push({
        id: String(r.id ?? r.redirect_url ?? `${r.title}-${loc}`),
        title: r.title ?? "Untitled role",
        company: r.company?.display_name ?? "Unknown company",
        location: r.location?.display_name ?? loc,
        description: (r.description ?? "").trim(),
        applyUrl: r.redirect_url ?? "",
        created: r.created,
        salary: r.salary_min
          ? `${Math.round(r.salary_min)}${r.salary_max ? `–${Math.round(r.salary_max)}` : ""}`
          : undefined,
        source: "adzuna",
      });
    }
  }

  return dedupe(all);
}

function stripHtml(s: string): string {
  return (s || "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function matchesKeywords(text: string, what: string): boolean {
  const terms = what.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (!terms.length) return true;
  const hay = text.toLowerCase();
  return terms.some((t) => hay.includes(t));
}

/** RemoteOK — free, no key, all-remote roles. */
export async function fetchRemoteOk(what: string, limit = 12): Promise<JobListing[]> {
  const res = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "resume-tailor-agent", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`RemoteOK ${res.status}`);
  const raw = (await res.json()) as Record<string, unknown>[];
  // First element is a legal/notice object, not a job.
  const jobs = raw.filter((r) => r && r.id && (r.position || r.title));
  const mapped: JobListing[] = jobs.map((r) => ({
    id: `remoteok-${String(r.id)}`,
    title: String(r.position ?? r.title ?? "Remote role"),
    company: String(r.company ?? "Unknown company"),
    location: String(r.location || "Remote"),
    description: stripHtml(String(r.description ?? "")).slice(0, 600),
    applyUrl: String(r.url ?? r.apply_url ?? ""),
    created: r.date ? String(r.date) : undefined,
    salary:
      r.salary_min && r.salary_max ? `${r.salary_min}–${r.salary_max}` : undefined,
    source: "remoteok",
  }));
  return mapped
    .filter((j) => matchesKeywords(`${j.title} ${j.description}`, what))
    .slice(0, limit);
}

/** Arbeitnow — free, no key, includes remote + on-site roles. */
export async function fetchArbeitnow(what: string, limit = 12): Promise<JobListing[]> {
  const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Arbeitnow ${res.status}`);
  const data = (await res.json()) as { data?: Record<string, unknown>[] };
  const mapped: JobListing[] = (data.data ?? []).map((r) => ({
    id: `arbeitnow-${String(r.slug ?? r.url)}`,
    title: String(r.title ?? "Role"),
    company: String(r.company_name ?? "Unknown company"),
    location: r.remote ? "Remote" : String(r.location ?? "—"),
    description: stripHtml(String(r.description ?? "")).slice(0, 600),
    applyUrl: String(r.url ?? ""),
    created: r.created_at ? String(r.created_at) : undefined,
    source: "arbeitnow",
  }));
  return mapped
    .filter((j) => matchesKeywords(`${j.title} ${j.description}`, what))
    .slice(0, limit);
}

function dedupe(list: JobListing[]): JobListing[] {
  const seen = new Set<string>();
  return list.filter((j) => {
    const k = (j.applyUrl || j.id).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Aggregate across all available sources. Adzuna runs only if keys are set;
 * RemoteOK + Arbeitnow (keyless) run when Remote is requested or no location is
 * given. Each source is isolated — one failure never kills the others.
 */
export async function fetchAllJobs(opts: {
  what: string;
  locations: string[];
}): Promise<{ jobs: JobListing[]; errors: string[] }> {
  const { what, locations } = opts;
  const wantsRemote =
    locations.length === 0 || locations.some((l) => /remote/i.test(l));
  const errors: string[] = [];
  const collected: JobListing[] = [];

  const tasks: Promise<void>[] = [];

  if (adzunaConfigured()) {
    tasks.push(
      fetchAdzunaJobs({ what, locations })
        .then((j) => void collected.push(...j))
        .catch((e) => void errors.push(`Adzuna: ${e instanceof Error ? e.message : e}`))
    );
  }
  if (wantsRemote) {
    tasks.push(
      fetchRemoteOk(what)
        .then((j) => void collected.push(...j))
        .catch((e) => void errors.push(`RemoteOK: ${e instanceof Error ? e.message : e}`))
    );
    tasks.push(
      fetchArbeitnow(what)
        .then((j) => void collected.push(...j))
        .catch((e) => void errors.push(`Arbeitnow: ${e instanceof Error ? e.message : e}`))
    );
  }

  await Promise.all(tasks);
  return { jobs: dedupe(collected), errors };
}
