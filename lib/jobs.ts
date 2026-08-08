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

  // Dedupe by apply URL (same job can appear across location queries).
  const seen = new Set<string>();
  return all.filter((j) => {
    const k = j.applyUrl || j.id;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
