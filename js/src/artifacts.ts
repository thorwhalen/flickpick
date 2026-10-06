/**
 * Load an artifact set (docs/artifact-format.md) from a URL base or a local directory.
 *
 * This is seam 1 of the architecture: where artifacts come from. A URL (`http(s)://`, or any
 * string when there is no Node runtime, e.g. a relative `data/` in the browser) is read with
 * `fetch`; a filesystem path or `file://` URL in Node is read with `node:fs/promises`, loaded
 * through a dynamic import whose specifier bundlers cannot see, so a browser bundle never
 * references it. Binary files are little-endian typed arrays; shapes are checked against the
 * manifest and against each other before anything is returned.
 */
import { defaults } from './defaults.js';
import {
  CatalogItemSchema,
  ManifestSchema,
  type Artifacts,
  type CatalogItem,
  type CsrMatrix,
  type Manifest,
} from './types.js';

export interface LoadArtifactsOptions {
  /** `fetch` to use for URL sources (defaults to the global one). */
  fetchImpl?: typeof fetch;
  /** Validate every catalogue row with Zod (on by default; turn off for very large catalogues). */
  validateCatalog?: boolean;
}

/** Reads one file of the set, by its path relative to the set's root. */
type Reader = {
  bytes: (path: string) => Promise<Uint8Array>;
  text: (path: string) => Promise<string>;
  describe: (path: string) => string;
};

type TypedArrayCtor = Int32ArrayConstructor | Float32ArrayConstructor;
type FileKey = keyof typeof defaults.artifacts.files;

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const FILE_SCHEME = /^file:\/\//i;

/** Load and validate an artifact set. `source` is a URL base or (in Node) a directory path. */
export async function loadArtifacts(
  source: string | URL,
  options: LoadArtifactsOptions = {},
): Promise<Artifacts> {
  const { validateCatalog = true } = options;
  const reader = await makeReader(source, options);
  const { manifestFile, catalogFile } = defaults.artifacts;

  const manifest = parseManifest(await readJson(reader, manifestFile), reader.describe(manifestFile));
  const catalogRaw = await readJson(reader, catalogFile);
  const catalog = parseCatalog(catalogRaw, { validate: validateCatalog, where: reader.describe(catalogFile) });

  const readArray = async (key: FileKey, ctor: TypedArrayCtor) => {
    const path = filePath(manifest, key);
    return { path, array: bytesToTypedArray(await reader.bytes(path), ctor, reader.describe(path)) };
  };
  const [indptr, indices, values] = await Promise.all([
    readArray('cf_indptr', Int32Array),
    readArray('cf_indices', Int32Array),
    readArray('cf_values', Float32Array),
  ]);
  const embeddings = manifest.embedding ? await readArray('embeddings', Float32Array) : undefined;

  const cf: CsrMatrix = {
    indptr: indptr.array as Int32Array,
    indices: indices.array as Int32Array,
    values: values.array as Float32Array,
  };
  const artifacts: Artifacts = {
    manifest,
    catalog,
    cf,
    idToIdx: buildIdToIdx(catalog),
    ...(embeddings ? { embeddings: embeddings.array as Float32Array } : {}),
  };
  validateShapes(artifacts, [indptr, indices, values, ...(embeddings ? [embeddings] : [])]);
  return artifacts;
}

/** `imdb_id` -> row index; throws on duplicate ids. */
export function buildIdToIdx(catalog: readonly CatalogItem[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of catalog) {
    if (map.has(item.imdb_id)) {
      throw new Error(`catalog.json: duplicate imdb_id ${item.imdb_id} at idx ${map.get(item.imdb_id)} and ${item.idx}`);
    }
    map.set(item.imdb_id, item.idx);
  }
  return map;
}

/**
 * View raw little-endian bytes as a typed array. Copies only when the bytes are misaligned
 * (e.g. a Node `Buffer` sliced from a shared pool) or when the host is big-endian.
 */
export function bytesToTypedArray<C extends TypedArrayCtor>(
  bytes: Uint8Array | ArrayBuffer,
  ctor: C,
  where = 'buffer',
): InstanceType<C> {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const width = ctor.BYTES_PER_ELEMENT;
  if (view.byteLength % width !== 0) {
    throw new Error(`${where}: ${view.byteLength} bytes is not a multiple of ${width} (${ctor.name})`);
  }
  const length = view.byteLength / width;
  if (!HOST_IS_LITTLE_ENDIAN) return decodeLittleEndian(view, ctor, length) as InstanceType<C>;
  if (view.byteOffset % width === 0) {
    return new ctor(view.buffer as ArrayBuffer, view.byteOffset, length) as InstanceType<C>;
  }
  return new ctor(view.slice().buffer as ArrayBuffer) as InstanceType<C>;
}

const HOST_IS_LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

function decodeLittleEndian(view: Uint8Array, ctor: TypedArrayCtor, length: number) {
  const dv = new DataView(view.buffer, view.byteOffset, view.byteLength);
  const out = new ctor(length);
  const width = ctor.BYTES_PER_ELEMENT;
  const get = ctor === Int32Array ? (o: number) => dv.getInt32(o, true) : (o: number) => dv.getFloat32(o, true);
  for (let i = 0; i < length; i++) out[i] = get(i * width);
  return out;
}

/** The file path for a logical key: the manifest's `files[key].path`, else the default name. */
function filePath(manifest: Manifest, key: FileKey): string {
  const fallback = defaults.artifacts.files[key];
  const byKey = manifest.files[key]?.path;
  if (byKey) return byKey;
  const byName = Object.values(manifest.files).find((f) => f.path === fallback || f.path.endsWith(`/${fallback}`));
  return byName?.path ?? fallback;
}

function parseManifest(raw: unknown, where: string): Manifest {
  const result = ManifestSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`${where}: invalid manifest:\n${formatIssues(result.error.issues)}`);
  }
  return result.data;
}

function parseCatalog(raw: unknown, { validate, where }: { validate: boolean; where: string }): CatalogItem[] {
  if (!Array.isArray(raw)) throw new Error(`${where}: expected a JSON array, got ${typeof raw}`);
  if (!validate) return raw as CatalogItem[];
  return raw.map((row, i) => {
    const result = CatalogItemSchema.safeParse(row);
    if (!result.success) throw new Error(`${where}: invalid row ${i}:\n${formatIssues(result.error.issues)}`);
    return result.data;
  });
}

function formatIssues(issues: readonly { path: PropertyKey[]; message: string }[]): string {
  return issues.map((i) => `  - ${i.path.map(String).join('.') || '(root)'}: ${i.message}`).join('\n');
}

/** Check every array against the manifest and the CSR invariants. */
function validateShapes(a: Artifacts, files: { path: string; array: ArrayLike<number> }[]): void {
  const n = a.manifest.n_items;
  const fail = (msg: string): never => {
    throw new Error(`artifact set "${a.manifest.name}": ${msg}`);
  };
  if (a.catalog.length !== n) fail(`catalog has ${a.catalog.length} rows, manifest says n_items=${n}`);
  a.catalog.forEach((item, i) => {
    if (item.idx !== i) fail(`catalog row ${i} has idx=${item.idx}; rows must be in idx order`);
  });

  for (const { path, array } of files) {
    const declared = Object.values(a.manifest.files).find((f) => f.path === path)?.shape;
    if (declared && declared.reduce((x, y) => x * y, 1) !== array.length) {
      fail(`${path} has ${array.length} values, manifest shape is [${declared.join(', ')}]`);
    }
  }

  const { indptr, indices, values } = a.cf;
  if (indptr.length !== n + 1) fail(`cf_indptr has ${indptr.length} entries, expected n_items+1=${n + 1}`);
  const nnz = indptr[n] ?? 0;
  if (indptr[0] !== 0) fail(`cf_indptr[0] must be 0, got ${indptr[0]}`);
  if (indices.length !== nnz || values.length !== nnz) {
    fail(`cf_indptr[n]=${nnz} but cf_indices has ${indices.length} and cf_values has ${values.length} entries`);
  }
  for (let r = 0; r < n; r++) {
    if ((indptr[r + 1] ?? 0) < (indptr[r] ?? 0)) fail(`cf_indptr is decreasing at row ${r}`);
  }
  for (let p = 0; p < nnz; p++) {
    const c = indices[p] ?? -1;
    if (c < 0 || c >= n) fail(`cf_indices[${p}]=${c} is out of range [0, ${n})`);
  }

  if (a.manifest.embedding) {
    const expected = n * a.manifest.embedding.dim;
    const got = a.embeddings?.length ?? 0;
    if (got !== expected) fail(`embeddings has ${got} values, expected n_items*dim=${expected}`);
  }
}

async function readJson(reader: Reader, path: string): Promise<unknown> {
  const text = await reader.text(path);
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${reader.describe(path)}: invalid JSON (${(err as Error).message})`);
  }
}

function hasNodeRuntime(): boolean {
  const proc = (globalThis as { process?: { versions?: { node?: string } } }).process;
  return typeof proc?.versions?.node === 'string';
}

async function makeReader(source: string | URL, options: LoadArtifactsOptions): Promise<Reader> {
  const raw = source instanceof URL ? source.href : source;
  const isFileUrl = FILE_SCHEME.test(raw);
  const isUrl = URL_SCHEME.test(raw) && !isFileUrl;
  if (isUrl || !hasNodeRuntime()) return makeFetchReader(raw, options.fetchImpl);
  return makeFsReader(isFileUrl ? await fileUrlToPath(raw) : raw);
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function makeFetchReader(base: string, fetchImpl: typeof fetch | undefined): Reader {
  const doFetch = fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') {
    throw new Error('loadArtifacts: no fetch available; pass { fetchImpl } or use a directory path in Node');
  }
  const get = async (path: string) => {
    const url = joinUrl(base, path);
    const res = await doFetch(url);
    if (!res.ok) throw new Error(`loadArtifacts: GET ${url} failed with HTTP ${res.status} ${res.statusText}`);
    return res;
  };
  return {
    bytes: async (path) => new Uint8Array(await (await get(path)).arrayBuffer()),
    text: async (path) => (await get(path)).text(),
    describe: (path) => joinUrl(base, path),
  };
}

/** Dynamic import with a specifier bundlers cannot statically see. */
const importNode = <T>(specifier: string): Promise<T> => import(/* @vite-ignore */ specifier) as Promise<T>;

async function fileUrlToPath(url: string): Promise<string> {
  const { fileURLToPath } = await importNode<typeof import('node:url')>('node:url');
  return fileURLToPath(url);
}

async function makeFsReader(dir: string): Promise<Reader> {
  const fs = await importNode<typeof import('node:fs/promises')>('node:fs/promises');
  const pathMod = await importNode<typeof import('node:path')>('node:path');
  const full = (path: string) => pathMod.join(dir, path);
  const wrap = async <T>(path: string, read: () => Promise<T>): Promise<T> => {
    try {
      return await read();
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'ENOENT') throw new Error(`loadArtifacts: missing file ${full(path)} (is "${dir}" an artifact set?)`);
      throw err;
    }
  };
  return {
    bytes: (path) => wrap(path, () => fs.readFile(full(path))),
    text: (path) => wrap(path, () => fs.readFile(full(path), 'utf8')),
    describe: full,
  };
}
