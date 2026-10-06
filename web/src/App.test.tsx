/**
 * The app over test services: it loads, recommends, rates from a card, and Back returns to the
 * screen before (not out of the app) when navigating through the real header links.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { ServicesProvider } from './state/hooks';
import { makeTestServices } from './test-helpers/services';

async function renderApp() {
  const services = await makeTestServices();
  render(
    <ServicesProvider services={services}>
      <App />
    </ServicesProvider>,
  );
  return services;
}

const nav = () => within(screen.getByRole('navigation', { name: 'Main' }));
const back = () =>
  act(
    () =>
      new Promise<void>((resolve) => {
        window.addEventListener('popstate', () => resolve(), { once: true });
        window.history.back();
      }),
  );

describe('App', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/before-app');
    window.history.pushState(null, '', '/#/');
  });
  afterEach(cleanup);

  it('loads the artifact set and shows recommendations', async () => {
    await renderApp();
    const list = await screen.findByRole('list', { name: 'Recommended titles' });
    expect(list.children).toHaveLength(10);
    expect(document.title).toContain('Recommend');
  });

  it('Back from Ratings to Science lands on Ratings, then on Recommend', async () => {
    await renderApp();
    await screen.findByRole('list', { name: 'Recommended titles' });
    fireEvent.click(nav().getByRole('link', { name: 'Ratings' }));
    expect(await screen.findByRole('heading', { name: 'Import ratings' })).toBeInTheDocument();
    fireEvent.click(nav().getByRole('link', { name: 'Science' }));
    expect(await screen.findByRole('heading', { name: 'For scientists' })).toBeInTheDocument();
    await back();
    expect(await screen.findByRole('heading', { name: 'Import ratings' })).toBeInTheDocument();
    await back();
    expect(await screen.findByRole('list', { name: 'Recommended titles' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('rating a card with the keyboard removes it from the results', async () => {
    const services = await renderApp();
    const list = await screen.findByRole('list', { name: 'Recommended titles' });
    const first = services.deps.store.getState().recs.items[0]!;
    const slider = within(list).getByRole('slider', { name: `Your score for ${first.title}` });
    // Each arrow key press is a commit (one rateTitle command).
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    await waitFor(() => expect(services.deps.store.getState().ratings[first.item_id]).toBeDefined());
    await waitFor(() => expect(services.deps.store.getState().recs.items.map((r) => r.item_id)).not.toContain(first.item_id));
  });
});
