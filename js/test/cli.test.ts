/** The `flickpick` CLI, run as a child process (through tsx, so no build is needed). */
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, it } from 'vitest';
import { flickpickCsv, imdbId, writeSyntheticArtifacts } from './helpers/synthetic.js';

const run = promisify(execFile);
const CLI = fileURLToPath(new URL('../src/cli.ts', import.meta.url));

async function cli(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await run(process.execPath, ['--import', 'tsx', CLI, ...args]);
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code: number; stdout: string; stderr: string };
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

let artifacts: string;
let ratings: string;
beforeAll(async () => {
  artifacts = await writeSyntheticArtifacts();
  ratings = join(await mkdtemp(join(tmpdir(), 'flickpick-ratings-')), 'ratings.csv');
  // ten ratings, median 72.5 -> liked 0, 1, 2, 5, 6
  await writeFile(ratings, flickpickCsv([[0, 90], [1, 85], [2, 80], [5, 75], [6, 73], [3, 72], [4, 60], [7, 50], [8, 40], [9, 30]]));
});

describe('flickpick CLI', () => {
  it('recommend prints one ranked line per item with score and reasons', async () => {
    const { code, stdout } = await cli('recommend', '--artifacts', artifacts, '--ratings', ratings, '--k', '2');
    expect(code).toBe(0);
    const lines = stdout.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^1\. Movie \d+ \(\d{4}\)  score=-?\d+\.\d{3}  because: /);
    expect(lines[1]).toMatch(/^2\. /);
  });

  it('recommend --json returns unrated items and honours the genre filter', async () => {
    const { code, stdout } = await cli(
      'recommend', '--artifacts', artifacts, '--ratings', ratings, '--json', '--exclude-genre', 'Horror', '--year-min', '1990',
    );
    expect(code).toBe(0);
    const recs = JSON.parse(stdout) as { item_id: string; idx: number }[];
    const rated = new Set([0, 1, 2, 5, 6, 3, 4, 7, 8, 9].map(imdbId));
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => !rated.has(r.item_id))).toBe(true);
    expect(recs.map((r) => r.idx)).toEqual([11]); // 10 is Horror; 0-9 are rated
  });

  it('evaluate --json reports hold-out metrics, agreement and the fit', async () => {
    const { code, stdout } = await cli('evaluate', '--artifacts', artifacts, '--ratings', ratings, '--folds', '5', '--k', '2', '--json');
    expect(code).toBe(0);
    const out = JSON.parse(stdout);
    expect(out.holdout.folds).toBe(5);
    expect(out.holdout.per_fold).toHaveLength(5);
    expect(out.holdout.ci95.hit_rate).toBeNull();
    expect(out.agreement.n).toBe(10);
    expect(Object.keys(out)).toEqual(['holdout', 'agreement', 'cross_validated_fit']);
    expect(out.cross_validated_fit.folds).toBe(5);
  });

  it('evaluate --folds 0 is refused, not silently replaced by the default (#7)', async () => {
    const { code, stderr } = await cli('evaluate', '--artifacts', artifacts, '--ratings', ratings, '--folds', '0', '--json');
    expect(code).not.toBe(0);
    expect(stderr).toMatch(/folds must be an integer of at least 2; got 0/);
  });

  it.each([
    ['--folds', '-1', 'folds must be an integer of at least 2; got -1'],
    ['--folds', '1', 'folds must be an integer of at least 2; got 1'],
    ['--k', '-1', 'k must be an integer of at least 1; got -1'],
  ])('%s %s is a one-line refusal with exit 1, as in the Python CLI (#10)', async (flag, value, message) => {
    // Same cases as tests/test_cli.py::test_refusal_is_one_line_with_exit_1.
    const { code, stdout, stderr } = await cli('evaluate', '--artifacts', artifacts, '--ratings', ratings, flag, value);
    expect(code).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toBe(`flickpick: ${message}\n`);
  });

  it.each(['0', '-1'])('recommend --k %s is a one-line refusal, as in the Python CLI (#10)', async (k) => {
    const { code, stderr } = await cli('recommend', '--artifacts', artifacts, '--ratings', ratings, '--k', k);
    expect(code).toBe(1);
    expect(stderr).toBe(`flickpick: k must be an integer of at least 1; got ${k}\n`);
  });

  it('recommend --min-ratings -1 is a one-line refusal', async () => {
    const { code, stderr } = await cli('recommend', '--artifacts', artifacts, '--ratings', ratings, '--min-ratings', '-1');
    expect(code).toBe(1);
    expect(stderr).toBe('flickpick: min_ratings must be an integer of at least 0; got -1\n');
  });

  it.each(['1e1', '0x10', '-1e3', '2.0'])('--folds %s is a usage error, as int() makes it in Python', async (v) => {
    const { code, stderr } = await cli('evaluate', '--artifacts', artifacts, '--ratings', ratings, '--folds', v);
    expect(code).toBe(2);
    expect(stderr).toMatch(/^flickpick: /);
  });

  it('a missing --ratings is a usage error with the Python first line', async () => {
    const { code, stderr } = await cli('evaluate', '--artifacts', artifacts);
    expect(code).toBe(2);
    expect(stderr.split('\n')[0]).toBe('flickpick: --ratings is required');
  });

  it('notes unmatched ratings on stderr, as the Python CLI does (#10)', async () => {
    const extra = join(await mkdtemp(join(tmpdir(), 'flickpick-ratings-')), 'ratings.csv');
    const csv = flickpickCsv([[0, 90], [1, 85]]) + '999,tt9999999,999,70,50,Nowhere (1900)\n';
    await writeFile(extra, csv);
    const { code, stderr } = await cli('recommend', '--artifacts', artifacts, '--ratings', extra, '--k', '1');
    expect(code).toBe(0);
    expect(stderr).toBe('note: 2 of 3 ratings matched the catalogue; the rest are ignored\n');
  });

  it('evaluate prints a readable summary', async () => {
    const { code, stdout } = await cli('evaluate', '--artifacts', artifacts, '--ratings', ratings, '--folds', '5');
    expect(code).toBe(0);
    expect(stdout).toMatch(/hold-out: 5 folds over 5 liked items/);
    expect(stdout).toMatch(/ndcg@10: \d\.\d{3}  \(95% CI/);
    expect(stdout).toMatch(/note: hit_rate is per fold/);
  });

  it('exits 2 with usage on bad arguments and 1 on runtime errors', async () => {
    const missing = await cli('recommend', '--ratings', ratings);
    expect(missing.code).toBe(2);
    expect(missing.stderr).toMatch(/--artifacts is required[\s\S]*Usage:/);
    expect((await cli('frobnicate')).code).toBe(2);
    expect((await cli('recommend', '--artifacts', artifacts, '--ratings', ratings, '--k', 'ten')).code).toBe(2);
    const broken = await cli('recommend', '--artifacts', join(artifacts, 'nope'), '--ratings', ratings);
    expect(broken.code).toBe(1);
    expect(broken.stderr).toMatch(/missing file/);
  });
});
