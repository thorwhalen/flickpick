/**
 * Where the app is, as a URL, and the one module that decides what Back does.
 *
 * Nothing else in the app calls `history.*`. Routes live in the hash (`#/ratings`,
 * `#/movie/tt0114369`), so the built app works on any static host without server-side
 * rewrites (a path like `/ratings` would 404 on reload on GitHub Pages).
 *
 * | What changed                         | History     | Why                                              |
 * |--------------------------------------|-------------|--------------------------------------------------|
 * | the screen (recommend, ratings, ...) | **push**    | the person "went" somewhere; Back returns        |
 * | the movie overlay opened             | **push**    | Back closes it, the first thing a phone user tries |
 * | recommend filters (mood, genres, k)  | replace     | a refinement of the same view: kept in the URL so a link reproduces it, but not a step |
 * | an unknown or empty hash             | replace     | a redirect, not a place                          |
 *
 * Closing the movie overlay goes Back when the entry underneath is the page it was opened over
 * (remembered as `from` in `history.state`), and otherwise replaces: an overlay reached by a
 * pasted link has nothing of ours underneath, and Back would leave the app.
 * See `tw-frontend-ux` principle 2.
 */
import { useMemo, useSyncExternalStore } from 'react';

export const SCREENS = ['recommend', 'ratings', 'movie', 'science', 'settings', 'about'] as const;
export type Screen = (typeof SCREENS)[number];

export interface Route {
  readonly screen: Screen;
  /** The path argument (the `imdb_id` of `movie`). */
  readonly id?: string;
  readonly params: Readonly<Record<string, string>>;
}

/** The path segment of each screen (`recommend` is the root). */
const PATH: Record<Screen, string> = {
  recommend: '',
  ratings: 'ratings',
  movie: 'movie',
  science: 'science',
  settings: 'settings',
  about: 'about',
};
const SCREEN_BY_PATH = new Map(Object.entries(PATH).map(([screen, path]) => [path, screen as Screen]));

/** Screens that take an id in the path. */
const NEEDS_ID: ReadonlySet<Screen> = new Set(['movie']);

export const HOME: Route = { screen: 'recommend', params: {} };

/** A route from a hash, or `null` when the hash names no screen. */
export function parseRoute(hash: string): Route | null {
  const body = hash.replace(/^#\/?/, '');
  const q = body.indexOf('?');
  const path = (q >= 0 ? body.slice(0, q) : body).replace(/\/+$/, '');
  const [head = '', id, ...rest] = path.split('/').map(decodeURIComponent);
  const screen = SCREEN_BY_PATH.get(head);
  if (!screen || rest.length) return null;
  if (NEEDS_ID.has(screen) !== Boolean(id)) return null;
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(q >= 0 ? body.slice(q + 1) : '')) if (v !== '') params[k] = v;
  return { screen, ...(id ? { id } : {}), params };
}

/** The hash for a route. Parameters are sorted, so one route has one spelling. */
export function formatRoute(route: Route): string {
  const segments = [PATH[route.screen], route.id].filter((s): s is string => Boolean(s)).map(encodeURIComponent);
  const entries = Object.entries(route.params)
    .filter(([, v]) => v !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  const query = new URLSearchParams(entries).toString();
  return `#/${segments.join('/')}${query ? `?${query}` : ''}`;
}

const ROUTE_EVENT = 'flickpick:route';

/** What a pushed entry remembers about how it was reached. */
export interface RouteState {
  /** The hash this entry was pushed from. */
  readonly from?: string;
}

/**
 * Go to `route`. `replace` is for refinements of the current view and for redirects; going
 * somewhere is a push. Going to where you already are records nothing.
 */
export function navigate(route: Route, { replace = false }: { replace?: boolean } = {}): void {
  const next = formatRoute(route);
  const current = window.location.hash || '#/';
  if (current === next) return;
  if (replace) {
    window.history.replaceState(window.history.state, '', next);
  } else {
    const state: RouteState = { from: current };
    window.history.pushState(state, '', next);
  }
  window.dispatchEvent(new Event(ROUTE_EVENT));
}

/** Leave a pushed overlay (the movie page) for `parent`: Back when it is underneath, else replace. */
export function leaveTo(parent: Route): void {
  const state = window.history.state as RouteState | null;
  if (state?.from && state.from === formatRoute(parent)) {
    // Forget the way back before taking it: `back()` lands asynchronously, and a second close
    // (a double Escape) arriving first would otherwise go back twice and could leave the app.
    window.history.replaceState({ ...state, from: undefined }, '');
    window.history.back();
    return;
  }
  navigate(parent, { replace: true });
}

/** The route an overlay was opened over (its `from`), if that was one of ours. */
export function openedFrom(): Route | null {
  const state = window.history.state as RouteState | null;
  return state?.from ? parseRoute(state.from) : null;
}

/** Subscribe to every way the route changes (our pushes, Back/Forward, a pasted link). */
export function subscribeRoute(onChange: () => void): () => void {
  window.addEventListener(ROUTE_EVENT, onChange);
  window.addEventListener('popstate', onChange);
  window.addEventListener('hashchange', onChange);
  return () => {
    window.removeEventListener(ROUTE_EVENT, onChange);
    window.removeEventListener('popstate', onChange);
    window.removeEventListener('hashchange', onChange);
  };
}

const currentHash = () => window.location.hash;

/** The current route (or `null` for an unknown hash), kept current by `useSyncExternalStore`. */
export function useRoute(): Route | null {
  // useSyncExternalStore re-renders the component whenever `currentHash()` changes after one of
  // the subscribed events: the URL is the state, and no component mirrors it in useState.
  const hash = useSyncExternalStore(subscribeRoute, currentHash, () => '');
  return useMemo(() => parseRoute(hash), [hash]);
}
