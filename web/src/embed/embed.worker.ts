/**
 * The embedding worker: runs the query-embedding model off the main thread.
 *
 * Built on the core's `makeEmbedQuery` (same model, pooling and prefix rules as the Python
 * writer) with transformers.js's `pipeline` passed in. The model downloads on the first request
 * (about 35 MB quantised, then cached by the browser) and the worker reports progress as a 0-1
 * fraction; later requests reuse the loaded model.
 */
import { pipeline } from '@huggingface/transformers';
import { makeEmbedQuery, type EmbedQuery, type PipelineFactory } from 'flickpick';
import type { WorkerRequest, WorkerResponse } from './protocol';

// A worker's global scope. Typed by hand because the app compiles against the DOM library, whose
// `postMessage` is the window's (it wants a target origin), not the worker's.
const scope = self as unknown as {
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
};

let loaded: { key: string; embed: EmbedQuery } | null = null;

/** transformers.js progress events -> one overall fraction (bytes loaded / bytes known). */
function progressTracker(report: (fraction: number | null) => void) {
  const files = new Map<string, { loaded: number; total: number }>();
  return (info: { status: string; file?: string; progress?: number; loaded?: number; total?: number }) => {
    if (info.status === 'progress_total' && typeof info.progress === 'number') return report(info.progress / 100);
    if (info.status === 'progress' && info.file && info.total) {
      files.set(info.file, { loaded: info.loaded ?? 0, total: info.total });
      let done = 0;
      let all = 0;
      for (const f of files.values()) {
        done += f.loaded;
        all += f.total;
      }
      return report(all > 0 ? done / all : null);
    }
    if (info.status === 'ready') return report(1);
  };
}

scope.onmessage = async (event) => {
  const msg = event.data;
  try {
    const key = `${msg.embedding.model}|${msg.dtype}`;
    if (!loaded || loaded.key !== key) {
      const onProgress = progressTracker((fraction) => scope.postMessage({ type: 'progress', id: msg.id, fraction }));
      loaded = {
        key,
        embed: makeEmbedQuery(msg.embedding, {
          // transformers.js types `pipeline` with literal task names; the core accepts any factory
          // with the same call shape, so the cast only widens the task parameter.
          pipeline: pipeline as unknown as PipelineFactory,
          pipelineOptions: { dtype: msg.dtype, progress_callback: onProgress },
        }),
      };
    }
    const vector = await loaded.embed(msg.text);
    // Transfer the buffer instead of copying it.
    scope.postMessage({ type: 'result', id: msg.id, vector }, [vector.buffer]);
  } catch (err) {
    loaded = null;
    scope.postMessage({ type: 'error', id: msg.id, message: (err as Error).message ?? String(err) });
  }
};
