/**
 * Small shared helpers: `cn` merges Tailwind class lists (later classes win over conflicting
 * earlier ones, which is what lets a component's caller override its defaults).
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** "Title (Year)", or the title alone. */
export const titleYear = (title: string, year: number | null | undefined) => (year ? `${title} (${year})` : title);

/** A message from anything thrown. */
export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));
