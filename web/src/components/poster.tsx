/**
 * A movie poster: TMDB's image when a key is set and TMDB knows the title, else a generated
 * placeholder (title on a colour derived from the title, so each film keeps its colour).
 *
 * Loading follows tw-frontend-ux principles 1 and 5: the 2:3 box is reserved before any bytes
 * arrive, a shimmer shows while the image loads (tracked per `src`, with `key={src}` so an old
 * image never lingers), the image fades in on load, and a failed image falls back to the
 * placeholder in the same box.
 */
import { useEffect, useRef, useState } from 'react';
import { CMD } from '@/commands/index';
import { defaults } from '@/defaults';
import { cn } from '@/lib/utils';
import { imageUrl } from '@/sources/tmdb';
import { useApp, useDispatch } from '@/state/hooks';

/** A stable hue (0-359) from a string. */
const hueOf = (text: string) => {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
};

export function PosterPlaceholder({ title, year, className }: { title: string; year?: number | null; className?: string }) {
  const hue = hueOf(title);
  return (
    <div
      aria-hidden
      className={cn('flex aspect-[2/3] w-full flex-col justify-end overflow-hidden rounded-md p-3 text-white', className)}
      style={{ background: `linear-gradient(160deg, hsl(${hue} 45% 38%), hsl(${(hue + 40) % 360} 55% 18%))` }}
    >
      <span className="line-clamp-4 text-sm leading-tight font-semibold">{title}</span>
      {year ? <span className="text-xs opacity-80">{year}</span> : null}
    </div>
  );
}

/** Ask for this title's TMDB enrichment once a key is set (the command caches it). */
export function useEnrichment(imdbId: string) {
  const hasKey = useApp((s) => s.settings.tmdbApiKey !== '');
  const region = useApp((s) => s.settings.region);
  const entry = useApp((s) => s.enrichment[imdbId]);
  const dispatch = useDispatch();
  useEffect(() => {
    if (hasKey) void dispatch(CMD.enrichMovie, { imdb_id: imdbId });
  }, [hasKey, region, imdbId, dispatch]);
  return { hasKey, entry };
}

function TmdbImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [state, setState] = useState<{ src: string; status: 'loading' | 'loaded' | 'error' }>({ src, status: 'loading' });
  const ref = useRef<HTMLImageElement>(null);
  // Status belongs to the current `src`: a new src is "loading" at once, with no effect race.
  const status = state.src === src ? state.status : 'loading';
  useEffect(() => {
    // A cached image may already be complete before React attaches onLoad.
    if (ref.current?.complete && ref.current.naturalWidth > 0) setState({ src, status: 'loaded' });
  }, [src]);
  if (status === 'error') return null;
  return (
    <>
      {status === 'loading' && <div className="skeleton absolute inset-0" aria-hidden />}
      <img
        key={src}
        ref={ref}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setState({ src, status: 'loaded' })}
        onError={() => setState({ src, status: 'error' })}
        className={cn('absolute inset-0 size-full object-cover transition-opacity duration-300', status === 'loaded' ? 'opacity-100' : 'opacity-0', className)}
      />
    </>
  );
}

export function Poster({ imdbId, title, year, className }: { imdbId: string; title: string; year?: number | null; className?: string }) {
  const { entry } = useEnrichment(imdbId);
  const src = imageUrl(entry?.data?.poster_path, defaults.tmdb.posterSize);
  return (
    <div className={cn('relative aspect-[2/3] w-full overflow-hidden rounded-md', className)} aria-busy={entry?.status === 'loading'}>
      <PosterPlaceholder title={title} year={year} className="absolute inset-0" />
      {entry?.status === 'loading' && !src && <div className="skeleton absolute inset-0 opacity-60" aria-hidden />}
      {src && <TmdbImage src={src} alt={`Poster of ${title}`} />}
    </div>
  );
}
