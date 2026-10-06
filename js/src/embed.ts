/**
 * Query-time text embedding, the only place a model runs when recommending.
 *
 * `makeEmbedQuery(manifest.embedding)` returns `embedQuery(text) -> Float32Array[dim]` built on
 * a transformers.js `feature-extraction` pipeline with the artifact set's model (mapped to its
 * ONNX port, e.g. `BAAI/bge-small-en-v1.5` -> `Xenova/bge-small-en-v1.5`), L2 normalisation and
 * the manifest's `query_prefix` prepended. Pooling is mean by default, but follows the manifest's
 * `pooling` or, failing that, the pooling sentence-transformers uses for the model (CLS for the
 * BGE family), so query vectors live in the same space as the Python-built item vectors.
 *
 * `@huggingface/transformers` is an optional peer dependency loaded with a dynamic `import()` on
 * the first call, so importing the core costs nothing. A host (the browser app, a test) can
 * pass its own `pipeline` factory instead, and then the library is never imported.
 */
import { defaults } from './defaults.js';
import type { EmbedQuery, EmbeddingInfo } from './types.js';

/** What a feature-extraction pipeline returns: a tensor-like with flat `data` (and maybe `dims`). */
export interface TensorLike {
  data: ArrayLike<number>;
  dims?: readonly number[];
}

/** A loaded feature-extraction pipeline (transformers.js `FeatureExtractionPipeline` fits this). */
export type Extractor = (text: string, options: { pooling: 'mean' | 'cls'; normalize: boolean }) => Promise<TensorLike>;

/** transformers.js `pipeline(task, model, options)`, or any function with the same contract. */
export type PipelineFactory = (task: string, model: string, options?: Record<string, unknown>) => Promise<Extractor>;

export interface MakeEmbedQueryOptions {
  /** Pipeline factory; defaults to `pipeline` from `@huggingface/transformers` (dynamic import). */
  pipeline?: PipelineFactory;
  /** Override the transformers.js model id (otherwise mapped from the manifest's model). */
  model?: string;
  /** Extra options forwarded to the pipeline factory (e.g. `{ dtype: 'q8', device: 'webgpu' }`). */
  pipelineOptions?: Record<string, unknown>;
  /** Model id aliases (Python id -> transformers.js id). */
  modelAliases?: Record<string, string>;
  /** Force a pooling mode (otherwise: manifest `pooling`, then `defaults.embedding.modelPooling`, then mean). */
  pooling?: 'mean' | 'cls';
}

/** The pooling for a manifest embedding section: explicit, manifest, per-model default, global default. */
export function resolvePooling(embedding: EmbeddingInfo, override?: 'mean' | 'cls'): 'mean' | 'cls' {
  return override ?? embedding.pooling ?? defaults.embedding.modelPooling[embedding.model] ?? defaults.embedding.pooling;
}

/** The transformers.js model id for a manifest model id. */
export function resolveModelId(model: string, aliases: Record<string, string> = defaults.embedding.modelAliases): string {
  return aliases[model] ?? model;
}

/** L2-normalise in place and return the array (a zero vector is left as is). */
export function l2Normalize(v: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i]! * v[i]!;
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < v.length; i++) v[i]! /= norm;
  return v;
}

async function loadTransformersPipeline(): Promise<PipelineFactory> {
  try {
    const mod = (await import('@huggingface/transformers')) as { pipeline: PipelineFactory };
    return mod.pipeline;
  } catch (err) {
    throw new Error(
      'Mood search needs @huggingface/transformers, which is not installed. ' +
        'Install it with `npm install @huggingface/transformers`, or pass { pipeline } to makeEmbedQuery. ' +
        `(${(err as Error).message})`,
    );
  }
}

/** Build `embedQuery(text)` for an artifact set's embedding settings. The model loads on first use. */
export function makeEmbedQuery(embedding: EmbeddingInfo | null | undefined, options: MakeEmbedQueryOptions = {}): EmbedQuery {
  if (!embedding) {
    throw new Error('makeEmbedQuery: this artifact set has no embeddings (manifest.embedding is null)');
  }
  const model = options.model ?? resolveModelId(embedding.model, options.modelAliases);
  const pooling = resolvePooling(embedding, options.pooling);
  const prefix = embedding.query_prefix ?? '';
  let extractor: Promise<Extractor> | undefined;
  const getExtractor = () =>
    (extractor ??= (async () => {
      const factory = options.pipeline ?? (await loadTransformersPipeline());
      return factory(defaults.embedding.task, model, options.pipelineOptions);
    })().catch((err) => {
      extractor = undefined; // let a later call retry (e.g. after a network error)
      throw err;
    }));

  return async (text: string) => {
    const run = await getExtractor();
    const output = await run(prefix + text, { pooling, normalize: defaults.embedding.normalize });
    const vector = Float32Array.from(output.data);
    if (vector.length !== embedding.dim) {
      throw new Error(`embedQuery: model ${model} returned ${vector.length} dimensions, the artifact set expects ${embedding.dim}`);
    }
    return l2Normalize(vector);
  };
}
