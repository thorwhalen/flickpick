/**
 * TMDB client (seam 4's v1 default), with its terms written next to the fetch.
 *
 * - **Display only.** Nothing fetched here is ever passed to the recommender, an embedding or an
 *   LLM: TMDB's API terms exclude ML/AI uses (project rule, `.claude/CLAUDE.md`).
 * - **The user's own key**, sent only to `api.themoviedb.org`. Images come from TMDB's image CDN,
 *   which needs no key.
 * - **Cached at most 180 days** (`defaults.tmdb.cacheDays`), with `fetched_at` on every entry.
 * - **Attribution** is mandatory wherever this data is shown: `TMDB_TERMS.attribution` with the
 *   TMDB logo, and `TMDB_TERMS.justWatch` beside streaming availability.
 *
 * Two calls per title: `/find/{imdb_id}?external_source=imdb_id` (skipped when the catalogue
 * already carries the TMDB id) and `/movie/{id}?append_to_response=release_dates,watch/providers`.
 */
import { z } from 'zod';
import { defaults } from '@/defaults';
import { EnrichmentSchema, RegionProvidersSchema, type Enrichment } from '@/state/schemas';

export const TMDB_TERMS = {
  displayOnly: true,
  requiresKey: true,
  cacheDays: defaults.tmdb.cacheDays,
  attribution: 'This product uses the TMDB API but is not endorsed or certified by TMDB.',
  justWatch: 'Streaming data by JustWatch',
} as const;

/** Fetch JSON from a URL with headers; injected so tests run without the network. */
export type FetchJson = (url: string, init?: { headers?: Record<string, string> }) => Promise<unknown>;

export const defaultFetchJson: FetchJson = async (url, init) => {
  const res = await fetch(url, { headers: init?.headers });
  if (!res.ok) throw new Error(`TMDB request failed: HTTP ${res.status} ${res.statusText}`);
  return res.json();
};

// Only the fields we use are validated; everything else in TMDB's responses is dropped.
const FindResponse = z.object({ movie_results: z.array(z.object({ id: z.number() })).default([]) });
const ReleaseDates = z.object({
  results: z
    .array(z.object({ iso_3166_1: z.string(), release_dates: z.array(z.object({ certification: z.string().default('') })) }))
    .default([]),
});
const MovieResponse = z.object({
  id: z.number(),
  poster_path: z.string().nullable().default(null),
  backdrop_path: z.string().nullable().default(null),
  overview: z.string().default(''),
  runtime: z.number().nullable().default(null),
  release_dates: ReleaseDates.optional(),
  'watch/providers': z.object({ results: z.record(z.string(), z.unknown()).default({}) }).optional(),
});

/** Headers and query for a key: a v4 read access token goes in a header, a v3 key in the URL. */
function auth(apiKey: string): { headers: Record<string, string>; query: string } {
  if (apiKey.startsWith(defaults.tmdb.bearerTokenPrefix)) {
    return { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }, query: '' };
  }
  return { headers: { Accept: 'application/json' }, query: `api_key=${encodeURIComponent(apiKey)}` };
}

function apiUrl(path: string, params: Record<string, string>, query: string): string {
  const search = new URLSearchParams(params).toString();
  return `${defaults.tmdb.apiBase}${path}?${[search, query].filter(Boolean).join('&')}`;
}

export interface FetchEnrichmentOptions {
  apiKey: string;
  region: string;
  /** The TMDB id when the catalogue has it (saves the `/find` call). */
  tmdbId?: number | null;
  fetchJson?: FetchJson;
  now?: () => Date;
}

/** Look one title up on TMDB. A title TMDB does not know gives `found: false` (cache it too). */
export async function fetchEnrichment(imdbId: string, options: FetchEnrichmentOptions): Promise<Enrichment> {
  const { apiKey, region, tmdbId, fetchJson = defaultFetchJson, now = () => new Date() } = options;
  if (!apiKey) throw new Error('No TMDB API key is set (Settings).');
  const { headers, query } = auth(apiKey);
  const base = { imdb_id: imdbId, fetched_at: now().toISOString(), region };

  let id = tmdbId ?? null;
  if (id === null) {
    const found = FindResponse.parse(
      await fetchJson(apiUrl(`/find/${encodeURIComponent(imdbId)}`, { external_source: 'imdb_id' }, query), { headers }),
    );
    id = found.movie_results[0]?.id ?? null;
    if (id === null) return EnrichmentSchema.parse({ ...base, found: false });
  }

  const movie = MovieResponse.parse(
    await fetchJson(apiUrl(`/movie/${id}`, { append_to_response: 'release_dates,watch/providers' }, query), { headers }),
  );
  const certification =
    movie.release_dates?.results
      .find((r) => r.iso_3166_1 === region)
      ?.release_dates.map((d) => d.certification)
      .find((c) => c !== '') ?? '';
  const regionProviders = movie['watch/providers']?.results[region];
  const providers = regionProviders === undefined ? null : RegionProvidersSchema.safeParse(regionProviders).data ?? null;

  return EnrichmentSchema.parse({
    ...base,
    found: true,
    tmdb_id: movie.id,
    poster_path: movie.poster_path,
    backdrop_path: movie.backdrop_path,
    overview: movie.overview,
    runtime: movie.runtime,
    certification,
    providers,
  });
}

/** Whether a cached entry may still be shown: younger than the cache limit, same region. */
export function isFresh(entry: Enrichment, { now, region }: { now: Date; region: string }): boolean {
  const age = now.getTime() - Date.parse(entry.fetched_at);
  return entry.region === region && Number.isFinite(age) && age >= 0 && age < TMDB_TERMS.cacheDays * defaults.time.msPerDay;
}

/** A TMDB image URL (CDN, no key), or null without a path. */
export function imageUrl(path: string | null | undefined, size: string): string | null {
  return path ? `${defaults.tmdb.imageBase}${size}${path}` : null;
}
