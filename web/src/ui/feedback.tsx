/**
 * Loading, progress and message primitives (tw-frontend-ux principle 1: a loading state appears at
 * once, replaces the old content, and is announced with `aria-busy` / `role="status"`).
 */
import type * as React from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div aria-hidden className={cn('skeleton rounded-md', className)} {...props} />;
}

export function Spinner({ className, label }: { className?: string; label: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {label}
    </span>
  );
}

/** A determinate bar when `value` (0-1) is known, an indeterminate shimmer otherwise. */
export function ProgressBar({ value, label }: { value: number | null; label: string }) {
  const percent = value === null ? null : Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="space-y-1" role="status">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {percent !== null && <span className="tabular-nums">{percent}%</span>}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        {percent === null ? (
          <div className="skeleton h-full w-full" />
        ) : (
          <div className="h-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
        )}
      </div>
    </div>
  );
}

export function Notice({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'info' | 'warning' | 'error';
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'border-border bg-muted text-foreground',
    warning: 'border-primary/40 bg-accent text-accent-foreground',
    error: 'border-destructive/40 bg-destructive/10 text-destructive',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-md border px-3 py-2 text-sm', tones[tone], className)}>
      {children}
    </div>
  );
}
