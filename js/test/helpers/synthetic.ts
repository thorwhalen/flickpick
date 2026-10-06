/**
 * Test helper: write a tiny synthetic artifact set (12 items, dim 4) to a temp dir in the exact
 * binary format of docs/artifact-format.md (little-endian, row-major, no header).
 *
 * The EASE matrix B (row -> [col, weight], rows sorted by descending weight):
 *   0: 1:0.5 2:0.3 5:-0.1    1: 0:0.4 2:0.2 3:0.1    2: 4:0.6 1:0.25    3: 6:0.7
 *   5: 7:0.9 8:0.2           6: 9:0.3                8: 10:0.1          10: 11:0.5
 * Item j: imdb_id tt000000(j+1), year 1990+j, n_ratings 10(j+1), mean_rating 50+3j, ml_id 100+j,
 * genres by j%3: Drama | Horror,Thriller | Comedy,Drama; embedding (cos θj, sin θj, 0, 0), θj = jπ/12.
 */
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const N_ITEMS = 12;
export const DIM = 4;

export const B_ROWS: [number, number][][] = [
  [[1, 0.5], [2, 0.3], [5, -0.1]],
  [[0, 0.4], [2, 0.2], [3, 0.1]],
  [[4, 0.6], [1, 0.25]],
  [[6, 0.7]],
  [],
  [[7, 0.9], [8, 0.2]],
  [[9, 0.3]],
  [],
  [[10, 0.1]],
  [],
  [[11, 0.5]],
  [],
];

const GENRES = [['Drama'], ['Horror', 'Thriller'], ['Comedy', 'Drama']];

export const imdbId = (j: number) => `tt${String(j + 1).padStart(7, '0')}`;

export function syntheticCatalog() {
  return Array.from({ length: N_ITEMS }, (_, j) => ({
    idx: j,
    imdb_id: imdbId(j),
    tmdb_id: 1000 + j,
    ml_id: 100 + j,
    qid: null,
    title: `Movie ${j}`,
    year: 1990 + j,
    genres: GENRES[j % 3]!,
    n_ratings: 10 * (j + 1),
    mean_rating: 50 + 3 * j,
    semantic_text: GENRES[j % 3]!.join(' '),
  }));
}

export function syntheticEmbeddings(): Float32Array {
  const out = new Float32Array(N_ITEMS * DIM);
  for (let j = 0; j < N_ITEMS; j++) {
    const theta = (j * Math.PI) / 12;
    out[j * DIM] = Math.cos(theta);
    out[j * DIM + 1] = Math.sin(theta);
  }
  return out;
}

/** Little-endian bytes, written element by element so the host's endianness does not matter. */
function leBytes(values: ArrayLike<number>, kind: 'i32' | 'f32'): Uint8Array {
  const buf = new ArrayBuffer(values.length * 4);
  const dv = new DataView(buf);
  for (let i = 0; i < values.length; i++) {
    if (kind === 'i32') dv.setInt32(i * 4, values[i]!, true);
    else dv.setFloat32(i * 4, values[i]!, true);
  }
  return new Uint8Array(buf);
}

export function syntheticCsr() {
  const indptr = [0];
  const indices: number[] = [];
  const values: number[] = [];
  for (const row of B_ROWS) {
    for (const [c, w] of row) {
      indices.push(c);
      values.push(w);
    }
    indptr.push(indices.length);
  }
  return { indptr, indices, values };
}

export interface WriteOptions {
  withEmbeddings?: boolean;
  /** Patch the manifest before writing (for error tests). */
  patchManifest?: (m: Record<string, unknown>) => void;
}

/** Write the set to a fresh temp dir and return its path. */
export async function writeSyntheticArtifacts({ withEmbeddings = true, patchManifest }: WriteOptions = {}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'flickpick-artifacts-'));
  const { indptr, indices, values } = syntheticCsr();
  const nnz = indices.length;
  const manifest: Record<string, unknown> = {
    format_version: 1,
    built_at: '2026-10-06T00:00:00Z',
    name: 'synthetic-12',
    n_items: N_ITEMS,
    sources: [{ name: 'synthetic', version: '0', licence: 'CC0', url: 'https://example.org' }],
    cf: { method: 'ease', topk: 3, lambda: 100, n_train_users: 0, n_train_ratings: 0, like_threshold: 70 },
    embedding: withEmbeddings
      ? { model: 'BAAI/bge-small-en-v1.5', dim: DIM, dtype: 'float32', query_prefix: '', text_field: 'semantic_text' }
      : null,
    files: {
      cf_indptr: { path: 'cf_indptr.i32', dtype: 'int32', shape: [N_ITEMS + 1] },
      cf_indices: { path: 'cf_indices.i32', dtype: 'int32', shape: [nnz] },
      cf_values: { path: 'cf_values.f32', dtype: 'float32', shape: [nnz] },
      ...(withEmbeddings ? { embeddings: { path: 'embeddings.f32', dtype: 'float32', shape: [N_ITEMS, DIM] } } : {}),
    },
  };
  patchManifest?.(manifest);
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await writeFile(join(dir, 'catalog.json'), JSON.stringify(syntheticCatalog()));
  await writeFile(join(dir, 'cf_indptr.i32'), leBytes(indptr, 'i32'));
  await writeFile(join(dir, 'cf_indices.i32'), leBytes(indices, 'i32'));
  await writeFile(join(dir, 'cf_values.f32'), leBytes(values, 'f32'));
  if (withEmbeddings) await writeFile(join(dir, 'embeddings.f32'), leBytes(syntheticEmbeddings(), 'f32'));
  return dir;
}

/** A ratings CSV in flickpick format for items (by row index) with the given scores. */
export function flickpickCsv(rows: [number, number][]): string {
  const lines = rows.map(([j, s]) => `${100 + j},${j + 1},${1000 + j},${s},${50 + 3 * j},Movie ${j} (${1990 + j})`);
  return ['movie_id,imdb_id,tmdb_id,rating,average_rating,title', ...lines].join('\n') + '\n';
}
