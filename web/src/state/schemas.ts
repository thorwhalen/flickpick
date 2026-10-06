/**
 * Zod schemas of everything the app stores, and the zodal collections built from them.
 *
 * - `RatingRowSchema`: one stored rating (the ratings collection). Same fields as the core's
 *   `Rating` (a compile-time check below keeps them in step); written here with the app's own zod
 *   because the core is linked from `../js` with its own copy of zod's type declarations.
 * - `SettingsRowSchema`: the settings, stored as a single row (`id = 'settings'`).
 * - `EnrichmentSchema`: one cached TMDB lookup, with `fetched_at` for the 180-day expiry.
 *
 * Each schema is the single source of truth for its type, its validation on read, and (for
 * ratings) the table columns, via zodal's `defineCollection` + `toColumnDefs`.
 */
import { defineCollection } from '@zodal/core';
import type { Rating } from 'flickpick';
import { z } from 'zod';
import { defaults } from '@/defaults';
import { SettingsSchema } from '@/settings/schema';

export const RatingRowSchema = z.object({
  /** Catalogue id (`tt...`), or `title:year` / `ml:<id>` while `needs_resolution`. */
  item_id: z.string().min(1).meta({ title: 'ID', hidden: true }),
  title: z.string().optional().meta({ title: 'Title' }),
  year: z.number().int().optional().meta({ title: 'Year' }),
  score: z
    .number()
    .min(defaults.rating.min)
    .max(defaults.rating.max)
    .meta({ title: 'Your score', editWidget: 'slider', inlineEditable: true }),
  rated_at: z.string().optional().meta({ title: 'Rated' }),
  needs_resolution: z.boolean().optional().meta({ title: 'Unmatched', hidden: true }),
});
export type RatingRow = z.infer<typeof RatingRowSchema>;

// Compile-time guarantee that a stored row can be handed to the core as a `Rating` as is.
// (If the core's Rating gains a required field, this line stops compiling.)
const _rowIsRating: (row: RatingRow) => Rating = (row) => row;
void _rowIsRating;

/** The ratings collection: table columns, search and inline editing come from here. */
export const ratingsCollection = defineCollection(RatingRowSchema, {
  idField: 'item_id',
  labelField: 'title',
  affordances: { search: true, delete: true, export: ['csv'] },
  fields: {
    item_id: { hidden: true, visible: false },
    needs_resolution: { hidden: true, visible: false },
    title: { searchable: true, order: 0 },
    year: { order: 1 },
    score: { editWidget: 'slider', inlineEditable: true, order: 2 },
    rated_at: { order: 3, searchable: false },
  },
});

/** The settings as stored: the settings schema plus the row id. */
export const SettingsRowSchema = SettingsSchema.extend({ id: z.literal(defaults.storage.settingsRowId) });
export type SettingsRow = z.infer<typeof SettingsRowSchema>;

const ProviderSchema = z.object({
  provider_id: z.number(),
  provider_name: z.string(),
  logo_path: z.string().nullable(),
});
export type WatchProvider = z.infer<typeof ProviderSchema>;

/** Watch providers for one region (JustWatch data through TMDB). */
export const RegionProvidersSchema = z.object({
  link: z.string().optional(),
  flatrate: z.array(ProviderSchema).default([]),
  rent: z.array(ProviderSchema).default([]),
  buy: z.array(ProviderSchema).default([]),
});
export type RegionProviders = z.infer<typeof RegionProvidersSchema>;

/**
 * One cached TMDB lookup. Display only: never passed to the recommender (project rule).
 * `found: false` caches a miss, so a title TMDB does not know is not looked up on every visit.
 * Region-dependent fields are stored for `region` only; a different region refetches.
 */
export const EnrichmentSchema = z.object({
  imdb_id: z.string().min(1),
  fetched_at: z.string(),
  region: z.string(),
  found: z.boolean(),
  tmdb_id: z.number().int().nullable().default(null),
  poster_path: z.string().nullable().default(null),
  backdrop_path: z.string().nullable().default(null),
  overview: z.string().default(''),
  runtime: z.number().nullable().default(null),
  certification: z.string().default(''),
  providers: RegionProvidersSchema.nullable().default(null),
});
export type Enrichment = z.infer<typeof EnrichmentSchema>;
