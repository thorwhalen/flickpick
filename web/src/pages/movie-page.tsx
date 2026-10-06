/**
 * Movie (`#/movie/<imdb_id>`): an overlay over the page it was opened from (a pushed history
 * entry, so Back or Escape or the close button returns there).
 *
 * Shows the catalogue facts (title, year, genres, population mean and count), your rating, the
 * collaborative neighbours (the item's row of the EASE matrix: "people who liked this also
 * liked") and the semantic neighbours (closest embeddings). With a TMDB key it adds poster,
 * backdrop, overview, runtime, certification and where to watch in your region, with the
 * mandatory TMDB and JustWatch attribution. TMDB data is display only.
 */
import { useEffect, useMemo, useRef } from 'react';
import { MovieTitleButton } from '@/components/movie-card';
import { Poster, useEnrichment } from '@/components/poster';
import { RatingControl } from '@/components/rating-control';
import { TmdbAttribution } from '@/components/tmdb-attribution';
import { RouteLink } from '@/components/route-link';
import { defaults } from '@/defaults';
import { cfNeighbours, semanticNeighbours, type Neighbour } from '@/lib/neighbours';
import { titleYear } from '@/lib/utils';
import { HOME, leaveTo, openedFrom } from '@/route';
import { imageUrl } from '@/sources/tmdb';
import { useApp, useArtifacts } from '@/state/hooks';
import type { RegionProviders, WatchProvider } from '@/state/schemas';
import { Button } from '@/ui/button';
import { Notice, Skeleton } from '@/ui/feedback';

function NeighbourList({ title, id, items, format }: { title: string; id: string; items: Neighbour[]; format: (w: number) => string }) {
  const artifacts = useArtifacts()!;
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3 id={id} className="font-semibold">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None in this artifact set.</p>
      ) : (
        <ol className="space-y-1 text-sm">
          {items.map((n) => {
            const item = artifacts.catalog[n.idx]!;
            return (
              <li key={n.idx} className="flex items-baseline justify-between gap-3">
                <MovieTitleButton imdbId={item.imdb_id}>{titleYear(item.title, item.year)}</MovieTitleButton>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{format(n.weight)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function ProviderRow({ label, providers }: { label: string; providers: WatchProvider[] }) {
  if (!providers.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="w-16 text-muted-foreground">{label}</span>
      {providers.map((p) => {
        const logo = imageUrl(p.logo_path, defaults.tmdb.providerLogoSize);
        return logo ? (
          <img key={p.provider_id} src={logo} alt={p.provider_name} title={p.provider_name} width={32} height={32} className="size-8 rounded-md" />
        ) : (
          <span key={p.provider_id} className="rounded border px-2 py-0.5 text-xs">
            {p.provider_name}
          </span>
        );
      })}
    </div>
  );
}

function WhereToWatch({ providers, region }: { providers: RegionProviders | null; region: string }) {
  const none = !providers || providers.flatrate.length + providers.rent.length + providers.buy.length === 0;
  return (
    <section aria-labelledby="watch-heading" className="space-y-2">
      <h3 id="watch-heading" className="font-semibold">
        Where to watch ({region})
      </h3>
      {none ? (
        <p className="text-sm text-muted-foreground">No streaming, rental or purchase offers listed for {region}.</p>
      ) : (
        <div className="space-y-2">
          <ProviderRow label="Stream" providers={providers.flatrate} />
          <ProviderRow label="Rent" providers={providers.rent} />
          <ProviderRow label="Buy" providers={providers.buy} />
          {providers.link && (
            <a href={providers.link} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
              All offers on TMDB
            </a>
          )}
        </div>
      )}
    </section>
  );
}

function Enriched({ imdbId }: { imdbId: string }) {
  const { hasKey, entry } = useEnrichment(imdbId);
  const region = useApp((s) => s.settings.region);
  if (!hasKey) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a TMDB API key in{' '}
        <RouteLink to={{ screen: 'settings', params: {} }} className="text-primary underline">
          Settings
        </RouteLink>{' '}
        to see the overview, runtime, certification and where to watch.
      </p>
    );
  }
  if (!entry || entry.status === 'loading') {
    return (
      <div className="space-y-2" aria-busy>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }
  if (entry.status === 'error') return <Notice tone="error">TMDB: {entry.error}</Notice>;
  const data = entry.data;
  if (!data?.found) return <p className="text-sm text-muted-foreground">TMDB has no entry for this title.</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
        {data.runtime ? <span>{data.runtime} min</span> : null}
        {data.certification ? <span>Rated {data.certification} ({region})</span> : null}
      </div>
      {data.overview && <p className="text-sm leading-relaxed">{data.overview}</p>}
      <WhereToWatch providers={data.providers} region={region} />
    </div>
  );
}

export function MoviePage({ imdbId }: { imdbId: string }) {
  const artifacts = useArtifacts()!;
  const idx = artifacts.idToIdx.get(imdbId);
  const item = idx === undefined ? undefined : artifacts.catalog[idx];
  const { entry } = useEnrichment(imdbId);
  const backdrop = imageUrl(entry?.data?.backdrop_path, defaults.tmdb.backdropSize);
  const close = () => leaveTo(openedFrom() ?? HOME);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const cf = useMemo(() => (idx === undefined ? [] : cfNeighbours(artifacts, idx, defaults.neighbours.cf)), [artifacts, idx]);
  const semantic = useMemo(
    () => (idx === undefined ? [] : semanticNeighbours(artifacts, idx, defaults.neighbours.semantic)),
    [artifacts, idx],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => headingRef.current?.focus(), [imdbId]);

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="movie-title" className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={close}>
          Close
        </Button>
      </div>
      {backdrop && (
        <div className="relative aspect-[16/6] w-full overflow-hidden rounded-lg bg-muted" aria-hidden>
          <img src={backdrop} alt="" className="size-full object-cover" />
        </div>
      )}
      {!item ? (
        <Notice tone="warning">
          {imdbId} is not in the loaded catalogue ({artifacts.manifest.name}).
        </Notice>
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,14rem)_1fr]">
          <div className="mx-auto w-full max-w-56">
            <Poster imdbId={imdbId} title={item.title} year={item.year} />
          </div>
          <div className="space-y-4">
            <div>
              <h1 id="movie-title" ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
                {item.title}
              </h1>
              <p className="text-sm text-muted-foreground">
                {[item.year, item.genres.join(' · ')].filter(Boolean).join(' · ')}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:max-w-md">
              <div>
                <dt className="text-muted-foreground">Population mean</dt>
                <dd className="text-lg tabular-nums">{item.mean_rating === null ? 'n/a' : `${item.mean_rating.toFixed(0)}/100`}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ratings</dt>
                <dd className="text-lg tabular-nums">{item.n_ratings.toLocaleString()}</dd>
              </div>
            </dl>
            <div className="space-y-1">
              <p className="text-sm font-medium">Your rating</p>
              <RatingControl itemId={imdbId} title={item.title} start={item.mean_rating} />
            </div>
            <Enriched imdbId={imdbId} />
          </div>
        </div>
      )}
      {item && (
        <div className="grid gap-6 md:grid-cols-2">
          <NeighbourList
            id="cf-heading"
            title="People who liked this also liked"
            items={cf}
            format={(w) => `weight ${w.toFixed(defaults.format.metricDigits)}`}
          />
          <NeighbourList
            id="semantic-heading"
            title="Similar in description"
            items={semantic}
            format={(w) => `similarity ${w.toFixed(defaults.format.statDigits)}`}
          />
        </div>
      )}
      <footer className="border-t pt-3">
        <TmdbAttribution withJustWatch />
      </footer>
    </div>
  );
}
