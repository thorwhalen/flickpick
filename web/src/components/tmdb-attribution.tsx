/**
 * The attribution TMDB's and JustWatch's terms require wherever their data is shown. The text
 * comes from `TMDB_TERMS`, next to the client that fetches the data.
 */
import tmdbLogo from '@/assets/tmdb-logo.svg';
import { defaults } from '@/defaults';
import { TMDB_TERMS } from '@/sources/tmdb';

export function TmdbAttribution({ withJustWatch = false }: { withJustWatch?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <a href={defaults.tmdb.websiteUrl} target="_blank" rel="noreferrer" className="shrink-0">
        <img src={tmdbLogo} alt="TMDB" width={96} height={12} className="h-3 w-auto" />
      </a>
      <span>{TMDB_TERMS.attribution}</span>
      {withJustWatch && (
        <a href={defaults.tmdb.justWatchUrl} target="_blank" rel="noreferrer" className="underline">
          {TMDB_TERMS.justWatch}
        </a>
      )}
    </div>
  );
}
