/**
 * The app shell: header navigation, the screen for the current route, and per-navigation
 * housekeeping (document title, scroll to top on a new screen, focus to the main region).
 *
 * The route comes from the URL (`useRoute`); an unknown hash is redirected home with a replace.
 * Screens that need the artifact set sit behind `ArtifactsGate`.
 */
import { useEffect, useRef } from 'react';
import { CMD } from '@/commands/index';
import { ArtifactsGate } from '@/components/artifacts-gate';
import { RouteLink } from '@/components/route-link';
import { defaults } from '@/defaults';
import { cn } from '@/lib/utils';
import { AboutPage } from '@/pages/about-page';
import { MoviePage } from '@/pages/movie-page';
import { RatingsPage } from '@/pages/ratings-page';
import { RecommendPage } from '@/pages/recommend-page';
import { SciencePage } from '@/pages/science-page';
import { SettingsPage } from '@/pages/settings-page';
import { HOME, navigate, useRoute, type Route, type Screen } from '@/route';
import { useApp, useArtifacts, useDispatch } from '@/state/hooks';

const NAV: { screen: Screen; label: string }[] = [
  { screen: 'recommend', label: 'Recommend' },
  { screen: 'ratings', label: 'Ratings' },
  { screen: 'science', label: 'Science' },
  { screen: 'settings', label: 'Settings' },
  { screen: 'about', label: 'About' },
];

const SCREEN_TITLE: Record<Screen, string> = {
  recommend: 'Recommend',
  ratings: 'Your ratings',
  movie: 'Movie',
  science: 'For scientists',
  settings: 'Settings',
  about: 'About',
};

function useDocumentTitle(route: Route | null) {
  const artifacts = useArtifacts();
  const movieTitle = route?.screen === 'movie' && route.id ? artifacts?.catalog[artifacts.idToIdx.get(route.id) ?? -1]?.title : undefined;
  useEffect(() => {
    const page = movieTitle ?? (route ? SCREEN_TITLE[route.screen] : '');
    document.title = page ? `${page} · ${defaults.app.name}` : defaults.app.name;
  }, [route, movieTitle]);
}

function Screen({ route }: { route: Route }) {
  switch (route.screen) {
    case 'recommend':
      return (
        <ArtifactsGate>
          <RecommendPage />
        </ArtifactsGate>
      );
    case 'ratings':
      return <RatingsPage />;
    case 'movie':
      return <ArtifactsGate>{route.id ? <MoviePage imdbId={route.id} /> : null}</ArtifactsGate>;
    case 'science':
      return (
        <ArtifactsGate>
          <SciencePage />
        </ArtifactsGate>
      );
    case 'settings':
      return <SettingsPage />;
    case 'about':
      return <AboutPage />;
  }
}

export function App() {
  const route = useRoute();
  const dispatch = useDispatch();
  const artifactsStatus = useApp((s) => s.artifacts.status);
  const mainRef = useRef<HTMLElement>(null);
  useDocumentTitle(route);

  // Load the stored data and the artifact set once.
  useEffect(() => {
    if (artifactsStatus === 'idle') void dispatch(CMD.load);
  }, [artifactsStatus, dispatch]);

  // An unknown hash is a redirect home, not a place: replace, so Back does not return to it.
  useEffect(() => {
    if (route === null) navigate(HOME, { replace: true });
  }, [route]);

  // A new screen starts at the top, with focus in its main region (Back keeps the browser's
  // scroll restoration because the screen key is unchanged within one screen's refinements).
  const screenKey = route ? `${route.screen}/${route.id ?? ''}` : '';
  useEffect(() => {
    if (!screenKey) return;
    window.scrollTo?.(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [screenKey]);

  const active = route?.screen === 'movie' ? null : route?.screen;

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:rounded focus:bg-card focus:p-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <RouteLink to={HOME} className="text-lg font-bold tracking-tight">
            <span className="text-primary">flick</span>pick
          </RouteLink>
          <nav aria-label="Main" className="-mx-1 flex flex-wrap gap-1 overflow-x-auto">
            {NAV.map((item) => (
              <RouteLink
                key={item.screen}
                to={{ screen: item.screen, params: {} }}
                aria-current={active === item.screen ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted',
                  active === item.screen ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {item.label}
              </RouteLink>
            ))}
          </nav>
        </div>
      </header>
      <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 outline-none">
        {route && <Screen route={route} />}
      </main>
    </div>
  );
}
