/** Importers: CSV parsing, every export format on small inputs, detection and title resolution. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  detectFormat,
  normalizeImdbId,
  normalizeTitle,
  parseCsv,
  parseFlickpick,
  parseImdb,
  parseLetterboxd,
  parseMovielens,
  parseRatings,
  resolveRatings,
  titleVariants,
} from '../src/index.js';
import { syntheticCatalog } from './helpers/synthetic.js';

const EXAMPLE = fileURLToPath(new URL('../../flickpick/data/examples/movie_ratings_various.csv', import.meta.url));

const LETTERBOXD = `Date,Name,Year,Letterboxd URI,Rating
2024-01-02,"Crouching Tiger, Hidden Dragon",2000,https://boxd.it/abc,4.5
2024-02-03,Se7en,1995,https://boxd.it/def,5
2024-03-04,Cats,2019,https://boxd.it/ghi,
`;
const IMDB = `Const,Your Rating,Date Rated,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year
tt0114369,9,2023-05-01,Se7en,https://www.imdb.com/title/tt0114369/,movie,8.6,127,1995
tt0110912,10,2023-05-02,Pulp Fiction,https://www.imdb.com/title/tt0110912/,movie,8.9,154,1994
`;
const MOVIELENS = `movieId,imdbId,tmdbId,rating,timestamp,title
47,0114369,807,4.5,964982400,Se7en (1995)
2571,0133093,603,5.0,964982400,"Matrix, The (1999)"
`;
const FLICKPICK = `movie_id,imdb_id,tmdb_id,rating,average_rating,title
47,114369,807,95,81.88,Se7en (1995)
50,tt0114814,629,98,85.1,The Usual Suspects (1995)
`;

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, embedded commas and newlines, CRLF and a BOM', () => {
    const text = '﻿a,b,c\r\n"x, y","say ""hi""","line1\nline2"\r\n1,,3\r\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'say "hi"', 'line1\nline2'],
      ['1', '', '3'],
    ]);
  });

  it('rejects an unterminated quote', () => {
    expect(() => parseCsv('a\n"oops')).toThrow(/unterminated/);
  });
});

describe('importers', () => {
  it('Letterboxd: stars x20, title:year ids flagged for resolution, unrated rows skipped', () => {
    expect(parseLetterboxd(LETTERBOXD)).toEqual([
      { item_id: 'Crouching Tiger, Hidden Dragon:2000', score: 90, rated_at: '2024-01-02', title: 'Crouching Tiger, Hidden Dragon', year: 2000, needs_resolution: true },
      { item_id: 'Se7en:1995', score: 100, rated_at: '2024-02-03', title: 'Se7en', year: 1995, needs_resolution: true },
    ]);
  });

  it('IMDb: 1-10 x10 and Const ids', () => {
    expect(parseImdb(IMDB)).toEqual([
      { item_id: 'tt0114369', score: 90, rated_at: '2023-05-01', title: 'Se7en', year: 1995 },
      { item_id: 'tt0110912', score: 100, rated_at: '2023-05-02', title: 'Pulp Fiction', year: 1994 },
    ]);
  });

  it('MovieLens: stars x20, numeric imdbId normalised, timestamp to ISO, title split', () => {
    const [a, b] = parseMovielens(MOVIELENS);
    expect(a).toEqual({ item_id: 'tt0114369', score: 90, rated_at: '2000-07-30T18:40:00.000Z', title: 'Se7en', year: 1995 });
    expect(b).toMatchObject({ item_id: 'tt0133093', score: 100, title: 'Matrix, The', year: 1999 });
    expect(parseMovielens('movieId,rating\n1,3.5\n')).toEqual([{ item_id: 'ml:1', score: 70, needs_resolution: true }]);
  });

  it('flickpick: 0-100 kept, numeric or tt imdb ids', () => {
    expect(parseFlickpick(FLICKPICK)).toEqual([
      { item_id: 'tt0114369', score: 95, title: 'Se7en', year: 1995 },
      { item_id: 'tt0114814', score: 98, title: 'The Usual Suspects', year: 1995 },
    ]);
  });

  it('parses the example ratings file', () => {
    const ratings = parseRatings(readFileSync(EXAMPLE, 'utf8'));
    expect(ratings.length).toBeGreaterThan(100);
    expect(ratings[0]).toEqual({ item_id: 'tt0114369', score: 95, title: 'Se7en', year: 1995 });
    expect(ratings.every((r) => /^tt\d{7,}$/.test(r.item_id))).toBe(true);
  });

  it('names the row of a bad value', () => {
    expect(() => parseImdb('Const,Your Rating\ntt0114369,ten\n')).toThrow(/imdb: row 2 has a non-numeric value "ten"/);
    expect(() => parseFlickpick('movie_id,imdb_id,rating\n1,114369,120\n')).toThrow(/flickpick: row 2: score/);
  });
});

describe('detectFormat / parseRatings', () => {
  it('detects every format from its header', () => {
    expect(detectFormat(LETTERBOXD)).toBe('letterboxd');
    expect(detectFormat(IMDB)).toBe('imdb');
    expect(detectFormat(MOVIELENS)).toBe('movielens');
    expect(detectFormat(FLICKPICK)).toBe('flickpick');
    expect(detectFormat('a,b\n1,2\n')).toBeNull();
  });

  // the four header variants the contract names (docs/core-contract.md, Importers); the Python
  // importers test uses the same four
  const VARIANTS: [string, 'letterboxd' | 'movielens'][] = [
    ['Date,Name,Year,Letterboxd URI,Rating\n2024-01-02,Se7en,1995,u,4.5\n', 'letterboxd'],
    ['Date,Name,Year,Rating\n2024-01-02,Se7en,1995,4.5\n', 'letterboxd'],
    ['userId,movieId,rating,timestamp\n1,47,4.5,964982703\n', 'movielens'],
    ['movieId,rating\n47,4.5\n', 'movielens'],
  ];
  it.each(VARIANTS)('detects and parses the header variant %#: %j', (text, fmt) => {
    expect(detectFormat(text)).toBe(fmt);
    expect(detectFormat(text.replace('Rating', 'RATING').replace('rating', 'Rating'))).toBe(fmt);
    const [r, ...rest] = parseRatings(text);
    expect(rest).toEqual([]);
    expect(r!.score).toBe(90);
    expect(r!.item_id).toBe(fmt === 'letterboxd' ? 'Se7en:1995' : 'ml:47');
  });

  it('a multi-user MovieLens file needs an explicit userId', () => {
    const text = 'userId,movieId,rating\n1,47,4.5\n2,50,3\n';
    expect(() => parseMovielens(text)).toThrow(/2 users/);
    expect(parseMovielens(text, { userId: 2 }).map((r) => r.item_id)).toEqual(['ml:50']);
  });

  it('throws on an unknown file, listing its header', () => {
    expect(() => parseRatings('foo,bar\n1,2\n')).toThrow(/unrecognised ratings file \(header: foo, bar\)/);
  });
});

describe('ids and resolution', () => {
  it('normalises IMDb ids to tt + at least 7 digits', () => {
    expect(normalizeImdbId('114369')).toBe('tt0114369');
    expect(normalizeImdbId(114369)).toBe('tt0114369');
    expect(normalizeImdbId('tt114369')).toBe('tt0114369');
    expect(normalizeImdbId('tt10872600')).toBe('tt10872600');
    expect(normalizeImdbId('abc')).toBeNull();
    expect(normalizeImdbId('')).toBeNull();
  });

  it('normalises titles, including MovieLens trailing articles', () => {
    expect(normalizeTitle('Matrix, The')).toBe(normalizeTitle('The Matrix'));
    expect(normalizeTitle('Léon: The Professional')).toBe('leon the professional');
  });

  it('resolves title:year and ml: ids against the catalogue', () => {
    const catalog = syntheticCatalog().map((c) => ({ ...c, semantic_text: '' }));
    const resolved = resolveRatings(
      [
        { item_id: 'Movie 3:1993', score: 80, title: 'movie 3', year: 1993, needs_resolution: true },
        { item_id: 'ml:105', score: 60, needs_resolution: true },
        { item_id: 'Unknown:2001', score: 50, title: 'Unknown', year: 2001, needs_resolution: true },
        { item_id: 'tmdb:1007', score: 70, needs_resolution: true },
        { item_id: 'x', score: 65, title: 'Movie 8 (1998)', needs_resolution: true },
      ],
      catalog,
    );
    expect(resolved).toEqual([
      { item_id: 'tt0000004', score: 80, title: 'movie 3', year: 1993 },
      { item_id: 'tt0000006', score: 60 },
      { item_id: 'Unknown:2001', score: 50, title: 'Unknown', year: 2001, needs_resolution: true },
      { item_id: 'tt0000008', score: 70 },
      { item_id: 'tt0000009', score: 65, title: 'Movie 8 (1998)' },
    ]);
    expect(titleVariants('Seven (a.k.a. Se7en)')).toEqual(['seven', 'se7en']);
  });
});

describe('parseMovielens with several users', () => {
  const MULTI = 'userId,movieId,rating\n1,1,4\n2,1,1\n2,2,5\n';
  it('refuses to merge users, and picks one with { userId }', () => {
    expect(() => parseMovielens(MULTI)).toThrow(/2 users/);
    expect(parseMovielens(MULTI, { userId: 2 }).map((r) => [r.item_id, r.score])).toEqual([
      ['ml:1', 20],
      ['ml:2', 100],
    ]);
  });
});
