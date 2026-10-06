/** loadArtifacts: round trip from a directory, a file:// URL and a fetched URL base; validation errors. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bytesToTypedArray, loadArtifacts } from '../src/index.js';
import { DIM, N_ITEMS, imdbId, syntheticCsr, syntheticEmbeddings, writeSyntheticArtifacts } from './helpers/synthetic.js';

describe('loadArtifacts', () => {
  it('round-trips the synthetic set from a directory', async () => {
    const a = await loadArtifacts(await writeSyntheticArtifacts());
    const csr = syntheticCsr();
    expect(a.manifest.n_items).toBe(N_ITEMS);
    expect(a.catalog).toHaveLength(N_ITEMS);
    expect([...a.cf.indptr]).toEqual(csr.indptr);
    expect([...a.cf.indices]).toEqual(csr.indices);
    expect([...a.cf.values]).toEqual([...Float32Array.from(csr.values)]);
    expect(a.embeddings).toEqual(syntheticEmbeddings());
    expect(a.embeddings).toHaveLength(N_ITEMS * DIM);
    expect(a.idToIdx.get(imdbId(5))).toBe(5);
  });

  it('loads from a file:// URL and works without embeddings', async () => {
    const dir = await writeSyntheticArtifacts({ withEmbeddings: false });
    const a = await loadArtifacts(pathToFileURL(dir));
    expect(a.embeddings).toBeUndefined();
    expect(a.manifest.embedding).toBeNull();
  });

  it('loads from a URL base with an injected fetch', async () => {
    const dir = await writeSyntheticArtifacts();
    const requested: string[] = [];
    const fetchImpl = (async (url: string) => {
      requested.push(url);
      const file = url.replace('https://data.example/set/', '');
      try {
        return new Response(await readFile(join(dir, file)));
      } catch {
        return new Response('nope', { status: 404, statusText: 'Not Found' });
      }
    }) as unknown as typeof fetch;
    const a = await loadArtifacts('https://data.example/set/', { fetchImpl });
    expect(a.catalog[3]!.title).toBe('Movie 3');
    expect(requested).toContain('https://data.example/set/cf_values.f32');
    await expect(loadArtifacts('https://data.example/missing', { fetchImpl })).rejects.toThrow(/HTTP 404/);
  });

  it('rejects a set whose shapes disagree with the manifest', async () => {
    const dir = await writeSyntheticArtifacts({ patchManifest: (m) => (m.n_items = 11) });
    await expect(loadArtifacts(dir)).rejects.toThrow(/catalog has 12 rows, manifest says n_items=11/);
  });

  it('rejects an invalid manifest and a missing directory with a readable error', async () => {
    const dir = await writeSyntheticArtifacts({ patchManifest: (m) => (m.format_version = 2) });
    await expect(loadArtifacts(dir)).rejects.toThrow(/invalid manifest[\s\S]*format_version/);
    await expect(loadArtifacts(join(dir, 'nope'))).rejects.toThrow(/missing file .*manifest\.json/);
  });
});

describe('bytesToTypedArray', () => {
  it('handles a misaligned byte offset (pooled Buffer slices)', () => {
    const backing = new Uint8Array(9);
    new DataView(backing.buffer).setFloat32(1, 1.5, true);
    new DataView(backing.buffer).setFloat32(5, -2, true);
    const misaligned = backing.subarray(1);
    expect([...bytesToTypedArray(misaligned, Float32Array)]).toEqual([1.5, -2]);
  });

  it('views aligned bytes without copying and rejects ragged lengths', () => {
    const ints = new Int32Array([7, -3, 42]);
    const view = bytesToTypedArray(new Uint8Array(ints.buffer), Int32Array);
    expect(view.buffer).toBe(ints.buffer);
    expect([...view]).toEqual([7, -3, 42]);
    expect(() => bytesToTypedArray(new Uint8Array(5), Int32Array, 'x.i32')).toThrow(/x\.i32: 5 bytes/);
  });
});
