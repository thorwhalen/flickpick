/**
 * shadcn's Slider (Radix) plus a ghost thumb: while dragging, a faded marker stays at the saved
 * value so the user sees where they started. Recipe from tw-frontend-ux `controls.md` § Slider.
 * Single thumb, horizontal, left-to-right, controlled (`value`) only.
 */
import * as SliderPrimitive from '@radix-ui/react-slider';
import * as React from 'react';
import { cn } from '@/lib/utils';

/** Thumb width in px; must match the thumb's `size-4` class. Radix insets the thumb by up to
 *  half its width at the ends, and the ghost must be inset the same way. */
const THUMB_SIZE_PX = 16;

/** Radix's `getThumbInBoundsOffset`, for a horizontal left-to-right slider. */
export function thumbLeft(percent: number, thumbSizePx = THUMB_SIZE_PX) {
  const half = thumbSizePx / 2;
  return `calc(${percent}% + ${half - (percent / 50) * half}px)`;
}

type GhostSliderProps = React.ComponentProps<typeof SliderPrimitive.Root> & {
  /** Where the ghost sits while dragging. Defaults to the value at pointer-down. */
  savedValue?: number;
  /** Fainter track and thumb (e.g. for a title not rated yet). */
  muted?: boolean;
  /** Spoken value when the raw number needs words or units (e.g. "70 out of 100"). */
  valueText?: string;
};

export function GhostSlider({
  className,
  value,
  min = 0,
  max = 100,
  savedValue,
  muted = false,
  valueText,
  'aria-label': ariaLabel,
  onPointerDown,
  onPointerUp,
  onLostPointerCapture,
  ...props
}: GhostSliderProps) {
  const [dragFrom, setDragFrom] = React.useState<number | null>(null);
  const current = value?.[0];
  const ghost = dragFrom === null ? null : (savedValue ?? dragFrom);
  const span = max - min || 1; // a degenerate range must not divide by zero
  const ghostLeft = ghost !== null && ghost !== current ? thumbLeft(((ghost - min) / span) * 100) : null;
  const endDrag = () => setDragFrom(null);

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={value}
      min={min}
      max={max}
      className={cn('relative flex w-full touch-none items-center py-2 select-none data-[disabled]:opacity-50', className)}
      // Our handler runs before Radix's, so `current` is still the pre-drag value here.
      onPointerDown={(e) => {
        if (!props.disabled) setDragFrom(current ?? null);
        onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        endDrag();
        onPointerUp?.(e);
      }}
      onLostPointerCapture={(e) => {
        endDrag();
        onLostPointerCapture?.(e);
      }}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range data-slot="slider-range" className={cn('absolute h-full', muted ? 'bg-muted-foreground/30' : 'bg-primary')} />
      </SliderPrimitive.Track>
      {ghostLeft && (
        <span
          aria-hidden
          data-slot="slider-ghost-thumb"
          className="pointer-events-none absolute block size-4 rounded-full border border-primary/50 bg-background/60"
          style={{ left: ghostLeft, transform: 'translateX(-50%)' }}
        />
      )}
      {/* The thumb is the element with role="slider", so it carries the accessible name. */}
      <SliderPrimitive.Thumb
        data-slot="slider-thumb"
        aria-label={ariaLabel}
        aria-valuetext={valueText}
        className={cn(
          'block size-4 shrink-0 rounded-full border bg-background shadow-sm ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden',
          muted ? 'border-muted-foreground/60' : 'border-primary',
        )}
      />
    </SliderPrimitive.Root>
  );
}
