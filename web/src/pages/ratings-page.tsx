/**
 * Ratings (`#/ratings`): import a ratings file (drag and drop or file picker) with a preview of
 * what was detected and how much matched the catalogue, then the ratings table (columns from the
 * zodal ratings collection) with inline score editing, delete, search and CSV export.
 */
import { toColumnDefs, type ColumnConfig } from '@zodal/ui';
import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { CMD } from '@/commands/index';
import { MovieTitleButton } from '@/components/movie-card';
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

function RatingsTable() {
  const ratings = useApp((s) => s.ratings);
  const artifacts = useArtifacts();
  const dispatch = useDispatch();
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim().toLowerCase(), defaults.ui.searchDebounceMs);
  const [sort, setSort] = useState<Sort>({ id: 'rated_at', desc: true });

  const rows = useMemo(() => {
    const all = Object.values(ratings).filter((r) => !query || (r.title ?? r.item_id).toLowerCase().includes(query));
    const sign = sort.desc ? -1 : 1;
    return all.sort((a, b) => sign * compare(a[sort.id as keyof RatingRow], b[sort.id as keyof RatingRow]));
  }, [ratings, query, sort]);
  const total = Object.keys(ratings).length;

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
      <Input type="search" placeholder="Search titles" aria-label="Search your ratings" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      {total === 0 ? (
        <Notice>No ratings yet. Import a file above, or rate titles on the Recommend page.</Notice>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
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
                <tr key={row.item_id} className="border-t">
                  {COLUMNS.map((c) => (
                    <td key={c.id} className={cn('px-3 py-2', c.id === 'score' && 'min-w-56')}>
                      <Cell column={c} row={row} inCatalog={Boolean(artifacts?.idToIdx.has(row.item_id))} />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      aria-label={`Delete your rating of ${row.title ?? row.item_id}`}
                      onClick={() => void dispatch(CMD.removeRating, { item_id: row.item_id })}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-3 text-sm text-muted-foreground">No rating matches “{search}”.</p>}
        </div>
      )}
    </Section>
  );
}

export function RatingsPage() {
  return (
    <div className="space-y-8">
      <ImportPanel />
      <RatingsTable />
    </div>
  );
}
