/**
 * The recommend form: its schema, and its two-way mapping to the URL query string.
 *
 * The form is the structured query (seam 5's v1 default): mood text, genre include/exclude,
 * year range and result count. It lives in the URL (`#/?mood=...&inc=Drama,Comedy&k=10`) so a
 * link or a reload reproduces the results; the route module replaces (never pushes) the entry
 * when it changes, because refining a filter is not "going somewhere".
 */
import type { QueryInput } from 'flickpick';
import { z } from 'zod';
import { defaults } from '@/defaults';

export const RecommendFormSchema = z.object({
  mood: z.string().trim().default(''),
  include_genres: z.array(z.string()).default([]),
  exclude_genres: z.array(z.string()).default([]),
  year_min: z.number().int().optional(),
  year_max: z.number().int().optional(),
  k: z.number().int().min(defaults.recommend.kMin).max(defaults.recommend.kMax).default(defaults.recommend.k),
});
export type RecommendForm = z.output<typeof RecommendFormSchema>;

/** URL parameter names (short, so links stay readable). */
export const FORM_PARAM = {
  mood: 'mood',
  include_genres: 'inc',
  exclude_genres: 'exc',
  year_min: 'ymin',
  year_max: 'ymax',
  k: 'k',
} as const satisfies Record<keyof RecommendForm, string>;

const LIST_SEPARATOR = ',';

const splitList = (value: string | undefined) =>
  value ? value.split(LIST_SEPARATOR).map((s) => s.trim()).filter(Boolean) : [];

const toInt = (value: string | undefined) => {
  if (value === undefined || value === '') return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
};

/** URL params -> form. Invalid values fall back to the defaults instead of failing. */
export function formFromParams(params: Readonly<Record<string, string>>): RecommendForm {
  const raw = {
    mood: params[FORM_PARAM.mood] ?? '',
    include_genres: splitList(params[FORM_PARAM.include_genres]),
    exclude_genres: splitList(params[FORM_PARAM.exclude_genres]),
    year_min: toInt(params[FORM_PARAM.year_min]),
    year_max: toInt(params[FORM_PARAM.year_max]),
    k: toInt(params[FORM_PARAM.k]),
  };
  const parsed = RecommendFormSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  // Drop only the fields that failed, keep the rest.
  const bad = new Set(parsed.error.issues.map((i) => String(i.path[0])));
  const kept = Object.fromEntries(Object.entries(raw).filter(([key]) => !bad.has(key)));
  return RecommendFormSchema.parse(kept);
}

/** Form -> URL params; defaults and empty values are left out so the URL stays short. */
export function paramsFromForm(form: RecommendForm): Record<string, string> {
  const out: Record<string, string> = {};
  if (form.mood) out[FORM_PARAM.mood] = form.mood;
  if (form.include_genres.length) out[FORM_PARAM.include_genres] = form.include_genres.join(LIST_SEPARATOR);
  if (form.exclude_genres.length) out[FORM_PARAM.exclude_genres] = form.exclude_genres.join(LIST_SEPARATOR);
  if (form.year_min !== undefined) out[FORM_PARAM.year_min] = String(form.year_min);
  if (form.year_max !== undefined) out[FORM_PARAM.year_max] = String(form.year_max);
  if (form.k !== defaults.recommend.k) out[FORM_PARAM.k] = String(form.k);
  return out;
}

/** Form -> the core's query (an empty mood means "no mood": no model is loaded). */
export function queryFromForm(form: RecommendForm, { useMood }: { useMood: boolean }): QueryInput {
  return {
    ...(useMood && form.mood ? { mood: form.mood } : {}),
    include_genres: form.include_genres,
    exclude_genres: form.exclude_genres,
    ...(form.year_min !== undefined ? { year_min: form.year_min } : {}),
    ...(form.year_max !== undefined ? { year_max: form.year_max } : {}),
    k: form.k,
  };
}
