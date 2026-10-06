/**
 * Everything the commands need from the outside world, passed in as one object (dependency
 * injection). The browser app builds it with `browserDeps()`; tests build their own with
 * in-memory providers, a fake embedder and no network.
 */
import { loadArtifacts as coreLoadArtifacts } from 'flickpick';
import { createWorkerEmbedder, type Embedder } from '@/embed/client';
import { downloadFile, type SaveFile } from '@/lib/save-file';
import { navigate as routeNavigate, type Route } from '@/route';
import { defaultFetchJson, type FetchJson } from '@/sources/tmdb';
import { createLocalProviders, type Providers } from '@/state/providers';
import { createAppStore, createDataStore, type AppStore, type DataStore } from '@/state/store';

export interface CommandDeps {
  /** The app state (zustand + immer). */
  store: AppStore;
  /** The loaded artifact set. */
  data: DataStore;
  /** Where ratings, settings and the TMDB cache are stored (seam 3). */
  providers: Providers;
  /** Where artifacts come from (seam 1): the core's loader by default. */
  loadArtifacts: (source: string) => ReturnType<typeof coreLoadArtifacts>;
  /** Query embedding (a Web Worker by default). */
  embedder: Embedder;
  /** JSON over HTTP, for TMDB (seam 4). */
  fetchJson: FetchJson;
  navigate: (route: Route) => void;
  saveFile: SaveFile;
  now: () => Date;
}

export function browserDeps(): CommandDeps {
  return {
    store: createAppStore(),
    data: createDataStore(),
    providers: createLocalProviders(),
    loadArtifacts: (source) => coreLoadArtifacts(source),
    embedder: createWorkerEmbedder(),
    fetchJson: defaultFetchJson,
    navigate: (route) => routeNavigate(route),
    saveFile: downloadFile,
    now: () => new Date(),
  };
}
