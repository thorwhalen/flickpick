/**
 * Ratings importers: export files from Letterboxd, IMDb, MovieLens and flickpick's own format
 * become one canonical `Rating[]` on the 0-100 scale. Pure functions over CSV text.
 *
 * | format     | key columns                                              | scale        | item_id                         |
 * |------------|----------------------------------------------------------|--------------|---------------------------------|
 * | letterboxd | Date, Name, Year, Letterboxd URI, Rating                 | 0.5-5 x 20   | `title:year`, needs_resolution  |
 * | imdb       | Const, Your Rating, Date Rated, Title, Year              | 1-10 x 10    | Const (`tt...`)                 |
 * | movielens  | movieId, imdbId?, tmdbId?, rating, title?, timestamp?    | 0.5-5 x 20   | `tt...` from imdbId, else `ml:<movieId>` with needs_resolution |
 * | flickpick  | movie_id, imdb_id, tmdb_id, rating, average_rating, title| 0-100        | `tt...` from imdb_id            |
 *
 * Letterboxd exports carry no IMDb id, so those ratings keep `title` and `year`, get
 * `item_id = "<title>:<year>"` and `needs_resolution: true`. `resolveRatings(ratings, catalog)`
 * maps them (and `ml:` ids) onto catalogue ids by normalised title + year (or MovieLens id);
 * ratings it cannot match are left untouched and are ignored by the scorers.
 */
import { defaults } from './defaults.js';
import { RatingSchema, type CatalogItem, type Rating } from './types.js';

export type RatingFormat = 'letterboxd' | 'imdb' | 'movielens' | 'flickpick';

// ---------------------------------------------------------------------------------- CSV

/** Parse RFC 4180 CSV: quoted fields, `""` escapes, embedded commas and newlines, CRLF or LF, BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  while (i < src.length) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === '') quoted = true;
    else if (ch === ',') endField();
    else if (ch === '\n') endRow();
    else if (ch === '\r') {
      if (src[i + 1] === '\n') i++;
      endRow();
    } else field += ch;
    i++;
  }
  if (quoted) throw new Error('CSV: unterminated quoted field at end of input');
  if (field !== '' || row.length) endRow();
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** CSV text -> header (trimmed) and records keyed by header. */
export function csvRecords(text: string): { header: string[]; records: Record<string, string>[] } {
  const [header = [], ...rows] = parseCsv(text);
  const names = header.map((h) => h.trim());
  return {
    header: names,
    records: rows.map((cells) => Object.fromEntries(names.map((name, k) => [name, (cells[k] ?? '').trim()]))),
  };
}

// ---------------------------------------------------------------------------------- helpers

/** Case-insensitive column lookup. */
function column(record: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const key = Object.keys(record).find((k) => k.toLowerCase() === name.toLowerCase());
    if (key !== undefined && record[key] !== '') return record[key]!;
  }
  return '';
}

/** `tt0114369`, `114369`, `tt114369`, 114369 -> `tt0114369`; anything else -> null. */
export function normalizeImdbId(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const match = /^(?:tt)?0*(\d+)$/i.exec(String(value).trim());
  if (!match || Number(match[1]) === 0) return null;
  return defaults.importers.imdbPrefix + match[1]!.padStart(defaults.importers.imdbMinDigits, '0');
}

/** `"Se7en (1995)"` -> `{ title: "Se7en", year: 1995 }`; no trailing year -> year undefined. */
export function splitTitleYear(raw: string): { title: string; year?: number } {
  const match = /^(.*?)\s*\((\d{4})\)\s*$/.exec(raw.trim());
  return match ? { title: match[1]!, year: Number(match[2]) } : { title: raw.trim() };
}

function toNumber(value: string, what: string, row: number): number | undefined {
  if (value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${what}: row ${row} has a non-numeric value "${value}"`);
  return n;
}

function toYear(value: string): number | undefined {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** Validate a built rating with the schema, naming the format and row on failure. */
function checked(rating: Rating, what: string, row: number): Rating {
  const result = RatingSchema.safeParse(rating);
  if (!result.success) {
    throw new Error(`${what}: row ${row}: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  return result.data;
}

/** Drop undefined fields (keeps Ratings minimal and JSON-stable). */
const compact = <T extends object>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

/** Shared row loop: header row is 1, first data row is 2; rows returning null are skipped. */
function mapRows(csvText: string, what: string, build: (r: Record<string, string>, row: number) => Rating | null): Rating[] {
  const out: Rating[] = [];
  csvRecords(csvText).records.forEach((record, k) => {
    const row = k + 2;
    const rating = build(record, row);
    if (rating) out.push(checked(compact(rating), what, row));
  });
  return out;
}

// ---------------------------------------------------------------------------------- formats

/** Letterboxd `ratings.csv` (or `diary.csv`): rows without a rating are skipped. */
export function parseLetterboxd(csvText: string): Rating[] {
  return mapRows(csvText, 'letterboxd', (r, row) => {
    const stars = toNumber(column(r, 'Rating'), 'letterboxd', row);
    if (stars === undefined) return null;
    const title = column(r, 'Name');
    const year = toYear(column(r, 'Year'));
    return {
      item_id: year === undefined ? title : `${title}:${year}`,
      score: stars * defaults.importers.starsFactor,
      rated_at: column(r, 'Date') || undefined,
      title,
      year,
      needs_resolution: true,
    } as Rating;
  });
}

/** IMDb "Your ratings" export. */
export function parseImdb(csvText: string): Rating[] {
  return mapRows(csvText, 'imdb', (r, row) => {
    const score = toNumber(column(r, 'Your Rating'), 'imdb', row);
    if (score === undefined) return null;
    const id = normalizeImdbId(column(r, 'Const'));
    if (!id) throw new Error(`imdb: row ${row} has no valid Const (IMDb id): "${column(r, 'Const')}"`);
    return {
      item_id: id,
      score: score * defaults.importers.imdbFactor,
      rated_at: column(r, 'Date Rated') || undefined,
      title: column(r, 'Title') || undefined,
      year: toYear(column(r, 'Year')),
    } as Rating;
  });
}

/** MovieLens-style ratings (`movieId, rating` plus any of `imdbId, tmdbId, title, timestamp`). */
export function parseMovielens(csvText: string): Rating[] {
  return mapRows(csvText, 'movielens', (r, row) => {
    const stars = toNumber(column(r, 'rating'), 'movielens', row);
    if (stars === undefined) return null;
    const imdb = normalizeImdbId(column(r, 'imdbId', 'imdb_id'));
    const { title, year } = splitTitleYear(column(r, 'title'));
    const ts = toNumber(column(r, 'timestamp'), 'movielens', row);
    return {
      item_id: imdb ?? `ml:${column(r, 'movieId')}`,
      score: stars * defaults.importers.starsFactor,
      rated_at: ts === undefined ? undefined : new Date(ts * defaults.importers.msPerSecond).toISOString(),
      title: title || undefined,
      year,
      needs_resolution: imdb ? undefined : true,
    } as Rating;
  });
}

/** flickpick's own format: `movie_id, imdb_id, tmdb_id, rating (0-100), average_rating, title`. */
export function parseFlickpick(csvText: string): Rating[] {
  return mapRows(csvText, 'flickpick', (r, row) => {
    const score = toNumber(column(r, 'rating'), 'flickpick', row);
    if (score === undefined) return null;
    const id = normalizeImdbId(column(r, 'imdb_id'));
    const { title, year } = splitTitleYear(column(r, 'title'));
    return {
      item_id: id ?? `ml:${column(r, 'movie_id')}`,
      score,
      rated_at: column(r, 'rated_at') || undefined,
      title: title || undefined,
      year,
      needs_resolution: id ? undefined : true,
    } as Rating;
  });
}

const PARSERS: Record<RatingFormat, (csvText: string) => Rating[]> = {
  letterboxd: parseLetterboxd,
  imdb: parseImdb,
  movielens: parseMovielens,
  flickpick: parseFlickpick,
};

/** Columns that identify each format (case-insensitive), checked in this order. */
const SIGNATURES: [RatingFormat, string[]][] = [
  ['letterboxd', ['letterboxd uri', 'rating']],
  ['imdb', ['const', 'your rating']],
  ['flickpick', ['movie_id', 'imdb_id', 'rating']],
  ['movielens', ['movieid', 'rating']],
];

/** The format of a ratings CSV, from its header; null when unrecognised. */
export function detectFormat(csvText: string): RatingFormat | null {
  const header = new Set((parseCsv(csvText.split(/\r?\n/, 1)[0] ?? '')[0] ?? []).map((h) => h.trim().toLowerCase()));
  return SIGNATURES.find(([, cols]) => cols.every((c) => header.has(c)))?.[0] ?? null;
}

/** Detect the format and parse. Throws, listing the header, when the format is unknown. */
export function parseRatings(csvText: string, { format }: { format?: RatingFormat } = {}): Rating[] {
  const fmt = format ?? detectFormat(csvText);
  if (!fmt) {
    const header = (parseCsv(csvText.split(/\r?\n/, 1)[0] ?? '')[0] ?? []).join(', ');
    throw new Error(
      `parseRatings: unrecognised ratings file (header: ${header || '(empty)'}). ` +
        `Expected a Letterboxd, IMDb, MovieLens or flickpick export; supported formats: ${Object.keys(PARSERS).join(', ')}`,
    );
  }
  return PARSERS[fmt](csvText);
}

// ---------------------------------------------------------------------------------- resolution

/** Lowercase, strip accents and punctuation, move a trailing ", The" (MovieLens style) to the front. */
export function normalizeTitle(title: string): string {
  const moved = title.trim().replace(/^(.*),\s*(the|a|an|le|la|les|el|il|der|die|das)$/i, '$2 $1');
  return moved
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const PARENTHETICAL = /\s*\(([^()]*)\)/g;
const AKA = /^(?:a\.k\.a\.|aka)\s+/i;

/** The primary title plus any parenthesised alternates (`Seven (a.k.a. Se7en)`), normalised. */
export function titleVariants(title: string): string[] {
  const alternates = [...title.matchAll(PARENTHETICAL)].map((m) => m[1]!.replace(AKA, ''));
  const primary = title.replace(PARENTHETICAL, '');
  return [primary, ...alternates].map(normalizeTitle).filter(Boolean);
}

const titleKeys = (title: string, year: number | null | undefined) =>
  titleVariants(title).map((t) => `${t}|${year ?? ''}`);

/**
 * Every way a rating can name a catalogue item -> its `imdb_id`: the id itself, `ml:<id>`,
 * `tmdb:<id>` and title keys (`normalised title|year`, alternates included). An earlier (more
 * popular) row wins a title collision. Same keys as the Python `catalog_lookup`.
 */
export function catalogLookup(catalog: readonly CatalogItem[]): Map<string, string> {
  const lookup = new Map<string, string>();
  const setDefault = (key: string, id: string) => lookup.has(key) || lookup.set(key, id);
  for (const item of catalog) {
    lookup.set(item.imdb_id, item.imdb_id);
    if (item.ml_id !== null) lookup.set(`ml:${item.ml_id}`, item.imdb_id);
    if (item.tmdb_id !== null) setDefault(`tmdb:${item.tmdb_id}`, item.imdb_id);
    for (const key of titleKeys(item.title, item.year)) setDefault(key, item.imdb_id);
  }
  return lookup;
}

/**
 * Map ratings flagged `needs_resolution` onto catalogue `imdb_id`s: by `ml:`/`tmdb:` id, else
 * by title + year (a `"Title (Year)"` title works too). Unmatched ratings are returned
 * unchanged (still flagged), so callers can report them; the scorers ignore them.
 */
export function resolveRatings(ratings: readonly Rating[], catalog: readonly CatalogItem[]): Rating[] {
  const lookup = catalogLookup(catalog);
  const find = (r: Rating): string | undefined => {
    const byId = lookup.get(r.item_id);
    if (byId) return byId;
    if (!r.title) return undefined;
    const split = splitTitleYear(r.title);
    const year = r.year ?? split.year;
    return titleKeys(split.title, year)
      .map((key) => lookup.get(key))
      .find((id) => id !== undefined);
  };
  return ratings.map((r) => {
    if (!r.needs_resolution) return r;
    const id = find(r);
    if (!id) return r;
    const { needs_resolution: _drop, ...rest } = r;
    return { ...rest, item_id: id };
  });
}
