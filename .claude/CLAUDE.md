# flickpick — map for the agent building this project

Seams (v1 defaults → replacement): artifactSource (static URL/dir → qh endpoint) · scorer (EASE → iALS fold-in, item-kNN) · store (zodal localStorage provider → zodal-store-http) · enrichment (TMDB with the user's key → Movie of the Night, MDBList) · queryParser (structured form + embedded mood → LLM via acture-ai). Surfaces built: Python CLI (`python -m flickpick`), Node CLI (`js/`), web app (`web/`). Not built: MCP, remote MCP, shipped skills, qh service. Details: `docs/architecture.md`.

## Layout

- `flickpick/` — Python package (PyPI): offline build pipeline, EASE training, scorer, importers, science, `tools.py` (SSOT function list) + `__main__.py` (`cw.dispatch`).
- `js/` — TypeScript core (npm `flickpick`): loads artifacts, scores, searches, imports ratings, evaluates. Browser and Node. No UI.
- `web/` — Vite + React + TS app over `js/`. Static hosting.
- `tests/` — Python tests; `tests/fixtures/artifacts_small/` is the only artifact set in the repo (MovieLens ml-latest-small transformation, research/non-commercial).
- `docs/` — `architecture.md`, `artifact-format.md`, `core-contract.md`, `research/` (the 2026-09-30 round; index in `docs/research/README.md`).

## Rules that are specific to this project

- **Licensing is a design constraint.** Shipped artifacts come only from Wikidata, Wikipedia and MovieLens ml-32m. TMDB, JustWatch-via-TMDB, OMDb and MDBList are display-only, fetched live with the user's own key, cached at most 6 months, never fed to embeddings or an LLM. Why: TMDB's API terms prohibit ML/AI applications (verified 2026-09-30; `docs/research/README.md`).
- **Artifacts are data, not code.** Built artifact sets go to `~/.local/share/flickpick/artifacts/`, raw downloads to `~/.local/share/flickpick/raw/`. Nothing but the small fixture is committed.
- **The contract files are the SSOT across languages.** A change to `docs/artifact-format.md` is a new `format_version`; a change to `docs/core-contract.md` changes both `flickpick/score.py` and `js/src/scoring.ts`, and the parity test must still pass.
- **Ratings scale** is 0-100 everywhere inside; importers convert.
- Merging to `main` publishes to PyPI (wads CI). `[skip ci]` in the merge message suppresses the whole workflow.

## Where the user's story lives

The about page (`web/`) carries the author's note: into recommender systems around 2004 for musical taste and trends, then marketing until 2016, and twenty years later still unsatisfied with movie recommendations, so built the one they wanted now that agentic coding makes it fast.
