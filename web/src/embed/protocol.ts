/**
 * Messages between the main thread and the embedding worker. Plain data only (structured clone).
 */
import type { EmbeddingInfo } from 'flickpick';

export type WorkerRequest = {
  type: 'embed';
  id: number;
  text: string;
  embedding: EmbeddingInfo;
  /** transformers.js weight precision (e.g. `q8`, quantised). */
  dtype: string;
};

export type WorkerResponse =
  | { type: 'progress'; id: number; fraction: number | null }
  | { type: 'result'; id: number; vector: Float32Array }
  | { type: 'error'; id: number; message: string };
