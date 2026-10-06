/**
 * Ratings import and export, around the core's importers.
 *
 * - `previewImport(csvText, artifacts)`: detect the format, parse, resolve title-only rows onto the
 *   catalogue, and count what matched. Pure: nothing is stored until the import command runs.
 * - `toFlickpickCsv(rows, artifacts)`: the flickpick CSV format (the example file's columns, plus
 *   `rated_at`), which `parseFlickpick` reads back.
 */
import { detectFormat, parseRatings, resolveRatings, type Artifacts, type Rating, type RatingFormat } from 'flickpick';
import { RatingRowSchema, type RatingRow } from '@/state/schemas';

export interface ImportPreview {
  format: RatingFormat;
  /** Parsed rows (resolved where possible), as storable rows. */
  rows: RatingRow[];
  /** How many rows are in the loaded catalogue. */
  matched: number;
  /** Titles of rows that are not (for the preview list). */
  unmatched: string[];
}

/** Rating -> stored row (validated; drops anything the row schema does not know). */
export const toRow = (r: Rating): RatingRow => RatingRowSchema.parse(r);

const describe = (r: Rating) => (r.title ? (r.year ? `${r.title} (${r.year})` : r.title) : r.item_id);

/** Parse and match a ratings CSV; throws (with the header) when the format is unknown. */
export function previewImport(csvText: string, artifacts: Artifacts | null): ImportPreview {
  const format = detectFormat(csvText);
  const parsed = parseRatings(csvText, format ? { format } : {});
  const resolved = artifacts ? resolveRatings(parsed, artifacts.catalog) : parsed;
  const inCatalog = (r: Rating) => Boolean(artifacts?.idToIdx.has(r.item_id));
  return {
    format: format ?? 'flickpick',
    rows: resolved.map(toRow),
    matched: resolved.filter(inCatalog).length,
    unmatched: resolved.filter((r) => !inCatalog(r)).map(describe),
  };
}

const FLICKPICK_COLUMNS = ['movie_id', 'imdb_id', 'tmdb_id', 'rating', 'average_rating', 'title', 'rated_at'] as const;

/** RFC 4180 quoting: quote a field that holds a comma, a quote or a newline. */
const csvField = (value: unknown): string => {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Rows -> flickpick CSV. Catalogue facts (MovieLens id, TMDB id, mean) are filled in when known. */
export function toFlickpickCsv(rows: readonly RatingRow[], artifacts: Artifacts | null): string {
  const lines = rows.map((row) => {
    const idx = artifacts?.idToIdx.get(row.item_id);
    const item = idx === undefined ? undefined : artifacts!.catalog[idx];
    const year = row.year ?? item?.year ?? undefined;
    const title = row.title ?? item?.title ?? '';
    const record: Record<(typeof FLICKPICK_COLUMNS)[number], unknown> = {
      movie_id: item?.ml_id ?? '',
      imdb_id: row.needs_resolution ? '' : row.item_id,
      tmdb_id: item?.tmdb_id ?? '',
      rating: row.score,
      average_rating: item?.mean_rating ?? '',
      title: year ? `${title} (${year})` : title,
      rated_at: row.rated_at ?? '',
    };
    return FLICKPICK_COLUMNS.map((c) => csvField(record[c])).join(',');
  });
  return [FLICKPICK_COLUMNS.join(','), ...lines].join('\n') + '\n';
}
