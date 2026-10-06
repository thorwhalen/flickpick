/** Importers wiring: the example ratings file imports in full and matches the fixture catalogue. */
import { parseRatings } from 'flickpick';
import { describe, expect, it } from 'vitest';
import { CMD } from '@/commands/index';
import { fixtureArtifacts, makeTestServices, readExampleCsv } from '@/test-helpers/services';
import { previewImport } from './ratings-io';

/** Data rows of the example file (header excluded, blank lines ignored). */
const exampleRowCount = () => readExampleCsv().trim().split(/\r?\n/).length - 1;

describe('ratings import', () => {
  it('previews the example CSV: flickpick format, every row parsed, most matched', async () => {
    const preview = previewImport(readExampleCsv(), await fixtureArtifacts());
    expect(preview.format).toBe('flickpick');
    expect(preview.rows).toHaveLength(exampleRowCount());
    expect(preview.matched).toBeGreaterThan(0);
    expect(preview.matched + preview.unmatched.length).toBe(preview.rows.length);
  });

  it('imports the example CSV: N rows in the store and the provider', async () => {
    const { dispatch, deps } = await makeTestServices();
    await dispatch(CMD.load);
    const result = await dispatch<{ imported: number; matched: number }>(CMD.importRatings, { csv: readExampleCsv() });
    expect(result.ok).toBe(true);
    const n = new Set(parseRatings(readExampleCsv()).map((r) => r.item_id)).size;
    expect(result.ok && result.value.imported).toBe(n);
    expect(Object.keys(deps.store.getState().ratings)).toHaveLength(n);
    expect((await deps.providers.ratings.getList({})).total).toBe(n);
  });

  it('replace mode drops earlier ratings', async () => {
    const { dispatch, deps, artifacts } = await makeTestServices();
    await dispatch(CMD.load);
    const lonely = artifacts.catalog.at(-1)!.imdb_id;
    await dispatch(CMD.rateTitle, { item_id: lonely, score: 10 });
    await dispatch(CMD.importRatings, { csv: readExampleCsv(), mode: 'replace' });
    expect(deps.store.getState().ratings[lonely]).toBeUndefined();
  });

  it('a Letterboxd export resolves titles onto the catalogue', async () => {
    const artifacts = await fixtureArtifacts();
    const item = artifacts.catalog.find((c) => c.year !== null)!;
    const csv = `Date,Name,Year,Letterboxd URI,Rating\n2024-01-02,"${item.title}",${item.year},https://boxd.it/x,4.5\n`;
    const preview = previewImport(csv, artifacts);
    expect(preview.format).toBe('letterboxd');
    expect(preview.rows[0]).toMatchObject({ item_id: item.imdb_id, score: 90 });
    expect(preview.matched).toBe(1);
  });

  it('an unknown file is refused with its header in the message', async () => {
    const { dispatch } = await makeTestServices();
    const result = await dispatch(CMD.importRatings, { csv: 'foo,bar\n1,2\n' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('foo, bar');
  });
});
