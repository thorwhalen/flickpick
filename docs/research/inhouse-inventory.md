# In-house inventory for the movie-recommender project (step 1: what already exists)

Date: 2026-09-30. Scope: `ir` (reports, skills, packages, session_turns), `projreg`, grep over `$PP` docs, sessions, and package READMEs. No web search, no repo modified.

## Bottom line

- No in-house report, skill, package or past session covers movie recommendation, TMDB/IMDb/Rotten Tomatoes data, streaming availability, movie posters or collaborative filtering. The only movie-recommender material on disk is the user's own preliminary report in `_tmp` (see (a)).
- What exists is the plumbing: embedding pipelines (`ef`, `imbed`, `aix`, `oa`), a vector-DB facade (`vd`), a Python-to-HTTP layer (`qh`), an MCP layer (`py2mcp`), a semantic-search web app template (`app_ef`), and the schema-driven frontend stack (`zodal`, `acture`).
- The strongest reusable research is the browser-side semantic-search report (Transformers.js + ONNX Runtime Web + WebGPU/WASM, Orama, Voy, hnswlib-wasm), written for exactly the "browser-first" question.
- Retrieval caveat: `ir` printed "vd.BM25Index unavailable; lexical ranking skipped", so all `ir` results were dense-only (MiniLM embeddings). Low scores (below about 0.45) on movie queries are therefore real absences, not lexical misses; a targeted `rg` sweep (below) confirmed it.
- Freshness: `ir info reports` shows 70,842 records, last maintained 2026-09-30 20:25; the launchd schedule runs hourly and its last run was 20:25. No `ir maintain` was needed.

## (a) Existing research reports

Dates are file modification times. Paths are relative to `$PP` (`$PP`).

### The one direct hit

- `_tmp/movie_recommender_systems_report.md` (2026-09-30, about 22 KB): the user's own preliminary report. Covers LensKit, Surprise and RecBole benchmarks; why RMSE is not enough (NDCG@K, recall, diversity, novelty, coverage); whether a custom recommender can beat consumer sites; MovieLens as data; browser vs server model size; whether an LLM is needed; Criticker, MovieLens and Taste.io as consumer services; a "particularly promising custom system" (section 14). It lives in `_tmp`, so it is not indexed by `ir` (the `ir` reports corpus only walks `*/*/docs` and `*/*/misc/docs`). This is the baseline the new research must extend, not repeat.
- `_agent_work/movie-rec/request.md` (2026-09-30): the verbatim request. Not research.

### Directly reusable for semantic search and browser-side ML

- `g/g_embeddings/docs/research/semantic_search/08 -- Client-Side AI Vector Search.md` (2026-05-20, about 88 KB; identical copy at `t/ef/misc/docs/11 -- Client-Side AI Vector Search.md`). Best in-house answer to "browser-first": Transformers.js v3+ on ONNX Runtime Web (WASM vs WebGPU execution providers, fp32/fp16/q8/q4 dtypes), worker isolation and model caching, browser-native vector indexes (Orama, Voy, hnswlib-wasm evaluated), memory and quantization for up to 100K vectors, orchestration frameworks (Vercel AI SDK, Genkit, Mastra), and an end-to-end non-blocking reference pipeline. A movie catalog of tens of thousands of titles fits this envelope.
- `g/g_embeddings/docs/research/semantic_search/09 -- Embedding Model Architecture Research Paper.md` (2026-05-20): embedding-model feature matrix (beyond MTEB scores) for a multi-runtime toolkit spanning cloud APIs, self-hosted and browser. Use it to choose one embedding model that works both in Python and in the browser (query/document embedding must match).
- `g/g_embeddings/docs/research/semantic_search/03 -- Vector Storage and Retrieval -- A Deep Research Report for Facade Design.md` (2026-05-20, author Thor Whalen): vector stores, ANN indexes, metadata filtering; the design basis of `vd`.
- `g/g_embeddings/docs/research/semantic_search/11 -- VectorDB Selection & Setup Guide -- Provider Profiles, Decision Framework, and Installation Playbooks.md` (2026-05-21; copy at `i/vd/misc/docs/`): backend choice framework.
- `g/g_embeddings/docs/research/semantic_search/04 -- RAG & Semantic-Search Frameworks as Facade Case Studies.md` (2026-05-20) and `00 -- semantic_indexing_ledger.md`: RAG and semantic-search framework survey.
- `t/equate/docs/research/17-vector-databases-and-scale-out.md` (2026-07-28): ANN and vector-DB infrastructure for blocking/matching at scale; secondary.
- `t/ef/misc/docs/ef_design_notes.md`, `ef_use_cases.md`; `i/vd/misc/docs/vd_design_notes.md`, `vd_specification.md`, `vd_use_cases.md`, `vd_key_takeaways.md`: design notes for the two facades.
- `t/illustration/misc/docs/research/illustration_01 -- Cross-Modal Text-to-Image Retrieval Over an Existing Image Corpus -- A Technical Architecture for reelee.md` (2026-06-17): text-to-image retrieval (CLIP-style) over an existing image corpus. Relevant only if posters or stills are ever searched by text ("a poster that looks like X"); it does not cover where to source posters.

### Adjacent (personalization and preference modelling)

- `tt/tetrachord/docs/research/03-learning-science-and-adaptive-engines.md` (2026-07-30): "what does the learner know / what to show next" (knowledge tracing, Elo/Rasch-family online models). Transferable ideas for a single-user, tiny-data preference model.
- `misc/kangourou/misc/docs/2026-09-learner-model-decision.md` (2026-09-20): decision for an online Rasch/Elo model with Gaussian posterior and self-updating priors for 1 to 3 users with about 100 responses each. Closest in-house analogue to "one person, few ratings, need sensible priors" (cold start).
- `tt/comparanda/docs/research/visualisation.md` and `findings-visualisation.md` (2026-08-18): views for structured comparison (reorderable matrix, seriation `sections/c5-seriation.md`). Possible inspiration for the "for scientists" comparison views (user vs IMDb vs RT); not about ratings data.
- `tt/rubricator/docs/research/scoring-order-effects.md` and `sections/r2-rubrics-and-calibration.md`: rating calibration and order effects when scoring; loosely relevant to rating scales and calibration between raters.
- `tt/zod-collections-ui/docs/collection_affordances_taxonomy.md` (2026-02-26): exhaustive taxonomy of collection affordances (filter, sort, select, bulk actions); useful checklist for the browse/filter UI.

### Retrieved but NOT relevant (false positives; do not chase)

- `t/muvid/misc/docs/footage_scoring_research.md`, `tt/reelee*/docs/*`, `t/braidio/misc/docs/style/voices/*` (mentions Rotten Tomatoes only as podcast-host chatter), `t/falaw/misc/docs/fal_ai_docs_full.md`: film-making, video and podcast material, not movie recommendation.
- `tt/ai_contexts/**`, `c/cosmo_compass/**`, `c/cosmograph/**`: the terms "recommend" and "imdb" hit only as substrings in unrelated text (for example "recommended" in PR bodies).

## (b) Relevant skills

`ir discover skills` found nothing recommender- or movie-specific (`opsward-add-recommendation` is about operations "recommendations", not recsys).

- `~/.claude/skills/faceted-filter-ux/SKILL.md` (updated 2026-09-19): AND-across/OR-within facets, counts semantics, URL state, applied-filter summaries, empty states. Directly applicable to filtering by genre, age rating, streaming service, year, score.
- `~/.claude/skills/frontend/SKILL.md` (2026-09-30) plus `tw-frontend-ux`: the stack rules (Zod schema as SSOT, zodal-generated UI, zustand/immer, acture commands). Mandatory reading before any UI work.
- `~/.claude/skills/zodal-ecosystem/SKILL.md`, and the zodal skills in `i/_zodals/zodal/.claude/skills/` (`zodal-collections`, `zodal-collection-ui`, `zodal-ui-renderer`, `zodal-store-adapter`, `zodal-dev`, `zodal-testing`): collections, filters, stores, renderers.
- `dataviz` skill (available in the session skill list): chart, palette and dashboard method for the "for scientists" page.
- `ef-architecture` (`t/ef/.claude/skills/`): how `ef` composes segment, embed, index and search.
- `vd-quickstart`, `vd-search`, `vd-ingest`, `vd-ops`, `vd-backend-choose`, `vd-add-backend` (`i/vd/.claude/skills/`): vector-DB facade operations, backend selection, metadata filtering.
- `do-research`, `architecture-first`, `python-dispatching` (CLI/HTTP/UI mechanics, MCP via `py2mcp`), `python-project-structure`, `local-package-ecosystem` (letter dirs; frontend-ish goes to `tt/`), `tw-deploy` (thorwhalen.com deploy), `ai-assistant-architect` / `ai-assistant-agent-runtime` / `ai-assistant-chat-ui` / `ai-assistant-command-mcp` / `ai-assistant-prompts-skills` (the in-app AI assistant and agent-connector part of the brief).
- Missing: no skill for browser ML (Transformers.js, ONNX, WebGPU) despite the `08 -- Client-Side AI Vector Search.md` report; no recsys skill.

## (c) Relevant in-house packages

Paths relative to `$PP`. "Dependency?" is a plausibility call for a browser-first movie recommender with a Python+qh fallback.

### Embeddings and vector search (Python side)

- `t/ef` (github thorwhalen/ef): "Embedding Flow", a facade for corpus, segment, embed, vector index, semantic search and RAG readiness. Has `EfService` (`t/ef/ef/service.py`), a handle-registry bridge explicitly built to be served through `qh.mk_app()`. Embedders addressed as `provider:model@dim` (for example `openai:text-embedding-3-large@1024`), extras `ef[sentence-transformers]` and `ef[openai]`. Dependency? Yes for the Python/offline path (embedding the movie catalog, building indexes); it is the natural pipeline for the ingest step. Not usable in the browser.
- `i/vd` (i2mint/vd): one interface over about 15 vector DBs (memory, chroma, faiss, duckdb, sqlite_vec, lancedb, qdrant, pgvector and more), MongoDB-style metadata filtering, multi-query search, reciprocal rank fusion, `check_requirements` and `setup_guide`. Dependency? Yes for the server path (filtered semantic search with `where` on genre/year/rating). Its `memory`/`sqlite_vec`/`duckdb` backends are the low-dependency choices. Note: its BM25 index is what `ir` reports as unavailable; check before promising hybrid search.
- `t/imbed`: embedding tools, batch embeddings via OpenAI, planar (2-D) projection of embeddings, cosine similarity helpers, vector-DB helpers. Dependency? Maybe: useful for the 2-D "movie map" visualization and for batch OpenAI embeddings; older code, prefer `ef`/`aix` as primary.
- `t/aix` (AIX): facade for common AI operations (chat, `embeddings`, `embed`, `cosine_similarity`, `find...`). Dependency? Yes if a provider-agnostic embedding call is needed; `ir` is built lazily on it.
- `t/oa`: Python interface to OpenAI (chat, prompt functions, batch embeddings in `oa/batch_embeddings.py`, batch API, vector stores). Dependency? Yes, narrowly, for OpenAI batch embedding of the catalog and for LLM explanations; otherwise reach it through `aix`.
- `i/ir` (i2mint/ir): information-retrieval substrate for agents: one "find the relevant things in this corpus" contract from ephemeral lists to maintained indexes, with abstention (`discover`) and hybrid/dense/lexical modes. Dependency? Probably yes as the agent-facing retrieval contract ("discover" with abstention suits an agent choosing movies), and as the eval harness (`ir eval`). Verify the lexical mode first (BM25 unavailable in this environment).
- `t/raglab` (agentic-search/RAG orchestration layer on `ir`: Planner, Formulator, Retriever, Evaluator, Reranker roles). Dependency? Maybe: fits an "agent chooses movies" loop; likely heavier than v1 needs.
- `i/chromadol` (dol store over ChromaDB): Dependency? No, `vd` already covers Chroma.
- `t/equate` (matching, similarity, entity resolution, ANN candidate generation): Dependency? Maybe, for reconciling titles across TMDB/IMDb/streaming feeds and the user's ratings export (fuzzy title+year matching), which is a real data-integration problem.
- `t/mood`, `t/idiom`, `t/newsmood`, `t/guise`, `t/grub`: word-vector or sentiment or toy-search packages; Dependency? No.

### Web service, storage, agent surface

- `i/qh` (i2mint/qh, v0.0.17, editable): Quick HTTP, Python functions to FastAPI services by convention over configuration. Dependency? Yes for the Python fallback (the user explicitly asked for "python + qh"); `t/lookbook` and `tt/app_ef` are working examples of qh-based services.
- `t/py2mcp`: MCP server from Python functions (`mk_mcp_from_refs`). Dependency? Yes for the "tool for my agents" connector; `t/lookbook` shows qh (HTTP) plus `fastmcp` (MCP) on the same verbs.
- `i/uf` (UI Fast: functions to qh services to rjsf forms): Dependency? No for the product; possibly handy for quick internal admin forms.
- `i/dol` (data object layer, mapping-style stores): Dependency? Yes, as the storage seam for cached TMDB/OMDb responses, ratings imports and embeddings (per the python-storage rule). It is a Python-side choice; the browser side uses zodal stores instead.
- `pip` environment already has: `sentence-transformers` 5.5.1, `onnxruntime`, `onnx`, `faiss-cpu`, `chromadb`, `duckdb`, `polars`, `pandas`, `scikit-learn`, `scipy`, `fastapi`, `fastmcp`. Not installed: `lenskit`, `surprise`, `recbole`, `implicit`, `lightfm` (no recsys library anywhere in the environment).

### Frontend (browser-first)

- `i/_zodals/zodal` (packages `core`, `store`, `ui`; docs, apps): schema-driven UI from Zod v4 (collection tables, filters, forms, state, data provider). Dependency? Yes, the mandated frontend stack; it covers the movie collection/filter UI and the ratings table.
- `i/_zodals/zodal-store-localstorage` (client-side sort/filter/search/pagination over a localStorage JSON array): Dependency? Yes for the user's own ratings in v1 (data never leaves the browser). Limited to modest sizes; the catalog needs IndexedDB or a static file instead.
- `i/_zodals/zodal-store-http` (a browser talks to your own API through zodal): Dependency? Yes for the qh fallback path (same UI, swap the store adapter). This is the seam that makes "browser-first, server if needed" cheap.
- `i/_zodals/zodal-dials` (typed settings cascade, rendered panel): Dependency? Yes for the settings section (API keys, model choice, weights).
- `i/_zodals/zodal-graphs`, `zodal-groups`, `zodal-store-fs`, `zodal-store-s3`, `zodal-store-supabase`: Dependency? Not for v1 (graphs possibly later for a movie similarity graph; s3/supabase only if hosted storage is added).
- `tt/zod-collections-ui` (`zod-collection-ui`; earlier incubation of zodal's collection idea): Dependency? No, superseded by zodal; use its affordance taxonomy as a checklist only.
- `i/acture` (also at `tt/acture`; packages include `core`, `palette-react`, `hotkeys`, `mcp`, `ai-vercel`, `forms-autoform`, `state-zustand`, `undo`, `e2e-playwright`): command-dispatch architecture (one command becomes a palette entry, hotkey, AI tool call, MCP tool, test). Dependency? Yes for the in-app AI assistant and the agent connector: define movie actions (search, filter, rate, mark watched, explain) once and get the assistant tools and MCP for free.
- `tt/app_ef` (React + thin FastAPI over `ef`, uses `qh`): a working "semantic search UI over a corpus" app. Dependency? No (presentation over `ef`), but the best in-house template for the server-side variant and for an `app.toml`-style deployment; copy its structure rather than depend on it.
- `tt/comparanda` (schema and view for structured comparison: options x criteria): Dependency? Probably no; the "for scientists" comparison is user-rating vs population-rating, a different shape. Check its matrix view for reuse.
- `tt/tw_platform` (thorwhalen.com deploy target; see `tw-deploy`/`twp-*` skills): the deployment home if the app is hosted; a browser-first static build reduces its needs.
- No in-house faceted-filter widget package and no charting/dataviz package were found (only the `faceted-filter-ux` skill, the `dataviz` skill and zodal's filter config). The stats page will need a chart library choice (see (e)).

## (d) Past-session hits

- `ir discover session_turns` for "movie recommender", "recommendation system", "recommend movies to user based on ratings", "movie search semantic" returned only low-scoring, unrelated hits (scores 0.40 to 0.48): sessions in `proj` (Hamilton lyrics-podcast, 2026-08-24), `misc/kangourou` (2026-09-23), `misc/Hamilton` (2026-09-15), `c/cosmograph` (2026-07-23). Opening them showed the word "recommend" in generic system text ("recommended order", "Recommended SoundFonts"); none discusses movies or recommenders.
- A raw `rg -il "movielens|letterboxd|themoviedb|tmdb|movie recommend|film recommend"` over all session transcripts matched about 20 transcripts (dol, thoremin, equate, kodokan, yb, kangourou labels, proj-level `t` and `i` sessions), but these are substring or tool-output noise (long tool results, package lists), not discussions; I did not open them individually. If needed, one scout call can check `t`-level sessions `fdd1d5f1` and `ac5531ab` and `i`-level `61aabf79` (ids only; unverified).
- Conclusion: no prior session did movie-recommender work.

## (e) What is NOT covered in-house (gaps for the new research)

- Recommender algorithms and libraries: no in-house recsys package, report or skill beyond the user's `_tmp` preliminary report; LensKit/Surprise/RecBole/implicit/LightFM are not installed. Needs: which methods run in the browser (item-item and matrix factorization on a single user's ratings, content-based embeddings) versus server.
- Movie data sources: nothing on TMDB, OMDb, IMDb datasets/licensing, Letterboxd, MovieLens/other public rating datasets, Rotten Tomatoes, Metacritic, Trakt, Wikidata. No API keys, licence, rate-limit or ToS analysis.
- Streaming availability: nothing on JustWatch, TMDB watch-providers, Streaming Availability API, Watchmode, region handling.
- Posters and images: nothing on where to source posters legally (TMDB image CDN terms, Fanart.tv, OMDb poster API, attribution rules) or hotlinking versus caching.
- Semantic descriptions for movies: no plot/synopsis/keyword/tag corpus (for example TMDB overviews and keywords, Wikipedia plot sections, MovieLens tag genome, IMDb plot summaries), and no evaluation of which embedding model captures "feel".
- Browser-side specifics for this domain: the client-side report exists but nothing concrete on shipping a precomputed movie-embedding index as a static asset, size budgets, or how to fetch and cache the catalog in the browser.
- Rating-comparison statistics: no in-house material on comparing one person's ratings with population scores (rank correlations, rating-scale normalization, calibration, per-user train/test splits with few ratings, bootstrapped confidence intervals), nor on presenting them.
- Charting and the "for scientists" page: no chart library decision or reusable stats/visualization component.
- Ratings import: no importers for Letterboxd/IMDb/Netflix/Trakt exports.
- Naming: package/npm name availability was not checked here (separate step; `brand` package exists for this).
- Legal and product context: ToS constraints on redistributing IMDb/RT scores and caching them, and privacy handling of the user's ratings (data stays in the browser vs server) are unaddressed.
