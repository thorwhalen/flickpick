/**
 * The history policy: screens push, filters replace, Back lands on the previous screen and never
 * leaves the app. (Mutation check: make `navigate` always replace and the Back tests go red.)
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { formatRoute, HOME, leaveTo, navigate, parseRoute, type Route } from './route';

const at = (screen: Route['screen'], extra: Partial<Route> = {}): Route => ({ screen, params: {}, ...extra });

/** `history.back()` is asynchronous: wait for the popstate it causes. */
const back = () =>
  new Promise<void>((resolve) => {
    window.addEventListener('popstate', () => resolve(), { once: true });
    window.history.back();
  });

const current = () => parseRoute(window.location.hash);

describe('route parsing', () => {
  it('round-trips every screen, ids and sorted params', () => {
    const routes: Route[] = [
      HOME,
      at('ratings'),
      at('movie', { id: 'tt0114369' }),
      at('science'),
      at('settings'),
      at('about'),
      at('recommend', { params: { mood: 'quiet sci-fi', inc: 'Drama,Comedy', k: '20' } }),
    ];
    for (const r of routes) expect(parseRoute(formatRoute(r))).toEqual(r);
    expect(formatRoute(at('recommend', { params: { k: '5', inc: 'Drama' } }))).toBe('#/?inc=Drama&k=5');
  });

  it('treats an empty hash as home and an unknown one as no route', () => {
    expect(parseRoute('')).toEqual(HOME);
    expect(parseRoute('#/nowhere')).toBeNull();
    expect(parseRoute('#/movie')).toBeNull();
    expect(parseRoute('#/ratings/extra')).toBeNull();
  });
});

describe('history policy', () => {
  beforeEach(() => {
    // An entry "before the app" (as if the user came from another site), then the app at home.
    window.history.replaceState(null, '', '/before-app');
    window.history.pushState(null, '', '/#/');
  });

  it('Back returns to the previous screen, not out of the app', async () => {
    navigate(at('ratings'));
    navigate(at('science'));
    await back();
    expect(current()?.screen).toBe('ratings');
    await back();
    expect(current()?.screen).toBe('recommend');
    expect(window.location.pathname).toBe('/');
  });

  it('filters replace the entry: Back skips them and lands on the screen before', async () => {
    navigate(at('ratings'));
    navigate(HOME);
    navigate(at('recommend', { params: { inc: 'Drama' } }), { replace: true });
    navigate(at('recommend', { params: { inc: 'Drama', k: '20' } }), { replace: true });
    expect(current()?.params).toEqual({ inc: 'Drama', k: '20' });
    await back();
    expect(current()?.screen).toBe('ratings');
  });

  it('navigating to the current route records nothing', async () => {
    navigate(at('ratings'));
    navigate(at('ratings'));
    await back();
    expect(current()?.screen).toBe('recommend');
  });

  it('closing the movie overlay goes back to the page it was opened over', async () => {
    navigate(at('ratings'));
    navigate(at('movie', { id: 'tt0114369' }));
    leaveTo(at('ratings'));
    await new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }));
    expect(current()?.screen).toBe('ratings');
    // The overlay entry was popped, not duplicated: one more Back is home.
    await back();
    expect(current()?.screen).toBe('recommend');
  });

  it('closing an overlay reached by a pasted link replaces instead of leaving the app', () => {
    window.history.replaceState(null, '', '/#/movie/tt0114369');
    leaveTo(HOME);
    expect(current()).toEqual(HOME);
    expect(window.location.pathname).toBe('/');
  });
});
