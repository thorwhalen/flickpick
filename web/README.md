# flickpick web

The flickpick web app: a personal movie recommender that runs entirely in your browser, over the TypeScript core in `../js`. Import your ratings, ask for a mood, see why each film was picked, and measure how well it does for you.

## Run it

```bash
cd web
npm install          # .npmrc sets legacy-peer-deps (npm 10 trips over the linked ../js peer set otherwise)
npm run dev          # builds ../js if needed, copies the fixture data into public/data/, then starts Vite
```

The core is consumed as `"flickpick": "file:../js"`, from its built `dist/`. `npm run dev`, `npm run build`, `npm test` and `npm run typecheck` first run `npm run build-core` (`scripts/build-core.mjs`), which installs the core's dependencies when `../js/node_modules` is missing and rebuilds `../js/dist` when it is missing or older than the core's sources; otherwise it does nothing.

Other scripts: `npm test` (vitest, about a second, no network), `npm run build` (type-check and build to `dist/`), `npx tsc -b --noEmit`, `npm run preview` (serve `dist/`).

## Where the data comes from

- **Artifacts** (catalogue, EASE matrix, embeddings) are loaded at runtime from the *artifact source URL* in Settings, through the core's `loadArtifacts`. The default, `./data/artifacts_small/`, is a copy of `../tests/fixtures/artifacts_small/` that `npm run prepare-data` (run by `npm run dev`) puts in `public/data/` (gitignored). It is a 600-film MovieLens ml-latest-small transformation: research and non-commercial use only. A real deployment points the setting (or the default in `src/defaults.ts`) at a hosted artifact set built with `python -m flickpick build`. If `public/data/` exists when you build, Vite copies it into `dist/`.
- **The example ratings** (`flickpick/data/examples/movie_ratings_various.csv`) are copied to `public/data/examples/` by the same script; the Ratings page offers them as "Try the example ratings".
- **Your ratings, settings and TMDB key** live in this browser's localStorage, behind one zodal `DataProvider` per collection (`src/state/providers.ts`).
- **The mood model** (`Xenova/bge-small-en-v1.5`, int8, about 35 MB) downloads from the Hugging Face hub on the first mood query, inside a Web Worker, with a progress bar. Without a mood, nothing is downloaded.
- **TMDB** (posters, overview, runtime, certification, watch providers for your region) is fetched only with your own key, shown for display only, cached 180 days, and never passed to the recommender (`src/sources/tmdb.ts`).

## How it is built

| Path | What |
|---|---|
| `src/commands/` | Every user action as an acture command with a Zod params schema (`CMD` ids: recommend, rate, remove, import, export, set setting, open movie, enrich, evaluate, load). The only code that writes state. |
| `src/state/` | zustand + immer store, the Zod schemas of what is stored, the zodal providers, React hooks. |
| `src/route.ts` | The URL and the history policy (screens and the movie overlay push; filters replace; Back never leaves the app). Hash routes, so any static host works. |
| `src/settings/schema.ts` | The settings schema; the Settings page is rendered from it. |
| `src/embed/` | The embedding worker and its client. |
| `src/pages/`, `src/components/`, `src/ui/`, `src/charts/` | Screens, shared components, shadcn-style primitives (including the ghost-thumb rating slider), hand-written SVG charts. |
| `src/defaults.ts` | Every app-level number, name and URL. |

Routes: `#/` recommend, `#/ratings`, `#/movie/<imdb_id>`, `#/science`, `#/settings`, `#/about`.

Tests cover the route policy (Back lands on the previous screen), the commands (rating updates the store and re-ranks the shown results), the importers wiring (the example CSV imports every row), the settings schema, and the app shell over test services.

## Not built yet

- The in-app assistant, a command palette, keyboard shortcuts and an MCP endpoint. The commands are ready for them (`registry.list()`, Zod params), but no surface consumes them yet.
- Undo for ratings, and a confirmation before deleting one.
- Bulk writes in the store: importing goes through one `upsert` per row, which is fine for hundreds of ratings and slow (seconds) for many thousands; it wants an `upsertMany` in the zodal localStorage provider.
- Code splitting: the main bundle is about 500 kB (160 kB gzipped). The ONNX runtime's WebAssembly (27 MB) is emitted into `dist/assets/` and fetched only on the first mood query.
- Browser (Playwright) tests: the ghost-thumb slider geometry and the model download were checked by hand in headless Chromium, not in CI.
- A hosted artifact set and a deploy target.
