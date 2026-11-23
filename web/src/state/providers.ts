/**
 * Where the user's data lives: one zodal `DataProvider` per collection (seam 3).
 *
 * The v1 default is `@zodal/store-localstorage` (this browser only). Swapping in
 * `@zodal/store-http` against a sync service, or an in-memory provider in tests, changes this
 * file's factory and nothing else: commands talk to the `DataProvider` interface only, and no
 * component touches `localStorage`.
 */
import type { DataProvider } from '@zodal/store';
import { createInMemoryProvider } from '@zodal/store';
import { createLocalStorageProvider } from '@zodal/store-localstorage';
import { defaults } from '@/defaults';
import type { Enrichment, ListEntry, RatingRow, SavedSearch, SettingsRow } from './schemas';

export interface Providers {
  ratings: DataProvider<RatingRow>;
  settings: DataProvider<SettingsRow>;
  enrichment: DataProvider<Enrichment>;
  /** Watchlist and not-interested entries. */
  lists: DataProvider<ListEntry>;
  /** Saved searches (named Recommend forms). */
  searches: DataProvider<SavedSearch>;
}

/** The browser default: everything in this browser's localStorage. */
export function createLocalProviders(): Providers {
  const { ratingsKey, settingsKey, enrichmentKey, listsKey, searchesKey } = defaults.storage;
  return {
    ratings: createLocalStorageProvider<RatingRow>({ storageKey: ratingsKey, idField: 'item_id', searchFields: ['title'] }),
    settings: createLocalStorageProvider<SettingsRow>({ storageKey: settingsKey, idField: 'id' }),
    enrichment: createLocalStorageProvider<Enrichment>({ storageKey: enrichmentKey, idField: 'imdb_id' }),
    lists: createLocalStorageProvider<ListEntry>({ storageKey: listsKey, idField: 'item_id' }),
    searches: createLocalStorageProvider<SavedSearch>({ storageKey: searchesKey, idField: 'id' }),
  };
}

/** In-memory providers (tests, or a "private window" mode). */
export function createMemoryProviders(seed: { ratings?: RatingRow[]; settings?: SettingsRow[] } = {}): Providers {
  return {
    ratings: createInMemoryProvider<RatingRow>(seed.ratings ?? [], { idField: 'item_id' }),
    settings: createInMemoryProvider<SettingsRow>(seed.settings ?? [], { idField: 'id' }),
    enrichment: createInMemoryProvider<Enrichment>([], { idField: 'imdb_id' }),
    lists: createInMemoryProvider<ListEntry>([], { idField: 'item_id' }),
    searches: createInMemoryProvider<SavedSearch>([], { idField: 'id' }),
  };
}

/** Every row of a provider (the collections here are small enough to read whole). */
export async function readAll<T>(provider: DataProvider<T>): Promise<T[]> {
  return (await provider.getList({})).data;
}

/** Create or replace a row (falls back to update/create when the provider has no `upsert`). */
export async function upsertRow<T extends Record<string, unknown>>(provider: DataProvider<T>, id: string, row: T): Promise<void> {
  if (provider.upsert) {
    await provider.upsert(row);
    return;
  }
  try {
    await provider.update(id, row);
  } catch {
    await provider.create(row);
  }
}
