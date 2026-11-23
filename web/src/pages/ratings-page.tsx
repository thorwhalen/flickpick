/**
 * Ratings (`#/ratings`): import a ratings file (drag and drop or file picker) with a preview of
 * what was detected and how much matched the catalogue, then the ratings table (columns from the
 * zodal ratings collection) with inline score editing, delete, search and CSV export.
 */
import { toColumnDefs, type ColumnConfig } from '@zodal/ui';
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { advise, offerUndo } from 'undo-toast';
import { CMD } from '@/commands/index';
import { MovieTitleButton } from '@/components/movie-card';
import { useSetList } from '@/components/list-buttons';
import type { ListId } from '@/state/schemas';
import { RatingControl } from '@/components/rating-control';
import { defaults } from '@/defaults';
import { previewImport, type ImportPreview } from '@/lib/ratings-io';
import { cn, errorMessage } from '@/lib/utils';
import { useApp, useArtifacts, useDispatch } from '@/state/hooks';
import { ratingsCollection, type RatingRow } from '@/state/schemas';
import { Button } from '@/ui/button';
import { Card, Section } from '@/ui/card';
import { Notice, Spinner } from '@/ui/feedback';
import { Input } from '@/ui/input';

const FORMAT_LABEL: Record<ImportPreview['format'], string> = {
  letterboxd: 'Letterboxd export',
  imdb: 'IMDb ratings export',
  movielens: 'MovieLens ratings',
  flickpick: 'flickpick ratings file',
};

const EXAMPLE_URL = './data/examples/movie_ratings_various.csv';

function ImportPanel() {
  const artifacts = useArtifacts();
  const dispatch = useDispatch();
  const [pending, setPending] = useState<{ name: string; text: string; preview: ImportPreview } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const read = (name: string, text: string) => {
    setDone(null);
    try {
      setPending({ name, text, preview: previewImport(text, artifacts) });
      setError(null);
    } catch (e) {
      setPending(null);
      setError(`${name}: ${errorMessage(e)}`);
    }
  };
  const readFile = async (file: File | undefined) => file && read(file.name, await file.text());
  const loadExample = async () => {
    try {
      const res = await fetch(EXAMPLE_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      read('movie_ratings_various.csv', await res.text());
    } catch (e) {
      setError(`Could not fetch the example file (${errorMessage(e)})`);
    }
  };
  const runImport = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    setBusy(true);
    const result = await dispatch<{ imported: number; matched: number }>(CMD.importRatings, { csv: pending.text, mode });
    setBusy(false);
    if (result.ok) {
      setDone(`Imported ${result.value.imported} ratings from ${pending.name} (${result.value.matched} in the catalogue).`);
      setPending(null);
    } else setError(result.error.message);
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void readFile(event.dataTransfer.files[0]);
  };

  return (
    <Section title="Import ratings" id="import-heading">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors',
          dragging ? 'border-primary bg-accent' : 'border-input',
        )}
      >
        <p>Drop a Letterboxd, IMDb, MovieLens or flickpick CSV here, or</p>
        <div className="flex flex-wrap justify-center gap-2">
          <label className="inline-flex cursor-pointer items-center rounded-md border border-input bg-card px-4 py-2 font-medium hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
            Choose a file
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                void readFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <Button variant="ghost" onClick={() => void loadExample()}>
            Try the example ratings
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">The file is read in this browser; nothing is uploaded.</p>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {done && <Notice>{done}</Notice>}
      {pending && (
        <Card className="space-y-3 p-4" aria-label="Import preview">
          <p className="text-sm">
            <span className="font-medium">{pending.name}</span>: {FORMAT_LABEL[pending.preview.format]}, {pending.preview.rows.length} ratings,{' '}
            <span className="font-medium">{pending.preview.matched} in the catalogue</span>
            {artifacts ? ` (${artifacts.manifest.name})` : ''}.
          </p>
          {pending.preview.unmatched.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Not in this catalogue (kept, and matched again when a larger artifact set is loaded):{' '}
              {pending.preview.unmatched.slice(0, defaults.import.unmatchedShown).join('; ')}
              {pending.preview.unmatched.length > defaults.import.unmatchedShown &&
                ` and ${pending.preview.unmatched.length - defaults.import.unmatchedShown} more`}
              .
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void runImport('merge')}>
              Import {pending.preview.rows.length} ratings
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void runImport('replace')}>
              Replace all my ratings
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setPending(null)}>
              Cancel
            </Button>
            {busy && <Spinner label="Importing" />}
          </div>
        </Card>
      )}
    </Section>
  );
}

/** Table columns from the zodal collection (the schema), minus the selection column. */
const COLUMNS: ColumnConfig[] = toColumnDefs(ratingsCollection).filter((c) => c.meta.zodType !== 'display');

type Sort = { id: string; desc: boolean };

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  return typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b) : a < b ? -1 : 1;
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function Cell({ column, row, inCatalog }: { column: ColumnConfig; row: RatingRow; inCatalog: boolean }) {
  const value = row[column.id as keyof RatingRow];
  if (column.meta.inlineEditable && column.meta.zodType === 'number') {
    return <RatingControl itemId={row.item_id} title={row.title ?? row.item_id} compact />;
  }
  if (column.id === 'title') {
    const label = row.title ?? row.item_id;
    return inCatalog ? (
      <MovieTitleButton imdbId={row.item_id}>{label}</MovieTitleButton>
    ) : (
      <span title="Not in the loaded catalogue">
        {label} <span className="text-xs text-muted-foreground">(not in catalogue)</span>
      </span>
    );
  }
  if (column.id === 'rated_at' && typeof value === 'string') {
    const date = new Date(value);
    return <span className="tabular-nums">{Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()}</span>;
  }
  return <span className="tabular-nums">{value === undefined ? '' : String(value)}</span>;
}

/** The quick views over the ratings: system views, each a membership rule on the score (the fleet's
 *  views design; saved user views come with zodal's view store). */
const QUICK_VIEWS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'loved', label: 'Loved (80+)', test: (r: RatingRow) => r.score >= 80 },
  { id: 'liked', label: 'Liked (60-79)', test: (r: RatingRow) => r.score >= 60 && r.score < 80 },
  { id: 'mixed', label: 'Mixed (40-59)', test: (r: RatingRow) => r.score >= 40 && r.score < 60 },
  { id: 'disliked', label: 'Disliked (<40)', test: (r: RatingRow) => r.score < 40 },
  { id: 'unmatched', label: 'Not in catalogue', test: (r: RatingRow) => Boolean(r.needs_resolution) },
] as const;
type QuickViewId = (typeof QUICK_VIEWS)[number]['id'];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function RatingsTable() {
  const ratings = useApp((s) => s.ratings);
  const artifacts = useArtifacts();
  const dispatch = useDispatch();
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim().toLowerCase(), defaults.ui.searchDebounceMs);
  const [sort, setSort] = useState<Sort>({ id: 'rated_at', desc: true });
  const [view, setView] = useState<QuickViewId>('all');
  const [genre, setGenre] = useState('');
  // A rated title's genres, from the catalogue (an unmatched one has none).
  const genresOf = useMemo(() => {
    const catalog = artifacts?.catalog;
    return (id: string): readonly string[] => {
      const idx = artifacts?.idToIdx.get(id);
      return idx === undefined || !catalog ? [] : (catalog[idx]?.genres ?? []);
    };
  }, [artifacts]);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const anchor = useRef<string | null>(null);
  const [rescore, setRescore] = useState('');
  const [busy, setBusy] = useState(false);

  const all = useMemo(() => Object.values(ratings), [ratings]);
  const rows = useMemo(() => {
    const test = QUICK_VIEWS.find((v) => v.id === view)?.test ?? (() => true);
    const shown = all.filter((r) => test(r) && (!genre || genresOf(r.item_id).includes(genre)) && (!query || (r.title ?? r.item_id).toLowerCase().includes(query)));
    const sign = sort.desc ? -1 : 1;
    return shown.sort((a, b) => sign * compare(a[sort.id as keyof RatingRow], b[sort.id as keyof RatingRow]));
  }, [all, view, query, sort, genre, genresOf]);
  const genres = useMemo(() => [...new Set(all.flatMap((r) => genresOf(r.item_id)))].sort(), [all, genresOf]);
  const total = all.length;
  // The picked titles that are still rated (a removal elsewhere drops them).
  const pickedRows = useMemo(() => all.filter((r) => picked.has(r.item_id)), [all, picked]);
  const shownPicked = rows.filter((r) => picked.has(r.item_id)).length;
  const headBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headBox.current) headBox.current.indeterminate = shownPicked > 0 && shownPicked < rows.length;
  }, [shownPicked, rows.length]);

  /** Tick one; with Shift, every shown row from the last one ticked to this one. */
  function pick(id: string, range: boolean) {
    // Read the anchor now: the updater below runs later, after the anchor has moved to `id`.
    const from = range ? anchor.current : null;
    const order = rows.map((r) => r.item_id);
    setPicked((was) => {
      const next = new Set(was);
      const a = from ? order.indexOf(from) : -1;
      const b = order.indexOf(id);
      if (a >= 0 && b >= 0) for (const x of order.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(x);
      else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    anchor.current = id;
  }

  /** Remove ratings: one command, one Undo that puts every row back as it was (no question first). */
  async function remove(ids: readonly string[]) {
    if (busy) return; // a second press while the first runs would remove nothing and replace its Undo
    setBusy(true);
    const result = await dispatch<{ removed: RatingRow[] }>(CMD.removeRatings, { item_ids: ids }).finally(() => setBusy(false));
    if (!result.ok) return;
    const removed = result.value.removed;
    setPicked((was) => new Set([...was].filter((x) => !removed.some((r) => r.item_id === x))));
    const name = removed.length === 1 ? `Rating of “${removed[0]?.title ?? removed[0]?.item_id}”` : plural(removed.length, 'rating', 'ratings');
    offerUndo({
      message: `${name} removed`,
      advice: advise(removed.length === 1 ? 'remove-item' : 'bulk-delete', { count: removed.length }),
      // Only titles still unrated come back: one rated again since keeps its new score.
      undo: async () => (await dispatch(CMD.restoreRatings, { rows: removed, expect: Object.fromEntries(removed.map((r) => [r.item_id, null])) })).ok,
    });
  }

  /** Give the picked titles one score: one command, one Undo that restores each old score. */
  async function rescoreTo(score: number) {
    if (busy) return;
    setBusy(true);
    const result = await dispatch<{ before: RatingRow[]; at: string }>(CMD.rescoreRatings, { item_ids: pickedRows.map((r) => r.item_id), score }).finally(() =>
      setBusy(false),
    );
    if (!result.ok) return;
    const { before, at } = result.value;
    if (!before.length) return; // every selected title already had this score: nothing changed, nothing to undo
    offerUndo({
      message: `${plural(before.length, 'title', 'titles')} rescored to ${score}`,
      advice: advise({ reversal: 'compensating', cost: 'low', count: before.length }),
      // Only titles still at this rescore come back: one changed since keeps its new score.
      undo: async () => (await dispatch(CMD.restoreRatings, { rows: before, expect: Object.fromEntries(before.map((r) => [r.item_id, at])) })).ok,
    });
  }

  const score = Number(rescore);
  const scoreOk = rescore.trim() !== '' && Number.isInteger(score) && score >= defaults.rating.min && score <= defaults.rating.max;

  return (
    <Section
      title={`Your ratings (${total})`}
      id="ratings-heading"
      actions={
        <Button variant="outline" size="sm" disabled={total === 0} onClick={() => void dispatch(CMD.exportRatings)}>
          Export CSV
        </Button>
      }
    >
      <div className="flex flex-wrap gap-1" role="group" aria-label="Show">
        {QUICK_VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            onClick={() => setView(v.id)}
            className={cn('rounded-full border px-3 py-1 text-sm', view === v.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
          >
            {v.label} <span className="tabular-nums opacity-75">{all.filter(v.test).length}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input type="search" placeholder="Search titles" aria-label="Search your ratings" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {genres.length > 0 && (
          <select aria-label="Genre" value={genre} onChange={(e) => setGenre(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="">All genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
      </div>
      {pickedRows.length > 0 && (
        <div role="region" aria-label="Selected ratings" className="sticky top-[var(--header-h,3.5rem)] z-[5] flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 text-sm">
          <span aria-live="polite" className="font-medium">
            {plural(pickedRows.length, 'title', 'titles')} selected
            {pickedRows.length > shownPicked ? ` (${pickedRows.length - shownPicked} not shown)` : ''}
          </span>
          <label className="flex items-center gap-1">
            <span className="sr-only">New score</span>
            <Input type="number" inputMode="numeric" min={defaults.rating.min} max={defaults.rating.max} placeholder="Score" value={rescore} onChange={(e) => setRescore(e.target.value)} className="w-24" />
          </label>
          <Button size="sm" variant="outline" disabled={!scoreOk || busy} onClick={() => void rescoreTo(score)}>
            Set score
          </Button>
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => void remove(pickedRows.map((r) => r.item_id))}>
            Remove {pickedRows.length}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>
            Clear
          </Button>
        </div>
      )}
      {total === 0 ? (
        <Notice>No ratings yet. Import a file above, or rate titles on the Recommend page.</Notice>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th scope="col" className="w-8 px-3 py-2">
                  <input
                    ref={headBox}
                    type="checkbox"
                    aria-label="Select all shown"
                    checked={rows.length > 0 && shownPicked === rows.length}
                    onChange={() => {
                      // Only the shown rows: picks hidden by the view or the search stay as they are.
                      const shownIds = rows.map((r) => r.item_id);
                      setPicked((was) => (shownPicked === rows.length ? new Set([...was].filter((x) => !shownIds.includes(x))) : new Set([...was, ...shownIds])));
                    }}
                  />
                </th>
                {COLUMNS.map((c) => (
                  <th key={c.id} scope="col" className="px-3 py-2 font-medium" aria-sort={sort.id === c.id ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
                    {c.enableSorting ? (
                      <button
                        type="button"
                        className="hover:underline"
                        onClick={() => setSort((s) => ({ id: c.id, desc: s.id === c.id ? !s.desc : c.meta.zodType === 'number' }))}
                      >
                        {c.header}
                        {sort.id === c.id ? (sort.desc ? ' ↓' : ' ↑') : ''}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.item_id} className={cn('border-t', picked.has(row.item_id) && 'bg-muted/60')}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.title ?? row.item_id}`}
                      checked={picked.has(row.item_id)}
                      onChange={() => undefined}
                      onClick={(e) => pick(row.item_id, e.shiftKey)}
                    />
                  </td>
                  {COLUMNS.map((c) => (
                    <td key={c.id} className={cn('px-3 py-2', c.id === 'score' && 'min-w-56')}>
                      <Cell column={c} row={row} inCatalog={Boolean(artifacts?.idToIdx.has(row.item_id))} />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      aria-label={`Remove your rating of ${row.title ?? row.item_id}`}
                      onClick={() => void remove([row.item_id])}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-3 text-sm text-muted-foreground">{search ? `No rating matches “${search}”.` : 'No ratings in this view.'}</p>}
        </div>
      )}
    </Section>
  );
}

/** The watchlist and the not-interested list: each title opens its page; taking it off has one Undo. */
function Lists() {
  const lists = useApp((s) => s.lists);
  const setList = useSetList();
  const [which, setWhich] = useState<ListId>('watchlist');
  const entries = Object.values(lists)
    .filter((e) => e.list === which)
    .sort((a, b) => b.added_at.localeCompare(a.added_at));
  const count = (id: ListId) => Object.values(lists).filter((e) => e.list === id).length;
  return (
    <Section title="Your lists" id="lists-heading">
      <div className="flex flex-wrap gap-1" role="group" aria-label="List">
        {(['watchlist', 'not_interested'] as const).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={which === id}
            onClick={() => setWhich(id)}
            className={cn('rounded-full border px-3 py-1 text-sm', which === id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
          >
            {id === 'watchlist' ? 'Watchlist' : 'Not interested'} <span className="tabular-nums opacity-75">{count(id)}</span>
          </button>
        ))}
      </div>
      {entries.length === 0 ? (
        <Notice>{which === 'watchlist' ? 'Nothing on your watchlist yet: add titles from the Recommend page.' : 'Nothing here: titles you mark Not interested are left out of recommendations.'}</Notice>
      ) : (
        <ul className="divide-y rounded-lg border">
          {entries.map((e) => (
            <li key={e.item_id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <MovieTitleButton imdbId={e.item_id}>{e.title ?? e.item_id}</MovieTitleButton>
              <Button size="sm" variant="ghost" aria-label={`Take ${e.title ?? e.item_id} off this list`} onClick={() => void setList(e.item_id, e.title, null)}>
                Take off
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function RatingsPage() {
  return (
    <div className="space-y-8">
      <ImportPanel />
      <Lists />
      <RatingsTable />
    </div>
  );
}
