/**
 * Every user action, declared once as an acture command with a Zod params schema.
 *
 * The UI dispatches these by id (`registry.dispatch(CMD.rateTitle, { item_id, score })`); a
 * command palette, keyboard shortcuts, an in-app assistant or an MCP server can later reach the
 * very same commands without touching the UI. The handlers here are the only code that writes to
 * the app state and to the stores (audit: `rg "setState" src --glob '!src/commands/**'` finds
 * only the store factories).
 *
 * `buildCommands(deps)` takes its dependencies as an argument, so tests run the commands against
 * fresh stores, in-memory providers and a fake embedder.
 */
import { defineCommand, err, ok, type AnyCommandRecord, type Result } from 'acture';
import {
  holdoutEvaluate,
  recommend as coreRecommend,
  resolveRatings,
  type Artifacts,
  type EmbedQuery,
} from 'flickpick';
import { z } from 'zod';
import { defaults } from '@/defaults';
import { previewImport, toFlickpickCsv, toRow } from '@/lib/ratings-io';
import { errorMessage } from '@/lib/utils';
import { parseSetting, settingKeys, SettingsSchema, type SettingKey, type Settings } from '@/settings/schema';
import { fetchEnrichment, isExpired, isFresh } from '@/sources/tmdb';
import { readAll, upsertRow } from '@/state/providers';
import { queryFromForm, RecommendFormSchema, type RecommendForm } from '@/state/recommend-form';
import { EnrichmentSchema, RatingRowSchema, type RatingRow } from '@/state/schemas';
import type { CommandDeps } from './deps';

/** Command ids, named once. */
export const CMD = {
  load: 'app.data.load',
  recommend: 'app.recs.recommend',
  rateTitle: 'app.ratings.rate',
  removeRating: 'app.ratings.remove',
  importRatings: 'app.ratings.import',
  exportRatings: 'app.ratings.export',
  setSetting: 'app.settings.set',
  openMovie: 'app.movie.open',
  enrichMovie: 'app.movie.enrich',
  evaluate: 'app.science.evaluate',
} as const;
export type CommandId = (typeof CMD)[keyof typeof CMD];

const ImdbId = z.string().min(1).describe('Catalogue id, e.g. tt0114369');
const Score = z.number().min(defaults.rating.min).max(defaults.rating.max).describe('Score on the 0-100 scale');

/** What `app.movie.enrich` did. */
type EnrichStatus = 'no_key' | 'in_flight' | 'cached' | 'fetched';

/** Yield to the browser so a loading state paints before synchronous work starts. */
const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export function buildCommands(deps: CommandDeps): AnyCommandRecord[] {
  const { store, data, providers } = deps;
  const state = () => store.getState();
  const artifacts = () => data.getState().artifacts;
  const ratingList = () => Object.values(state().ratings);

  // ------------------------------------------------------------------ helpers (closures over deps)

  /** Read stored settings and ratings once. Invalid stored values decay to the defaults. */
  async function hydrate(): Promise<void> {
    if (state().hydrated) return;
    const [settingsRows, ratingRows] = await Promise.all([readAll(providers.settings), readAll(providers.ratings)]);
    const stored = settingsRows.find((r) => r.id === defaults.storage.settingsRowId);
    const settings = SettingsSchema.safeParse(stored ?? {});
    const ratings = ratingRows.flatMap((r) => {
      const parsed = RatingRowSchema.safeParse(r);
      return parsed.success ? [parsed.data] : [];
    });
    store.setState((s) => {
      s.settings = settings.success ? settings.data : SettingsSchema.parse({});
      s.ratings = Object.fromEntries(ratings.map((r) => [r.item_id, r]));
      s.hydrated = true;
    });
    await purgeExpiredEnrichment();
  }

  /**
   * Delete TMDB cache entries past the terms' limit (180 days). Reading checks freshness too, but
   * an entry nobody looks at again would otherwise stay in storage forever.
   */
  async function purgeExpiredEnrichment(): Promise<void> {
    const now = deps.now();
    const rows = await readAll(providers.enrichment).catch(() => []);
    const expired = rows.flatMap((r) => {
      const parsed = EnrichmentSchema.safeParse(r);
      const id = (r as { imdb_id?: unknown }).imdb_id;
      return typeof id === 'string' && (!parsed.success || isExpired(parsed.data, now)) ? [id] : [];
    });
    if (expired.length) await providers.enrichment.deleteMany(expired).catch(() => undefined);
  }

  /** Map stored title-only ratings onto the newly loaded catalogue, and store the upgrades. */
  async function resolveStored(a: Artifacts): Promise<void> {
    const pending = ratingList().filter((r) => r.needs_resolution);
    if (!pending.length) return;
    const resolved = resolveRatings(pending, a.catalog);
    const upgrades = resolved.flatMap((r, i) => (r.needs_resolution ? [] : [{ from: pending[i]!.item_id, row: toRow(r) }]));
    for (const { from, row } of upgrades) {
      await providers.ratings.delete(from).catch(() => undefined);
      await upsertRow(providers.ratings, row.item_id, row);
    }
    store.setState((s) => {
      for (const { from, row } of upgrades) {
        delete s.ratings[from];
        s.ratings[row.item_id] = row;
      }
    });
  }

  async function loadArtifactSet(): Promise<{ ok: boolean; error?: string }> {
    const source = state().settings.artifactSource;
    store.setState((s) => {
      s.artifacts = { status: 'loading', source, error: null, name: null };
      s.recs = { ...s.recs, status: 'idle', items: [], error: null, warnings: [] };
    });
    data.setState({ artifacts: null });
    try {
      const loaded = await deps.loadArtifacts(source);
      if (state().settings.artifactSource !== source) return { ok: false, error: 'superseded' };
      data.setState({ artifacts: loaded });
      store.setState((s) => {
        s.artifacts = { status: 'ready', source, error: null, name: loaded.manifest.name };
      });
      await resolveStored(loaded);
      return { ok: true };
    } catch (e) {
      const error = errorMessage(e);
      store.setState((s) => {
        s.artifacts = { status: 'error', source, error, name: null };
      });
      return { ok: false, error };
    }
  }

  /** `embedQuery` for the core, reporting model download progress into the store. */
  function embedQueryFor(a: Artifacts): EmbedQuery {
    return async (text) => {
      const info = a.manifest.embedding!;
      if (state().model.status !== 'ready') {
        store.setState((s) => {
          s.model = { status: 'loading', progress: null, error: null };
        });
      }
      try {
        const vector = await deps.embedder.embed(text, info, (fraction) =>
          store.setState((s) => {
            if (s.model.status === 'loading') s.model.progress = fraction;
          }),
        );
        store.setState((s) => {
          s.model = { status: 'ready', progress: 1, error: null };
        });
        return vector;
      } catch (e) {
        store.setState((s) => {
          s.model = { status: 'error', progress: null, error: errorMessage(e) };
        });
        throw e;
      }
    };
  }

  /**
   * Run a recommend query and store the results. `refresh` keeps the current results on screen
   * while the same query is recomputed (after a rating changed), instead of blanking them.
   */
  async function runRecommend(form: RecommendForm, { refresh = false } = {}) {
    const a = artifacts();
    if (!a) return err('no_artifacts', 'The recommender data is not loaded yet.');
    const requestId = state().recs.requestId + 1;
    store.setState((s) => {
      s.recs = {
        status: 'loading',
        query: form,
        items: refresh ? s.recs.items : [],
        error: null,
        warnings: [],
        requestId,
      };
    });
    const warnings: string[] = [];
    const { embeddingEnabled } = state().settings;
    if (form.mood && !embeddingEnabled) warnings.push('Mood search is off in Settings, so the mood was not used.');
    try {
      const items = await coreRecommend(a, ratingList(), queryFromForm(form, { useMood: embeddingEnabled }), {
        embedQuery: embedQueryFor(a),
        onWarning: (w) => warnings.push(w),
      });
      if (state().recs.requestId !== requestId) return ok({ stale: true, items });
      store.setState((s) => {
        s.recs.status = 'ready';
        s.recs.items = items;
        s.recs.warnings = warnings;
      });
      return ok({ stale: false, items });
    } catch (e) {
      if (state().recs.requestId === requestId) {
        store.setState((s) => {
          s.recs.status = 'error';
          s.recs.error = errorMessage(e);
          s.recs.items = [];
        });
      }
      return err('recommend_failed', errorMessage(e));
    }
  }

  /** After the ratings change, recompute the shown results for the same query. */
  async function refreshResults() {
    const query = state().recs.query;
    if (query && artifacts()) await runRecommend(query, { refresh: true });
  }

  const catalogRow = (itemId: string) => {
    const a = artifacts();
    const idx = a?.idToIdx.get(itemId);
    return idx === undefined ? undefined : a!.catalog[idx];
  };

  // ------------------------------------------------------------------ commands

  return [
    defineCommand({
      id: CMD.load,
      title: 'Load data',
      description: 'Read the stored settings and ratings, then load the artifact set from the configured source.',
      category: 'Data',
      execute: async () => {
        await hydrate();
        const result = await loadArtifactSet();
        return result.ok ? ok({ name: state().artifacts.name }) : err('load_failed', result.error ?? 'load failed');
      },
    }),

    defineCommand({
      id: CMD.recommend,
      title: 'Recommend',
      description: 'Recommend unrated titles from your ratings, an optional mood, genre and year filters.',
      category: 'Recommend',
      params: RecommendFormSchema,
      execute: (form) => runRecommend(form),
    }),

    defineCommand({
      id: CMD.rateTitle,
      title: 'Rate a title',
      description: 'Set your score (0-100) for a catalogue title. Re-ranks the shown recommendations.',
      category: 'Ratings',
      params: z.object({ item_id: ImdbId, score: Score }),
      execute: async ({ item_id, score }) => {
        const existing = state().ratings[item_id];
        const item = catalogRow(item_id);
        const row = RatingRowSchema.parse({
          ...existing,
          item_id,
          score,
          title: existing?.title ?? item?.title,
          year: existing?.year ?? item?.year ?? undefined,
          rated_at: deps.now().toISOString(),
        });
        await upsertRow(providers.ratings, item_id, row);
        store.setState((s) => {
          s.ratings[item_id] = row;
        });
        await refreshResults();
        return ok({ rating: row });
      },
    }),

    defineCommand({
      id: CMD.removeRating,
      title: 'Remove a rating',
      description: 'Forget your score for a title.',
      category: 'Ratings',
      params: z.object({ item_id: ImdbId }),
      execute: async ({ item_id }) => {
        if (!state().ratings[item_id]) return err('not_rated', `No rating for ${item_id}`);
        await providers.ratings.delete(item_id);
        store.setState((s) => {
          delete s.ratings[item_id];
        });
        await refreshResults();
        return ok({ item_id });
      },
    }),

    defineCommand({
      id: CMD.importRatings,
      title: 'Import ratings',
      description: 'Import a Letterboxd, IMDb, MovieLens or flickpick ratings CSV.',
      category: 'Ratings',
      params: z.object({
        csv: z.string().min(1).describe('The CSV file contents'),
        mode: z.enum(['merge', 'replace']).default('merge').describe('merge: add and overwrite; replace: drop existing ratings first'),
      }),
      execute: async ({ csv, mode }) => {
        let preview;
        try {
          preview = previewImport(csv, artifacts());
        } catch (e) {
          return err('unrecognised_file', errorMessage(e));
        }
        // Later rows of the same title win, as in the core's scorers.
        const rows = [...new Map(preview.rows.map((r) => [r.item_id, r])).values()];
        if (mode === 'replace') await providers.ratings.deleteMany(Object.keys(state().ratings));
        for (const row of rows) await upsertRow(providers.ratings, row.item_id, row);
        store.setState((s) => {
          if (mode === 'replace') s.ratings = {};
          for (const row of rows) s.ratings[row.item_id] = row;
        });
        await refreshResults();
        return ok({ format: preview.format, imported: rows.length, matched: preview.matched });
      },
    }),

    defineCommand({
      id: CMD.exportRatings,
      title: 'Export ratings',
      description: 'Download your ratings as a flickpick CSV.',
      category: 'Ratings',
      execute: () => {
        const rows = ratingList().sort((x, y) => (x.title ?? x.item_id).localeCompare(y.title ?? y.item_id));
        const csv = toFlickpickCsv(rows, artifacts());
        deps.saveFile(defaults.export.filename, csv, defaults.export.mime);
        return ok({ rows: rows.length, csv });
      },
    }),

    defineCommand({
      id: CMD.setSetting,
      title: 'Change a setting',
      description: 'Set one setting (artifact source, TMDB key, region, mood search).',
      category: 'Settings',
      params: z.object({
        key: z.enum(settingKeys as [SettingKey, ...SettingKey[]]),
        value: z.union([z.string(), z.boolean()]),
      }),
      execute: async ({ key, value }) => {
        const parsed = parseSetting(key, value);
        if (!parsed.ok) return err('invalid_setting', parsed.message);
        const previous = state().settings;
        if (previous[key] === parsed.value) return ok({ key, changed: false });
        const next = { ...previous, [key]: parsed.value } as Settings;
        await upsertRow(providers.settings, defaults.storage.settingsRowId, { ...next, id: defaults.storage.settingsRowId });
        store.setState((s) => {
          s.settings = next;
          // Cached enrichment depends on the key and region; drop the in-memory copies.
          if (key === 'tmdbApiKey' || key === 'region') s.enrichment = {};
        });
        if (key === 'artifactSource') await loadArtifactSet();
        return ok({ key, changed: true });
      },
    }),

    defineCommand({
      id: CMD.openMovie,
      title: 'Open a movie',
      description: 'Show a title: catalogue facts, your rating, neighbours and (with a TMDB key) poster and where to watch.',
      category: 'Navigation',
      params: z.object({ imdb_id: ImdbId }),
      execute: ({ imdb_id }) => {
        deps.navigate({ screen: 'movie', id: imdb_id, params: {} });
        return ok({ imdb_id });
      },
    }),

    defineCommand({
      id: CMD.enrichMovie,
      title: 'Fetch movie details from TMDB',
      description: 'Poster, overview, runtime, certification and watch providers for a title (display only, cached 180 days).',
      category: 'Movie',
      params: z.object({ imdb_id: ImdbId, force: z.boolean().default(false) }),
      execute: async ({ imdb_id, force }): Promise<Result<{ status: EnrichStatus }>> => {
        const { tmdbApiKey, region } = state().settings;
        if (!tmdbApiKey) return ok({ status: 'no_key' });
        const current = state().enrichment[imdb_id];
        if (current?.status === 'loading') return ok({ status: 'in_flight' });
        const now = deps.now();
        if (!force && current?.status === 'ready' && current.data && isFresh(current.data, { now, region })) {
          return ok({ status: 'cached' });
        }
        const set = (entry: (typeof current) & object) =>
          store.setState((s) => {
            s.enrichment[imdb_id] = entry;
          });
        if (!force) {
          const stored = await providers.enrichment.getOne(imdb_id).catch(() => null);
          const parsed = stored ? EnrichmentSchema.safeParse(stored) : null;
          if (parsed?.success && isFresh(parsed.data, { now, region })) {
            set({ status: 'ready', data: parsed.data, error: null });
            return ok({ status: 'cached' });
          }
        }
        set({ status: 'loading', data: current?.data ?? null, error: null });
        try {
          // seam candidate: the enrichment provider. Only TMDB exists; Movie of the Night or
          // MDBList would be a second module behind one argument (docs/architecture.md).
          const enrichment = await fetchEnrichment(imdb_id, {
            apiKey: tmdbApiKey,
            region,
            tmdbId: catalogRow(imdb_id)?.tmdb_id ?? null,
            fetchJson: deps.fetchJson,
            now: deps.now,
          });
          await upsertRow(providers.enrichment, imdb_id, enrichment);
          set({ status: 'ready', data: enrichment, error: null });
          return ok({ status: 'fetched' });
        } catch (e) {
          set({ status: 'error', data: null, error: errorMessage(e) });
          return err('tmdb_failed', errorMessage(e));
        }
      },
    }),

    defineCommand({
      id: CMD.evaluate,
      title: 'Evaluate the recommender on my ratings',
      description: 'k-fold hold-out over your liked titles: hit rate, recall, NDCG and precision at k with bootstrap intervals.',
      category: 'Science',
      execute: async () => {
        const a = artifacts();
        if (!a) return err('no_artifacts', 'The recommender data is not loaded yet.');
        store.setState((s) => {
          s.evaluation = { status: 'loading', result: null, error: null };
        });
        await nextFrame();
        try {
          const result = holdoutEvaluate(a, ratingList());
          store.setState((s) => {
            s.evaluation = { status: 'ready', result, error: null };
          });
          return ok({ mean: result.mean });
        } catch (e) {
          store.setState((s) => {
            s.evaluation = { status: 'error', result: null, error: errorMessage(e) };
          });
          return err('evaluate_failed', errorMessage(e));
        }
      },
    }),
  ];
}

export type { RatingRow };
