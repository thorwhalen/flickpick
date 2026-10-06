/**
 * Your score for one title, 0-100, as a slider (tw-frontend-ux `controls.md` § Slider): the
 * readout shows the number, a ghost thumb marks the saved score while dragging, the drag is a
 * local preview, and only the release dispatches `app.ratings.rate` (one command per gesture;
 * each arrow-key press is its own commit). An unrated title shows a faint thumb at the
 * population's mean as a starting point, labelled "not rated".
 */
import { useState } from 'react';
import { CMD } from '@/commands/index';
import { defaults } from '@/defaults';
import { cn } from '@/lib/utils';
import { useApp, useDispatch } from '@/state/hooks';
import { Button } from '@/ui/button';
import { GhostSlider } from '@/ui/ghost-slider';

export function RatingControl({
  itemId,
  title,
  start,
  compact = false,
}: {
  itemId: string;
  title: string;
  /** Where an unrated slider starts (e.g. the population mean). */
  start?: number | null;
  compact?: boolean;
}) {
  const saved = useApp((s) => s.ratings[itemId]?.score ?? null);
  const dispatch = useDispatch();
  const [preview, setPreview] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { min, max, step, unratedStart } = defaults.rating;
  const shown = preview ?? saved ?? Math.round(start ?? unratedStart);
  const unrated = saved === null && preview === null;

  const commit = async (score: number) => {
    const result = await dispatch(CMD.rateTitle, { item_id: itemId, score });
    setError(result.ok ? null : result.error.message);
    setPreview(null);
  };

  return (
    <div className={cn('flex items-center gap-3', compact ? 'min-w-40' : 'w-full')}>
      <GhostSlider
        aria-label={`Your score for ${title}`}
        value={[shown]}
        min={min}
        max={max}
        step={step}
        muted={unrated}
        valueText={unrated ? 'not rated' : `${shown} out of ${max}`}
        savedValue={saved ?? undefined}
        onValueChange={([v]) => setPreview(v ?? null)}
        onValueCommit={([v]) => v !== undefined && void commit(v)}
        className="flex-1"
      />
      <span className={cn('w-16 text-right text-sm tabular-nums', unrated && 'text-muted-foreground')} aria-live="polite">
        {unrated ? 'not rated' : `${shown}/100`}
      </span>
      {saved !== null && !compact && (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Remove your rating of ${title}`}
          onClick={() => void dispatch(CMD.removeRating, { item_id: itemId })}
        >
          Clear
        </Button>
      )}
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
