/**
 * Test wiring: fresh services over the repo's fixture artifact set, in-memory providers, a fake
 * embedder and no network. Every test gets its own stores.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadArtifacts, type Artifacts, type EmbeddingInfo } from 'flickpick';
import { vi } from 'vitest';
import type { CommandDeps } from '@/commands/deps';
import { createServices } from '@/commands/registry';
import type { Embedder } from '@/embed/client';
import { createMemoryProviders } from '@/state/providers';
import { createAppStore, createDataStore } from '@/state/store';

// vitest runs from web/ (in jsdom, import.meta.url is not a file: URL, so use the cwd).
const repoRoot = `${resolve(process.cwd(), '..')}/`;
export const FIXTURE_DIR = `${repoRoot}tests/fixtures/artifacts_small`;
export const EXAMPLE_CSV_PATH = `${repoRoot}flickpick/data/examples/movie_ratings_various.csv`;
export const readExampleCsv = () => readFileSync(EXAMPLE_CSV_PATH, 'utf8');

let fixture: Promise<Artifacts> | null = null;
/** The fixture artifact set, loaded once per test file (read-only, so sharing is safe). */
export const fixtureArtifacts = () => (fixture ??= loadArtifacts(FIXTURE_DIR));

/** An embedder that returns a catalogue item's own vector (so mood scores are real cosines). */
export function fakeEmbedder(artifacts: Artifacts, itemIdx = 0): Embedder & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async embed(text: string, info: EmbeddingInfo, onProgress) {
      calls.push(text);
      onProgress?.(1);
      const dim = info.dim;
      return artifacts.embeddings!.slice(itemIdx * dim, (itemIdx + 1) * dim);
    },
  };
}

export const FIXED_NOW = new Date('2026-10-06T12:00:00Z');

export async function makeTestServices(overrides: Partial<CommandDeps> = {}) {
  const artifacts = await fixtureArtifacts();
  const deps: CommandDeps = {
    store: createAppStore(),
    data: createDataStore(),
    providers: createMemoryProviders(),
    loadArtifacts: async () => artifacts,
    embedder: fakeEmbedder(artifacts),
    fetchJson: vi.fn(async () => {
      throw new Error('no network in tests');
    }),
    navigate: vi.fn(),
    saveFile: vi.fn(),
    now: () => FIXED_NOW,
    ...overrides,
  };
  return { ...createServices(deps), artifacts };
}
