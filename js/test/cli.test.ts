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
    expect(out.holdout.folds).toHaveLength(5);
    expect(out.agreement.n).toBe(10);
    expect(out.fit.folds).toBe(5);
  });

  it('evaluate prints a readable summary', async () => {
    const { code, stdout } = await cli('evaluate', '--artifacts', artifacts, '--ratings', ratings, '--folds', '5');
    expect(code).toBe(0);
    expect(stdout).toMatch(/hold-out: 5 folds over 5 liked items/);
    expect(stdout).toMatch(/ndcg@10: \d\.\d{3}  \(95% CI/);
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
