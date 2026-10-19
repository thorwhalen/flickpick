#!/usr/bin/env node
/**
 * `flickpick` command line: a thin Node wrapper over the core, proof that the core is not
 * fused to any UI.
 *
 *   flickpick recommend --artifacts <dir|url> --ratings <csv> [--mood "..."] [--include-genre G]...
 *                       [--exclude-genre G]... [--year-min N] [--year-max N] [--min-ratings N]
 *                       [--k N] [--json]
 *   flickpick evaluate  --artifacts <dir|url> --ratings <csv> [--folds N] [--k N] [--seed N] [--json]
 *
 * `recommend` prints `rank. title (year)  score=...  because: ...` per item, or JSON with
 * `--json`. Notes about unmatched ratings go to stderr so stdout stays machine-readable.
 */
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { loadArtifacts } from './artifacts.js';
import { defaults } from './defaults.js';
import { makeEmbedQuery } from './embed.js';
import { parseRatings, resolveRatings } from './importers.js';
import { agreement, crossValidatedFit, holdoutEvaluate } from './science.js';
import { recommend } from './scoring.js';
import type { Artifacts, QueryInput, Rating, Recommendation } from './types.js';

const USAGE = `Usage:
  flickpick recommend --artifacts <dir|url> --ratings <csv> [--mood "..."]
                      [--include-genre G]... [--exclude-genre G]... [--year-min N] [--year-max N]
                      [--min-ratings N] [--k N] [--json]
  flickpick evaluate  --artifacts <dir|url> --ratings <csv> [--folds N] [--k N] [--seed N] [--json]

Ratings files: Letterboxd, IMDb, MovieLens or flickpick CSV exports (detected from the header).`;

const EXIT = { ok: 0, error: 1, usage: 2 } as const;

class UsageError extends Error {}

const OPTIONS = {
  artifacts: { type: 'string' },
  ratings: { type: 'string' },
  mood: { type: 'string' },
  'include-genre': { type: 'string', multiple: true },
  'exclude-genre': { type: 'string', multiple: true },
  // Plural aliases, so the flags read the same as the Python CLI's (`--exclude-genres`).
  'include-genres': { type: 'string', multiple: true },
  'exclude-genres': { type: 'string', multiple: true },
  'year-min': { type: 'string' },
  'year-max': { type: 'string' },
  'min-ratings': { type: 'string' },
  k: { type: 'string' },
  folds: { type: 'string' },
  seed: { type: 'string' },
  json: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
} as const;

/**
 * `--folds -1` as `--folds=-1`: `parseArgs` reads a value that starts with `-` as an option, so
 * a negative number after a string option would be a usage error instead of reaching the core's
 * check (as it does in the Python CLI, #10).
 */
function joinNegativeValues(argv: readonly string[]): string[] {
  const takesValue = (arg: string) => {
    const name = arg.startsWith('--') && !arg.includes('=') ? arg.slice(2) : undefined;
    return name !== undefined && (OPTIONS as Record<string, { type: string }>)[name]?.type === 'string';
  };
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const [arg, next] = [argv[i]!, argv[i + 1]];
    if (takesValue(arg) && next !== undefined && /^-\d+$/.test(next)) {
      out.push(`${arg}=${next}`);
      i++;
    } else out.push(arg);
  }
  return out;
}

type Values = ReturnType<typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true }>>['values'];

function intOption(values: Values, name: keyof Values): number | undefined {
  const raw = values[name];
  if (raw === undefined) return undefined;
  // Digits only, as Python's int(): no 1e1, 0x10 or 1.0.
  const n = /^-?\d+$/.test(String(raw)) ? Number(raw) : NaN;
  if (!Number.isInteger(n)) throw new UsageError(`--${String(name)} must be an integer, got "${String(raw)}"`);
  return n;
}

function required(values: Values, name: 'artifacts' | 'ratings'): string {
  const v = values[name];
  if (!v) throw new UsageError(`--${name} is required`);
  return v;
}

async function loadInputs(values: Values): Promise<{ artifacts: Artifacts; ratings: Rating[] }> {
  const artifacts = await loadArtifacts(required(values, 'artifacts'));
  const ratingsPath = required(values, 'ratings');
  const parsed = parseRatings(await readFile(ratingsPath, 'utf8'));
  const ratings = resolveRatings(parsed, artifacts.catalog);
  const matched = ratings.filter((r) => artifacts.idToIdx.has(r.item_id)).length;
  if (matched < ratings.length) {
    process.stderr.write(`note: ${matched} of ${ratings.length} ratings matched the catalogue; the rest are ignored\n`);
  }
  return { artifacts, ratings };
}

const fmt = (x: number, digits: number) => (Number.isFinite(x) ? x.toFixed(digits) : 'n/a');

function formatRecommendation(rec: Recommendation, rank: number): string {
  const head = `${rank}. ${rec.year === null ? rec.title : `${rec.title} (${rec.year})`}`;
  const because = rec.reasons.length ? `  because: ${rec.reasons.join('; ')}` : '';
  return `${head}  score=${fmt(rec.score, defaults.cli.scoreDigits)}${because}`;
}

async function runRecommend(values: Values): Promise<string> {
  const { artifacts, ratings } = await loadInputs(values);
  const query: QueryInput = {
    ...(values.mood ? { mood: values.mood } : {}),
    include_genres: [...(values['include-genre'] ?? []), ...(values['include-genres'] ?? [])],
    exclude_genres: [...(values['exclude-genre'] ?? []), ...(values['exclude-genres'] ?? [])],
  };
  const ints = { year_min: 'year-min', year_max: 'year-max', min_ratings: 'min-ratings', k: 'k' } as const;
  for (const [field, flag] of Object.entries(ints)) {
    const v = intOption(values, flag);
    if (v !== undefined) (query as Record<string, unknown>)[field] = v;
  }
  const embedQuery = values.mood ? makeEmbedQuery(artifacts.manifest.embedding) : undefined;
  const recs = await recommend(artifacts, ratings, query, embedQuery ? { embedQuery } : {});
  if (values.json) return JSON.stringify(recs, null, 2);
  return recs.map((r, i) => formatRecommendation(r, i + 1)).join('\n');
}

async function runEvaluate(values: Values): Promise<string> {
  const { artifacts, ratings } = await loadInputs(values);
  const folds = intOption(values, 'folds');
  const k = intOption(values, 'k');
  const seed = intOption(values, 'seed');
  // `!== undefined`, not truthiness: `--folds 0` must reach the core's check, not become the default.
  const opts = { ...(folds !== undefined ? { folds } : {}), ...(k !== undefined ? { k } : {}), ...(seed !== undefined ? { seed } : {}) };
  const holdout = holdoutEvaluate(artifacts, ratings, opts);
  const agree = agreement(ratings, artifacts.catalog);
  const fit = crossValidatedFit(ratings, artifacts.catalog, { ...(folds !== undefined ? { folds } : {}), ...(seed !== undefined ? { seed } : {}) });
  // The same keys as the Python CLI (core contract, CLI).
  if (values.json) return JSON.stringify({ holdout, agreement: agree, cross_validated_fit: fit }, null, 2);
  const d = defaults.cli.metricDigits;
  const metricLines = (Object.keys(holdout.mean) as (keyof typeof holdout.mean)[]).map((m) => {
    const ci = holdout.ci95[m];
    const interval = ci ? `  (95% CI ${fmt(ci[0], d)} to ${fmt(ci[1], d)})` : '';
    return `  ${m}@${holdout.k}: ${fmt(holdout.mean[m], d)}${interval}`;
  });
  return [
    `hold-out: ${holdout.folds} folds over ${holdout.n_liked} liked items (${holdout.n_rated} rated items in the catalogue)`,
    ...metricLines,
    ...(holdout.note ? [`  note: ${holdout.note}`] : []),
    `agreement with population mean (n=${agree.n}): pearson ${fmt(agree.pearson, d)}, spearman ${fmt(agree.spearman, d)}, ` +
      `slope ${fmt(agree.slope, d)}, intercept ${fmt(agree.intercept, d)}`,
    `cross-validated fit (${fit.folds} folds, n=${fit.n}): linear RMSE ${fmt(fit.linear.rmse, d)} MAE ${fmt(fit.linear.mae, d)}; ` +
      `user-mean baseline RMSE ${fmt(fit.baseline.rmse, d)} MAE ${fmt(fit.baseline.mae, d)}`,
  ].join('\n');
}

const COMMANDS: Record<string, (values: Values) => Promise<string>> = { recommend: runRecommend, evaluate: runEvaluate };

/** An error as one line; a schema error (several issues, JSON in its message) as `path: message; ...`. */
function oneLine(err: unknown): string {
  const issues = (err as { issues?: { path: PropertyKey[]; message: string }[] }).issues;
  if (Array.isArray(issues)) return issues.map((i) => `${i.path.map(String).join('.')}: ${i.message}`).join('; ');
  return (err as Error).message;
}

/** Run the CLI with `argv` (without node and script); returns the exit code. */
export async function runCli(argv: readonly string[]): Promise<number> {
  try {
    const { values, positionals } = parseArgs({ args: joinNegativeValues(argv), options: OPTIONS, allowPositionals: true, strict: true });
    const [command, ...extra] = positionals;
    if (values.help || !command) {
      process.stdout.write(`${USAGE}\n`);
      return values.help ? EXIT.ok : EXIT.usage;
    }
    const run = COMMANDS[command];
    if (!run) throw new UsageError(`unknown command "${command}"; expected one of: ${Object.keys(COMMANDS).join(', ')}`);
    if (extra.length) throw new UsageError(`unexpected arguments: ${extra.join(' ')}`);
    const output = await run(values);
    // Nothing to print prints nothing, as in the Python CLI (not an empty line).
    if (output) process.stdout.write(`${output}\n`);
    return EXIT.ok;
  } catch (err) {
    const usage = err instanceof UsageError || (err as { code?: string }).code?.startsWith('ERR_PARSE_ARGS');
    process.stderr.write(`flickpick: ${oneLine(err)}\n${usage ? `\n${USAGE}\n` : ''}`);
    return usage ? EXIT.usage : EXIT.error;
  }
}

process.exitCode = await runCli(process.argv.slice(2));
