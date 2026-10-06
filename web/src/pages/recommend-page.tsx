/**
 * Recommend (`#/`): the structured query form and the results.
 *
 * The form lives in the URL (filters replace the history entry, they are not places). Any change
 * re-runs `app.recs.recommend`; the mood is typed into a local draft and applied on Enter or the
 * button, so the model is loaded only for a mood someone actually submitted, and never without one.
 */
import { useEffect, useMemo, useState } from 'react';
import { CMD } from '@/commands/index';
import { MovieCard } from '@/components/movie-card';
import { RouteLink } from '@/components/route-link';
import { defaults } from '@/defaults';
import { navigate, useRoute } from '@/route';
import { useApp, useArtifacts, useDispatch } from '@/state/hooks';
import { formFromParams, paramsFromForm, type RecommendForm } from '@/state/recommend-form';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { Notice, ProgressBar, Skeleton } from '@/ui/feedback';
import { Input } from '@/ui/input';
import { useEditBuffer } from '@/ui/edit-buffer';

/** Genres that are not genres. */
const NOT_A_GENRE = new Set(['(no genres listed)']);

function useForm(): [RecommendForm, (next: RecommendForm) => void] {
  const route = useRoute();
  const params = route?.params;
  const form = useMemo(() => formFromParams(params ?? {}), [params]);
  const setForm = (next: RecommendForm) => navigate({ screen: 'recommend', params: paramsFromForm(next) }, { replace: true });
  return [form, setForm];
}

function YearField({
  label,
  value,
  bounds,
  onValue,
}: {
  label: string;
  value: number | undefined;
  bounds: { min: number; max: number };
  onValue: (v: number | undefined) => void;
}) {
  const field = useEditBuffer<number | undefined>({
    value,
    format: (v) => (v === undefined ? '' : String(v)),
    parse: (draft) => {
      if (draft.trim() === '') return undefined;
      const n = Number(draft);
      return Number.isInteger(n) && n >= bounds.min && n <= bounds.max ? n : null;
    },
    onValue,
  });
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input
        inputMode="numeric"
        className="w-24"
        placeholder={String(label.startsWith('From') ? bounds.min : bounds.max)}
        aria-invalid={field.invalid}
        value={field.value}
        onChange={field.onChange}
        onBlur={field.onBlur}
      />
    </label>
  );
}

function CountField({ value, onValue }: { value: number; onValue: (v: number) => void }) {
  const { kMin, kMax } = defaults.recommend;
  const field = useEditBuffer<number>({
    value,
    format: String,
    parse: (draft) => {
      const n = Number(draft);
      return Number.isInteger(n) && n >= kMin && n <= kMax ? n : null;
    },
    onValue,
  });
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">How many</span>
      <Input inputMode="numeric" className="w-20" aria-invalid={field.invalid} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
    </label>
  );
}

function GenrePicker({
  genres,
  label,
  selected,
  tone,
  onToggle,
}: {
  genres: string[];
  label: string;
  selected: string[];
  tone: 'include' | 'exclude';
  onToggle: (genre: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm text-muted-foreground">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {genres.map((g) => (
          <Chip key={g} pressed={selected.includes(g)} tone={tone} onClick={() => onToggle(g)}>
            {g}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

function QueryForm({ form, setForm }: { form: RecommendForm; setForm: (f: RecommendForm) => void }) {
  const artifacts = useArtifacts()!;
  const embeddingEnabled = useApp((s) => s.settings.embeddingEnabled);
  const hasEmbeddings = Boolean(artifacts.embeddings);
  const [mood, setMood] = useState(form.mood);
  // A Back/Forward or a pasted link brings a different mood: show it.
  useEffect(() => setMood(form.mood), [form.mood]);

  const genres = useMemo(
    () => [...new Set(artifacts.catalog.flatMap((c) => c.genres))].filter((g) => !NOT_A_GENRE.has(g)).sort(),
    [artifacts],
  );
  const years = useMemo(() => {
    const ys = artifacts.catalog.map((c) => c.year).filter((y): y is number => y !== null);
    return { min: Math.min(...ys), max: Math.max(...ys) };
  }, [artifacts]);
  const moodAvailable = embeddingEnabled && hasEmbeddings;
  const filtered = form.include_genres.length + form.exclude_genres.length > 0 || form.year_min !== undefined || form.year_max !== undefined;

  return (
    <Card className="space-y-4 p-4">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setForm({ ...form, mood: mood.trim() });
        }}
      >
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Mood</span>
          <Input
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            placeholder={moodAvailable ? 'e.g. slow-burn melancholic sci-fi, nothing gory' : 'mood search is off'}
            disabled={!moodAvailable}
            aria-describedby="mood-help"
          />
        </label>
        <Button type="submit">Recommend</Button>
      </form>
      <p id="mood-help" className="text-xs text-muted-foreground">
        {!hasEmbeddings
          ? 'This artifact set has no embeddings, so mood search is unavailable.'
          : !embeddingEnabled
            ? 'Mood search is off in Settings.'
            : 'Describe a feel or a theme. The first mood downloads a small language model (about 35 MB) that runs in your browser; without a mood, nothing is downloaded.'}
      </p>
      <GenrePicker
        genres={genres}
        label="Include any of these genres"
        selected={form.include_genres}
        tone="include"
        onToggle={(g) => setForm({ ...form, include_genres: toggle(form.include_genres, g) })}
      />
      <GenrePicker
        genres={genres}
        label="Exclude these genres"
        selected={form.exclude_genres}
        tone="exclude"
        onToggle={(g) => setForm({ ...form, exclude_genres: toggle(form.exclude_genres, g) })}
      />
      <div className="flex flex-wrap items-end gap-4">
        <YearField label="From year" value={form.year_min} bounds={years} onValue={(v) => setForm({ ...form, year_min: v })} />
        <YearField label="To year" value={form.year_max} bounds={years} onValue={(v) => setForm({ ...form, year_max: v })} />
        <CountField value={form.k} onValue={(k) => setForm({ ...form, k })} />
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => setForm({ ...form, include_genres: [], exclude_genres: [], year_min: undefined, year_max: undefined })}
          >
            Clear filters
          </Button>
        )}
      </div>
    </Card>
  );
}

function Results({ form, setForm }: { form: RecommendForm; setForm: (f: RecommendForm) => void }) {
  const recs = useApp((s) => s.recs);
  const model = useApp((s) => s.model);
  const nRatings = useApp((s) => Object.keys(s.ratings).length);
  const gridClass = 'grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5';

  return (
    <section aria-labelledby="results-heading" aria-busy={recs.status === 'loading'} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="results-heading" className="text-lg font-semibold">
          Recommendations
        </h2>
        <p className="text-sm text-muted-foreground">
          {nRatings === 0 ? (
            <>
              No ratings yet, so these lean on popularity.{' '}
              <RouteLink to={{ screen: 'ratings', params: {} }} className="text-primary underline">
                Import your ratings
              </RouteLink>
            </>
          ) : (
            `Based on your ${nRatings} ratings.`
          )}
        </p>
      </div>
      {model.status === 'loading' && <ProgressBar value={model.progress} label="Downloading the mood model (first time only)" />}
      {model.status === 'error' && <Notice tone="error">The mood model could not be loaded: {model.error}</Notice>}
      {recs.warnings.map((w) => (
        <Notice key={w} tone="warning">
          {w}
        </Notice>
      ))}
      {recs.status === 'error' && <Notice tone="error">{recs.error}</Notice>}
      {recs.status === 'loading' && recs.items.length === 0 ? (
        <div className={gridClass}>
          {Array.from({ length: form.k }, (_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      ) : recs.status === 'ready' && recs.items.length === 0 ? (
        <Notice>
          No titles match these filters.{' '}
          <button
            type="button"
            className="text-primary underline"
            onClick={() => setForm({ ...form, include_genres: [], exclude_genres: [], year_min: undefined, year_max: undefined })}
          >
            Clear the filters
          </button>
        </Notice>
      ) : (
        <ol className={gridClass} aria-label="Recommended titles">
          {recs.items.map((rec, i) => (
            <li key={rec.item_id} className="contents">
              <MovieCard rec={rec} rank={i + 1} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function RecommendPage() {
  const [form, setForm] = useForm();
  const dispatch = useDispatch();
  const artifactsName = useApp((s) => s.artifacts.name);
  const embeddingEnabled = useApp((s) => s.settings.embeddingEnabled);
  const formKey = JSON.stringify(form);

  // Run the query whenever it (or the data it runs on) changes. Ratings changes re-run inside
  // the rating commands themselves, so they are not a dependency here.
  useEffect(() => {
    if (artifactsName) void dispatch(CMD.recommend, JSON.parse(formKey));
  }, [formKey, artifactsName, embeddingEnabled, dispatch]);

  return (
    <div className="space-y-6">
      <QueryForm form={form} setForm={setForm} />
      <Results form={form} setForm={setForm} />
    </div>
  );
}
