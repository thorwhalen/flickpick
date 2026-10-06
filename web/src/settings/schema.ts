/**
 * The user settings, as one Zod schema: the single source of truth for their types, defaults,
 * validation, labels and the settings form (which is rendered from this schema, field by field).
 *
 * UI hints ride on Zod's `.meta()`: `title` and `description` label the field, `widget` picks the
 * control (`secret` hides the value), `placeholder` fills the empty input. Adding a setting is
 * adding one field here; the form, the store and the `app.settings.set` command pick it up.
 */
import { z } from 'zod';
import { defaults } from '@/defaults';

/** ISO 3166-1 alpha-2, upper case (TMDB's `watch_region`). */
const REGION_PATTERN = /^[A-Z]{2}$/;

export const SettingsSchema = z.object({
  artifactSource: z
    .string()
    .trim()
    .min(1, 'Give a URL or a path relative to this page')
    .default(defaults.settings.artifactSource)
    .meta({
      title: 'Artifact source URL',
      description:
        'Where the recommender data (manifest.json, catalog.json and the matrix files) is loaded from. A relative path is resolved against this page.',
      placeholder: defaults.settings.artifactSource,
      widget: 'url',
    }),
  tmdbApiKey: z
    .string()
    .trim()
    .default('')
    .meta({
      title: 'TMDB API key',
      description:
        'Optional. Shows posters, overviews and where to watch. Stored only in this browser and sent only to api.themoviedb.org. A v3 API key or a v4 read access token both work.',
      placeholder: 'not set',
      widget: 'secret',
    }),
  region: z
    .string()
    .trim()
    .toUpperCase()
    .regex(REGION_PATTERN, 'Two letters, ISO 3166-1 (e.g. US, GB, FR)')
    .default(defaults.settings.region)
    .meta({
      title: 'Region',
      description: 'Country for streaming availability and age certification (ISO 3166-1 code).',
      placeholder: defaults.settings.region,
      widget: 'text',
    }),
  embeddingEnabled: z
    .boolean()
    .default(defaults.settings.embeddingEnabled)
    .meta({
      title: 'Mood search',
      description:
        'Embed the mood you type with a small language model that runs in this browser (about 35 MB, downloaded once on first use).',
      widget: 'switch',
    }),
});

export type Settings = z.output<typeof SettingsSchema>;
export type SettingKey = keyof Settings;

/** The settings with every default filled in. */
export const defaultSettings = (): Settings => SettingsSchema.parse({});

/** The UI hints of one field, read from its `.meta()`. */
export interface FieldMeta {
  title: string;
  description?: string;
  placeholder?: string;
  widget: 'text' | 'url' | 'secret' | 'switch';
}

/** Field keys in declaration order (the form renders them in this order). */
export const settingKeys = Object.keys(SettingsSchema.shape) as SettingKey[];

export function settingMeta(key: SettingKey): FieldMeta {
  const meta = (SettingsSchema.shape[key].meta() ?? {}) as Partial<FieldMeta>;
  return { title: meta.title ?? key, description: meta.description, placeholder: meta.placeholder, widget: meta.widget ?? 'text' };
}

/**
 * Validate one setting's value with its field schema; `{ ok: false, message }` instead of throwing,
 * so a form can show the message inline.
 */
export function parseSetting<K extends SettingKey>(
  key: K,
  value: unknown,
): { ok: true; value: Settings[K] } | { ok: false; message: string } {
  const result = SettingsSchema.shape[key].safeParse(value);
  if (result.success) return { ok: true, value: result.data as Settings[K] };
  return { ok: false, message: result.error.issues.map((i) => i.message).join('; ') };
}
