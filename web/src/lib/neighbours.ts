/**
 * Neighbours of one catalogue item, for the movie page. Pure functions over the artifact set.
 *
 * - `cfNeighbours`: the item's row of the EASE matrix B ("people who liked this also liked"):
 *   the largest positive weights, strongest first.
 * - `semanticNeighbours`: cosine between the item's embedding and every other item's.
 */
import { scoreSemantic, type Artifacts } from 'flickpick';

export interface Neighbour {
  idx: number;
  weight: number;
}

export function cfNeighbours(artifacts: Artifacts, idx: number, max: number): Neighbour[] {
  const { indptr, indices, values } = artifacts.cf;
  const out: Neighbour[] = [];
  for (let p = indptr[idx]!; p < indptr[idx + 1]!; p++) {
    const j = indices[p]!;
    const w = values[p]!;
    if (j !== idx && w > 0) out.push({ idx: j, weight: w });
  }
  return out.sort((a, b) => b.weight - a.weight || a.idx - b.idx).slice(0, max);
}

export function semanticNeighbours(artifacts: Artifacts, idx: number, max: number): Neighbour[] {
  const { embeddings, manifest } = artifacts;
  if (!embeddings || !manifest.embedding) return [];
  const dim = manifest.embedding.dim;
  const scores = scoreSemantic(artifacts, embeddings.subarray(idx * dim, (idx + 1) * dim));
  const out: Neighbour[] = [];
  scores.forEach((w, j) => {
    if (j !== idx) out.push({ idx: j, weight: w });
  });
  return out.sort((a, b) => b.weight - a.weight || a.idx - b.idx).slice(0, max);
}
