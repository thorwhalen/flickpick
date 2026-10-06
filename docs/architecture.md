# Movie recommender — proposed architecture (v1)

*2026-09-30 · written by the project lead session after the research round · inputs: the seven reports in the sibling folders, the `architecture-first` and `frontend` skills · status: PROPOSAL, awaiting the user's name choice and licensing posture*

## Summary

Build a **browser-first app over a TypeScript core**, with **Python as the offline build pipeline** (catalogue, EASE matrix, embeddings) and, later, a thin `qh` service for the three things a static site cannot do (remote MCP for claude.ai connectors, optional sync, keyed proxies). The research settles the split: compute is not the constraint (the whole recommender is 15 to 25 MB of client-side artifacts); data licensing is. So the shipped artifacts are built from open sources (Wikidata CC0, Wikipedia CC BY-SA, MovieLens ml-32m non-commercial), and TMDB, JustWatch-via-TMDB, OMDb and MDBList are live, display-only enrichments fetched with the user's own keys. The LLM parses requests and explains results; a deterministic ranker over catalogue IDs does the ranking.

The name must be free on PyPI and npm because the project ships two packages: the TS core (npm) and the Python build pipeline plus MCP/qh adapters (PyPI). Both under the same name.

## Repository shape

One repo, `$PP/tt/<name>/` (frontend-ish, so `tt/`), holding three deliverables that share one vocabulary and one artifact format:

| Part | Language | Ships to | Purpose |
|---|---|---|---|
| `src/` core library | TypeScript | npm `<name>` | Loads artifacts, scores a user (EASE product, iALS fold-in), semantic search (brute-force cosine over int8 vectors), structured filters, fusion/rerank, personal evaluation, agreement statistics. Runs in browser and Node. No UI, no fetch policy: everything comes in as arguments. |
| `web/` app | Vite + React + TS | static hosting (GitHub Pages or Cloudflare Pages) | The product: rating UI, recommendations, movie pages with live enrichment, the "for scientists" page, the about page (with the user's 2004-to-now recommender story), settings (BYO keys). zodal schema-driven UI, zustand/immer, acture commands. |
| `<name>/` Python package | Python | PyPI `<name>` | Offline build pipeline (`build` CLI via `cw`): Wikidata + Wikipedia + MovieLens ml-32m → catalogue Parquet, EASE top-k matrix, item vectors via `ef`, ID crosswalk. Later: `py2mcp` local MCP and a `qh` service (remote MCP, proxies). |
| data package | none | Hugging Face Hub dataset `<name>-data` | The built artifacts, versioned, under their own licence (MovieLens share-alike, non-commercial; Wikipedia CC BY-SA attribution). Never inside the code repo. |

The first two are the v1. The Python pipeline is v1 too, because nothing runs without artifacts, but only its `build` command. MCP and qh are v1.5.

## Concerns extracted (each its own module; each could be reused by another app)

1. **Ratings importers** (`importers/`): Letterboxd, IMDb, MovieLens and Netflix exports → one canonical `Rating` schema (Zod). Pure functions over text; no host knowledge.
2. **Data-source clients** (`sources/`): TMDB, MDBList, Movie of the Night, Wikidata. Each client owns its terms: cache TTL (TMDB ≤ 6 months), attribution strings, "display-only" flag, key requirement. The licensing rule lives in code next to the fetch, not in a README.
3. **Personal evaluation and agreement statistics** (`science/`): temporal split, full-catalogue ranking metrics with confidence intervals, rank correlations with population ratings, fitted models with cross-validation. Pure numeric code over arrays.
4. **BYO keys, settings, assistant**: not built here. `zodal-dials` for the settings schema (one section per provider), `acture` for commands, `acture-ai` for the assistant. The app mounts their sections.

## Seam table (v1)

| # | Seam | v1 default (no new dependency) | Replacement I can point at |
|---|---|---|---|
| 1 | where artifacts are loaded from (`artifactSource`) | `fetch()` from a static base URL (HF Hub dataset or the site's own `data/`) | local files in Node, or a `qh` endpoint (`tt/app_ef` is the template; browser-first report §2) |
| 2 | how candidates are scored (`scorer`) | EASE: ratings row × sparse top-k item-item matrix | iALS item factors with closed-form fold-in; item-kNN for explanations (recsys report §3; same pipeline emits all three) |
| 3 | where the user's data lives (`store`) | `@zodal/store-localstorage` (IndexedDB-backed provider) | `@zodal/store-http` against the qh service (both in the manifest) |
| 4 | live enrichment provider (`enrichment`) | TMDB with the user's key: `/watch/providers`, votes, poster paths | Movie of the Night for availability, MDBList for RT/Metacritic/Letterboxd scores (streaming report §1-2) |
| 5 | how a free-text request becomes a structured query (`queryParser`) | the structured form itself: mood text is embedded client-side, everything else is fields | an LLM parser with the user's key via `acture-ai` (the brief asks for it; acture exists) |

```
Surface for v1: web app + Node CLI over the TS core; Python `build` CLI.
                (MCP, remote MCP, shipped skills, qh: questions answered below, not built)
NOT seams:      embedding model (bge-small-en-v1.5 int8 or snowflake-arctic-embed-xs, fixed per artifact version),
                fusion formula (weights are config, the formula is code), chart library, URL state shape,
                artifact file format (Parquet + typed-array binaries, versioned).
```

**Surface questions, answered for v1 (one line each).** CLI: the core takes arrays and returns arrays of IDs with scores and reasons, so a Node CLI is a thin wrapper. MCP: every command is an acture command with a Zod schema; `recommend`, `searchCatalog`, `getTitle`, `rateTitle`, `whereToWatch`, `explain` are the tool list, and `getTitle` output for agents is built from open data only. HTTP: the core has no request state; the qh service would wrap the Python pipeline's outputs and the same tool list. Skills: each verb has a docstring and a trigger sentence. Frontend: it is the product, so the order inverts (web first), but the Node CLI is written first anyway as the proof that the core is not fused to the UI.

## The one-command test (v1 definition)

```
python -m <name> build --sample                       # small artifact set from a MovieLens subset + Wikidata sample
npx <name> recommend --ratings my_letterboxd.csv --mood "slow-burn melancholic sci-fi" --exclude-genre horror --k 10
```

Passes when it prints ten catalogue titles with scores and one-line reasons, none of them already rated, in under a second on the sample artifacts. This is `test_smoke` for both packages and must still pass after every seam swap.

The web app's equivalent: open the site, import the same CSV, type the same mood, see the same ten films with posters.

## How the pieces answer the brief

- **Browser vs Python**: browser for everything the user touches; Python only offline (build) and for the remote MCP/proxy service later. Detail: browser-first report §1-2.
- **Streaming availability**: TMDB `/watch/providers` (JustWatch-sourced, 180+ countries, attribution to both) as default; Movie of the Night as the second provider. Display-only, cached ≤ 6 months, user's key. Detail: streaming report §1.
- **Ratings**: IMDb `title.ratings` (built into the catalogue at build time for the user's local use, personal/non-commercial), TMDB votes live, MDBList for RT/Metacritic/Letterboxd live, Wikidata snapshots as a dated seed. Detail: streaming report §2.
- **Scientists page**: MovieLens as the reproducible population baseline; live scores as dated features; methods in recsys report §4-5 (full-catalogue ranking, temporal split, confidence intervals, rank correlations, cross-validated fits). Charts follow the `dataviz` skill.
- **Semantic descriptions**: Wikipedia plot sections + an LLM-generated structured vibe profile per film (cheap model, fixed vocabulary, $3 to $127 for 30k films as an estimate), embedded with a 384-d model, shipped int8. Negation and constraints go through structured fields, not the embedding. Detail: semantic-data report §1, §3-4.
- **Filterable features**: Wikidata facts (genre, runtime, language, country, year, director, awards), TMDB certifications live, LLM-inferred content flags labelled as inferred. Detail: semantic-data report §5.
- **Posters**: TMDB image CDN, hotlinked, keyless at the image layer, attributed, never stored in the repo or the data package; generated placeholder when missing. Detail: posters report.
- **What the brief did not ask**: the TMDB AI clause; MovieLens share-alike on the shipped matrix; Letterboxd's API refusing recommender projects (their export file is the only path); Trakt's paywall; ANN indexes are unnecessary at 30k items; LLM rankers are worse than CF when ratings exist; a personal benchmark with 50 test events cannot separate methods that differ by less than about ten points of hit rate.

## Decisions taken by the lead (from the synthesis' conflict list)

- **Canonical key**: the Wikidata QID, with IMDb `tconst` and the TMDB id as required cross-IDs on every catalogue row. Under posture A the shipped data are Wikidata-derived, so the QID is the only key that is ours to publish; the other two are what the live enrichment sources need.
- **Two nested catalogue sets**: the collaborative-filtering artifact covers the 10k to 20k films that carry MovieLens signal (the 10k most-rated films carry about 97% of ratings); the content artifacts (facts, plot embeddings, vibe profiles) cover about 30k films. A film outside the CF set still gets semantic and content scores.
- **The user's example ratings file** (the addendum's CSV of 100+ personal ratings with MovieLens-style columns) goes into the repo as an example fixture for the importers and the smoke test, as the user asked. Real user ratings live behind seam 3 (a `MutableMapping` in Python, a zodal store provider in the browser, local storage by default). The synthesis notes that the `average_rating` column looks MovieLens-derived and that publishing a personal rating history has some re-identification exposure; both are the user's call and the file is theirs.
- **Charts**: chosen at build time following the `dataviz` skill; not a seam.

## Decisions the user has to make before the repo is created

1. **The name.** Shortlist from the brand report, all free on PyPI and npm today: cinepick, reelpick, flickpick, cinescout, cinesift (runners-up: watchnext, moodreel).
2. **Licensing posture.** (A) Open core as above, TMDB display-only via the user's key, no email needed; or (B) ask TMDB in writing for clearance to use TMDB content in the AI-assisted app, which would let the catalogue use TMDB overviews and keywords. The reports recommend A, with B pursued in parallel if the user wants TMDB text. Under A the deployed public instance must stay non-commercial.
3. **The data package's home and licence.** Hugging Face Hub dataset under the MovieLens conditions (non-commercial, share-alike on transformations) plus CC BY-SA attribution for Wikipedia text. Confirm this is acceptable for a public project.

## What v1 leaves out, by name

MCP (local and remote), the in-app assistant, shipped agent skills, sync, group/household recommendations, the LLM query parser. Each is an addition at seam 5, at the acture command layer, or at seam 1/3, and none needs the core to change.
