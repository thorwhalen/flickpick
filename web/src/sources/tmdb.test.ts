import { describe, expect, it } from 'vitest';
import { fetchEnrichment, hasOffers, type FetchJson } from './tmdb';

const provider = (id: number, name: string) => ({ provider_id: id, provider_name: name, logo_path: null });

/** A fake TMDB: one movie, offers in three countries (one with none at all). */
const fetchJson: FetchJson = async (url) => {
  if (url.includes('/find/')) return { movie_results: [{ id: 7 }] };
  return {
    id: 7,
    'watch/providers': {
      results: {
        US: { link: 'https://x/us', flatrate: [provider(8, 'Netflix')] },
        FR: { flatrate: [provider(119, 'Prime Video')], rent: [provider(2, 'Apple TV')] },
        JP: { buy: [provider(3, 'Play')] },
        DE: { flatrate: [], rent: [], buy: [] },
      },
    },
  };
};

describe('fetchEnrichment watch providers', () => {
  it('keeps the region as the default view and every other country with offers', async () => {
    const e = await fetchEnrichment('tt1', { apiKey: 'k', region: 'US', fetchJson });
    expect(e.providers?.flatrate.map((p) => p.provider_name)).toEqual(['Netflix']);
    expect(Object.keys(e.other_regions).sort()).toEqual(['FR', 'JP']);
    expect(e.other_regions.FR?.rent[0]?.provider_name).toBe('Apple TV');
  });

  it('has no other countries when TMDB lists only the region', async () => {
    const only: FetchJson = async (url) =>
      url.includes('/find/') ? { movie_results: [{ id: 7 }] } : { id: 7, 'watch/providers': { results: { US: { flatrate: [provider(8, 'Netflix')] } } } };
    const e = await fetchEnrichment('tt1', { apiKey: 'k', region: 'US', fetchJson: only });
    expect(e.other_regions).toEqual({});
  });

  it('reads cached entries from before this field as having none', async () => {
    const { EnrichmentSchema } = await import('@/state/schemas');
    const old = EnrichmentSchema.parse({ imdb_id: 'tt1', fetched_at: '2026-01-01T00:00:00Z', region: 'US', found: true });
    expect(old.other_regions).toEqual({});
  });
});

describe('hasOffers', () => {
  it('is false for a region with no stream, rent or buy offer', () => {
    expect(hasOffers({ flatrate: [], rent: [], buy: [] })).toBe(false);
    expect(hasOffers({ flatrate: [], rent: [], buy: [provider(3, 'Play')] })).toBe(true);
  });
});
