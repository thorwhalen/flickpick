/**
 * One recommendation: poster, title (opens the movie page), year, fused score, the reasons, your
 * rating control, and a "why" expander listing the liked titles behind the collaborative score.
 */
import type { Recommendation } from 'flickpick';
import type { ReactNode } from 'react';
import { CMD } from '@/commands/index';
import { defaults } from '@/defaults';
import { titleYear } from '@/lib/utils';
import { useArtifacts, useDispatch } from '@/state/hooks';
import { Card } from '@/ui/card';
import { Poster } from './poster';
import { RatingControl } from './rating-control';

export function MovieTitleButton({ imdbId, children }: { imdbId: string; children: ReactNode }) {
  const dispatch = useDispatch();
  return (
    <button
      type="button"
      className="text-left font-semibold hover:underline focus-visible:underline focus-visible:outline-none"
      onClick={() => void dispatch(CMD.openMovie, { imdb_id: imdbId })}
    >
      {children}
    </button>
  );
}

export function MovieCard({ rec, rank }: { rec: Recommendation; rank: number }) {
  const artifacts = useArtifacts();
  const dispatch = useDispatch();
  const item = artifacts?.catalog[rec.idx];
  const because = rec.because_of.flatMap((id) => {
    const idx = artifacts?.idToIdx.get(id);
    const row = idx === undefined ? undefined : artifacts!.catalog[idx];
    return row ? [{ id, label: titleYear(row.title, row.year) }] : [];
  });

  return (
    <Card className="flex flex-col gap-3 p-3">
      <button
        type="button"
        className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Open ${rec.title}`}
        onClick={() => void dispatch(CMD.openMovie, { imdb_id: rec.item_id })}
      >
        <Poster imdbId={rec.item_id} title={rec.title} year={rec.year} />
      </button>
      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">{rank}.</span>
          <MovieTitleButton imdbId={rec.item_id}>{rec.title}</MovieTitleButton>
        </div>
        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {rec.year && <span>{rec.year}</span>}
          <span title="Fused score: weighted sum of z-scores (collaborative, mood, popularity) over the candidates">
            score {rec.score.toFixed(defaults.format.statDigits)}
          </span>
          {item?.genres.length ? <span>{item.genres.slice(0, 3).join(' · ')}</span> : null}
        </div>
      </div>
      <ul className="space-y-1 text-sm">
        {rec.reasons.map((reason) => (
          <li key={reason} className="text-muted-foreground">
            {reason}
          </li>
        ))}
      </ul>
      {because.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-primary">Why this?</summary>
          <p className="mt-1 text-muted-foreground">People who liked these titles you rated also liked this one:</p>
          <ul className="mt-1 list-disc pl-5">
            {because.map((b) => (
              <li key={b.id}>
                <MovieTitleButton imdbId={b.id}>{b.label}</MovieTitleButton>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="mt-auto">
        <RatingControl itemId={rec.item_id} title={rec.title} start={item?.mean_rating} compact />
      </div>
    </Card>
  );
}
