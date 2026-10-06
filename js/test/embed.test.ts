/** makeEmbedQuery with an injected fake pipeline (transformers.js is never loaded). */
import { describe, expect, it } from 'vitest';
import { makeEmbedQuery, resolveModelId, resolvePooling, type EmbeddingInfo, type PipelineFactory } from '../src/index.js';

const info: EmbeddingInfo = { model: 'BAAI/bge-small-en-v1.5', dim: 4, dtype: 'float32', query_prefix: 'query: ', text_field: 'semantic_text' };

function fakePipeline(vector: number[]) {
  const calls: { task: string; model: string; texts: string[]; options: unknown[] } = { task: '', model: '', texts: [], options: [] };
  let loads = 0;
  const pipeline: PipelineFactory = async (task, model) => {
    loads++;
    calls.task = task;
    calls.model = model;
    return async (text, options) => {
      calls.texts.push(text);
      calls.options.push(options);
      return { data: Float32Array.from(vector), dims: [1, vector.length] };
    };
  };
  return { pipeline, calls, loads: () => loads };
}

describe('makeEmbedQuery', () => {
  it('maps the model, prefixes the query, pools like sentence-transformers and L2-normalises; loads once', async () => {
    const fake = fakePipeline([3, 4, 0, 0]);
    const embed = makeEmbedQuery(info, { pipeline: fake.pipeline });
    const v = await embed('slow-burn sci-fi');
    await embed('again');
    expect([...v].map((x) => +x.toFixed(6))).toEqual([0.6, 0.8, 0, 0]);
    expect(fake.calls.task).toBe('feature-extraction');
    expect(fake.calls.model).toBe('Xenova/bge-small-en-v1.5');
    expect(fake.calls.texts).toEqual(['query: slow-burn sci-fi', 'query: again']);
    expect(fake.calls.options[0]).toEqual({ pooling: 'cls', normalize: true }); // BGE is CLS-pooled
    expect(fake.loads()).toBe(1);
  });

  it('reports a dimension mismatch and a missing embedding section', async () => {
    const embed = makeEmbedQuery(info, { pipeline: fakePipeline([1, 0, 0]).pipeline });
    await expect(embed('x')).rejects.toThrow(/returned 3 dimensions, the artifact set expects 4/);
    expect(() => makeEmbedQuery(null)).toThrow(/no embeddings/);
  });

  it('mean-pools other models unless the manifest says otherwise', () => {
    expect(resolvePooling({ ...info, model: 'sentence-transformers/all-MiniLM-L6-v2' })).toBe('mean');
    expect(resolvePooling({ ...info, pooling: 'mean' })).toBe('mean');
    expect(resolvePooling(info, 'mean')).toBe('mean');
  });

  it('keeps unknown model ids and honours an explicit override', async () => {
    expect(resolveModelId('Xenova/all-MiniLM-L6-v2')).toBe('Xenova/all-MiniLM-L6-v2');
    const fake = fakePipeline([1, 0, 0, 0]);
    await makeEmbedQuery(info, { pipeline: fake.pipeline, model: 'onnx-community/x' })('q');
    expect(fake.calls.model).toBe('onnx-community/x');
  });
});
