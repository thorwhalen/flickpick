/** A toggle chip (`aria-pressed`), for picking values from a short list such as genres. */
import type * as React from 'react';
import { cn } from '@/lib/utils';

export function Chip({
  pressed,
  tone = 'include',
  className,
  ...props
}: React.ComponentProps<'button'> & { pressed: boolean; tone?: 'include' | 'exclude' }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        'rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        !pressed && 'border-input bg-card text-muted-foreground hover:bg-muted',
        pressed && tone === 'include' && 'border-primary bg-primary text-primary-foreground',
        pressed && tone === 'exclude' && 'border-destructive bg-destructive/10 text-destructive line-through',
        className,
      )}
      {...props}
    />
  );
}
