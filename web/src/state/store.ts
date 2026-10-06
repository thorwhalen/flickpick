/**
 * The app's state: one zustand store mutated through immer, plus a small holder for the loaded
 * artifact set.
 *
 * Why two stores: the artifact set is large typed arrays plus a `Map`, loaded once and never
 * edited. Immer freezes everything it produces and cannot draft a `Map` without a plugin, so the
 * artifacts live in a plain zustand store (`DataStore`) and the immer store only records their
 * status. Everything in `AppState` is JSON-safe.
 *
 * Only the command handlers in `commands/` write to these stores (the command-dispatch rule);
 * components read them with selectors (`useApp`, `useArtifacts` in `state/hooks.ts`).
 */
import type { Artifacts, HoldoutResult, Recommendation } from 'flickpick';
import { immer } from 'zustand/middleware/immer';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { defaultSettings, type Settings } from '@/settings/schema';
import type { Enrichment, RatingRow } from './schemas';
import type { RecommendForm } from './recommend-form';

/** The four states every async thing in the UI goes through. */
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface EnrichmentEntry {
  status: LoadStatus;
  data: Enrichment | null;
  error: string | null;
}

export interface AppState {
  /** False until the stored settings and ratings have been read once. */
  hydrated: boolean;
  settings: Settings;
  /** Ratings by `item_id` (a record, not a Map, so immer and JSON handle it). */
  ratings: Record<string, RatingRow>;
  artifacts: { status: LoadStatus; source: string; error: string | null; name: string | null };
  recs: {
    status: LoadStatus;
    /** The query the shown results answer (re-run after a rating changes). */
    query: RecommendForm | null;
    items: Recommendation[];
    error: string | null;
    /** Non-fatal notices from the core (e.g. a mood ignored for lack of embeddings). */
    warnings: string[];
    /** Increments per request; a slower, older request never overwrites a newer one. */
    requestId: number;
  };
  /** The query-embedding model (downloaded on the first mood query). */
  model: { status: LoadStatus; progress: number | null; error: string | null };
  /** TMDB enrichment by `imdb_id` (display only). */
  enrichment: Record<string, EnrichmentEntry>;
  evaluation: { status: LoadStatus; result: HoldoutResult | null; error: string | null };
}

export const initialAppState = (): AppState => ({
  hydrated: false,
  settings: defaultSettings(),
  ratings: {},
  artifacts: { status: 'idle', source: '', error: null, name: null },
  recs: { status: 'idle', query: null, items: [], error: null, warnings: [], requestId: 0 },
  model: { status: 'idle', progress: null, error: null },
  enrichment: {},
  evaluation: { status: 'idle', result: null, error: null },
});

/**
 * A zustand store whose `setState` takes an immer recipe: `store.setState((draft) => { ... })`
 * mutates a draft and immer produces the next immutable state.
 */
export type AppStore = ReturnType<typeof createAppStore>;
export const createAppStore = (initial: AppState = initialAppState()) =>
  createStore<AppState>()(immer(() => initial));

export interface DataState {
  artifacts: Artifacts | null;
}
export type DataStore = StoreApi<DataState>;
export const createDataStore = (): DataStore => createStore<DataState>()(() => ({ artifacts: null }));
