/**
 * The main-thread side of query embedding: `Embedder.embed(text, embeddingInfo, onProgress)`.
 *
 * The default implementation talks to `embed.worker.ts`. The worker is created on the first call,
 * so a session that never types a mood never downloads the model. Results are cached by model and
 * text, so re-running a query (after rating a title, or changing a filter) does not re-embed.
 * Tests inject a fake `Embedder` instead.
 */
import type { EmbeddingInfo } from 'flickpick';
import { defaults } from '@/defaults';
import type { WorkerRequest, WorkerResponse } from './protocol';

export type ProgressFn = (fraction: number | null) => void;

export interface Embedder {
  embed(text: string, embedding: EmbeddingInfo, onProgress?: ProgressFn): Promise<Float32Array>;
}

interface Pending {
  resolve: (v: Float32Array) => void;
  reject: (e: Error) => void;
  onProgress?: ProgressFn;
}

const spawnWorker = () =>
  // `new URL(..., import.meta.url)` is the pattern Vite recognises to bundle the worker file.
  new Worker(new URL('./embed.worker.ts', import.meta.url), { type: 'module', name: 'flickpick-embed' });

export function createWorkerEmbedder(
  { makeWorker = spawnWorker, dtype = defaults.embedding.dtype }: { makeWorker?: () => Worker; dtype?: string } = {},
): Embedder {
  let worker: Worker | null = null;
  let nextId = 0;
  const pending = new Map<number, Pending>();
  const cache = new Map<string, Float32Array>();

  const getWorker = () => {
    if (worker) return worker;
    worker = makeWorker();
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      const job = pending.get(msg.id);
      if (!job) return;
      if (msg.type === 'progress') job.onProgress?.(msg.fraction);
      else {
        pending.delete(msg.id);
        if (msg.type === 'result') job.resolve(msg.vector);
        else job.reject(new Error(msg.message));
      }
    };
    worker.onerror = (event) => {
      const error = new Error(`The embedding worker failed: ${event.message || 'unknown error'}`);
      for (const job of pending.values()) job.reject(error);
      pending.clear();
      worker = null; // the next call starts a fresh worker
    };
    return worker;
  };

  return {
    async embed(text, embedding, onProgress) {
      const key = `${embedding.model}|${dtype}|${text}`;
      const hit = cache.get(key);
      if (hit) return hit;
      const id = nextId++;
      const vector = await new Promise<Float32Array>((resolve, reject) => {
        pending.set(id, { resolve, reject, onProgress });
        const request: WorkerRequest = { type: 'embed', id, text, embedding, dtype };
        getWorker().postMessage(request);
      });
      cache.set(key, vector);
      return vector;
    },
  };
}
