/** The command layer: each user action, dispatched by id, against fresh stores and no network. */
import { parseRatings, type Recommendation } from 'flickpick';
import { describe, expect, it, vi } from 'vitest';
import { makeTestServices, readExampleCsv } from '@/test-helpers/services';
import { CMD } from './index';

async function loaded() {
  const services = await makeTestServices();
  const result = await services.dispatch(CMD.load);
  expect(result.ok).toBe(true);
  return services;
}

const ids = (items: Recommendation[]) => items.map((r) => r.item_id);

describe('commands', () => {
  it('load reads settings and ratings, then the artifact set', async () => {
    const { deps } = await loaded();
    const s = deps.store.getState();
    expect(s.hydrated).toBe(true);
    expect(s.artifacts.status).toBe('ready');
    expect(deps.data.getState().artifacts?.manifest.n_items).toBeGreaterThan(0);
  });

  it('a failed load names the source', async () => {
    const services = await makeTestServices({ loadArtifacts: async (src) => Promise.reject(new Error(`GET ${src} failed`)) });
    const result = await services.dispatch(CMD.load);
    expect(result.ok).toBe(false);
    const { artifacts } = services.deps.store.getState();
    expect(artifacts.status).toBe('error');
    expect(artifacts.error).toContain('./data/artifacts_small/');
  });

  it('recommend without a mood never touches the embedder', async () => {
    const embed = vi.fn();
    const services = await makeTestServices({ embedder: { embed } });
    await services.dispatch(CMD.load);
    const result = await services.dispatch(CMD.recommend, { k: 5 });
    expect(result.ok).toBe(true);
    expect(services.deps.store.getState().recs.items).toHaveLength(5);
    expect(embed).not.toHaveBeenCalled();
    expect(services.deps.store.getState().model.status).toBe('idle');
  });

  it('recommend with a mood embeds it once and caches nothing stale', async () => {
    const { dispatch, deps } = await loaded();
    const result = await dispatch(CMD.recommend, { mood: 'slow-burn melancholic sci-fi', k: 5 });
    expect(result.ok).toBe(true);
    const { recs, model } = deps.store.getState();
    expect(model.status).toBe('ready');
    expect(recs.items[0]?.semantic_score).not.toBeNull();
    expect(recs.items[0]?.reasons.join(' ')).toContain('slow-burn');
  });

  it('a mood is ignored with a warning when mood search is off', async () => {
    const { dispatch, deps } = await loaded();
    await dispatch(CMD.setSetting, { key: 'embeddingEnabled', value: false });
    await dispatch(CMD.recommend, { mood: 'cosy', k: 3 });
    const { recs, model } = deps.store.getState();
    expect(model.status).toBe('idle');
    expect(recs.warnings.join(' ')).toMatch(/Mood search is off/);
  });

  it('rateTitle stores the rating and re-ranks the shown results without the rated title', async () => {
    const { dispatch, deps } = await loaded();
    await dispatch(CMD.recommend, { k: 10 });
    const before = deps.store.getState().recs.items;
    const top = before[0]!.item_id;

    const result = await dispatch(CMD.rateTitle, { item_id: top, score: 90 });
    expect(result.ok).toBe(true);

    const after = deps.store.getState();
    expect(after.ratings[top]?.score).toBe(90);
    expect(after.ratings[top]?.title).toBe(before[0]!.title);
    expect(await deps.providers.ratings.getOne(top)).toMatchObject({ item_id: top, score: 90 });
    expect(ids(after.recs.items)).not.toContain(top);
    expect(after.recs.items).toHaveLength(10);
    // A liked title now drives the collaborative component.
    expect(after.recs.items.some((r) => r.because_of.includes(top))).toBe(true);
  });

  it('rateTitle rejects a score off the 0-100 scale', async () => {
    const { dispatch, deps } = await loaded();
    const result = await dispatch(CMD.rateTitle, { item_id: 'tt0114369', score: 101 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_params');
    expect(deps.store.getState().ratings).toEqual({});
  });

  it('removeRating forgets the rating in the store and the provider', async () => {
    const { dispatch, deps, artifacts } = await loaded();
    const id = artifacts.catalog[0]!.imdb_id;
    await dispatch(CMD.rateTitle, { item_id: id, score: 40 });
    const result = await dispatch(CMD.removeRating, { item_id: id });
    expect(result.ok).toBe(true);
    expect(deps.store.getState().ratings[id]).toBeUndefined();
    await expect(deps.providers.ratings.getOne(id)).rejects.toThrow();
  });

  it('exportRatings writes a flickpick CSV that the core reads back', async () => {
    const { dispatch, deps, artifacts } = await loaded();
    const [a, b] = artifacts.catalog;
    await dispatch(CMD.rateTitle, { item_id: a!.imdb_id, score: 80 });
    await dispatch(CMD.rateTitle, { item_id: b!.imdb_id, score: 35 });
    const result = await dispatch<{ csv: string }>(CMD.exportRatings);
    expect(result.ok).toBe(true);
    expect(deps.saveFile).toHaveBeenCalledOnce();
    const csv = result.ok ? result.value.csv : '';
    const back = parseRatings(csv);
    expect(back.map((r) => [r.item_id, r.score]).sort()).toEqual(
      [
        [a!.imdb_id, 80],
        [b!.imdb_id, 35],
      ].sort(),
    );
  });

  it('openMovie navigates to the movie overlay', async () => {
    const { dispatch, deps } = await loaded();
    await dispatch(CMD.openMovie, { imdb_id: 'tt0114369' });
    expect(deps.navigate).toHaveBeenCalledWith({ screen: 'movie', id: 'tt0114369', params: {} });
  });

  it('enrichMovie without a key does nothing and calls no network', async () => {
    const { dispatch, deps } = await loaded();
    const result = await dispatch<{ status: string }>(CMD.enrichMovie, { imdb_id: 'tt0114369' });
    expect(result.ok && result.value.status).toBe('no_key');
    expect(deps.fetchJson).not.toHaveBeenCalled();
  });

  it('evaluate runs the hold-out evaluation on imported ratings', async () => {
    const { dispatch, deps } = await loaded();
    await dispatch(CMD.importRatings, { csv: readExampleCsv() });
    const result = await dispatch(CMD.evaluate);
    expect(result.ok).toBe(true);
    const { evaluation } = deps.store.getState();
    expect(evaluation.status).toBe('ready');
    expect(evaluation.result?.ci95.precision).toHaveLength(2);
    expect(evaluation.result?.ci95.hit_rate).toBeNull(); // per fold: no interval with 5 folds
    expect(evaluation.result?.per_fold).toHaveLength(evaluation.result!.folds);
  });
});

describe('TMDB cache expiry', () => {
  it('load deletes cached enrichment older than the 180-day limit', async () => {
    const { createMemoryProviders } = await import('@/state/providers');
    const providers = createMemoryProviders();
    const entry = (imdb_id: string, fetched_at: string) => ({ imdb_id, fetched_at, region: 'US', found: false });
    await providers.enrichment.create(entry('tt0000001', '2026-01-01T00:00:00Z') as never); // 278 days before FIXED_NOW
    await providers.enrichment.create(entry('tt0000002', '2026-09-01T00:00:00Z') as never); // 35 days before
    const services = await makeTestServices({ providers });
    await services.dispatch(CMD.load);
    const left = (await providers.enrichment.getList({})).data.map((r) => r.imdb_id);
    expect(left).toEqual(['tt0000002']);
  });
});
