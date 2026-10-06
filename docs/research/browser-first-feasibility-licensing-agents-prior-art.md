# Browser-first feasibility, data licensing, agent surfaces and prior art for an open-source movie recommender

Scope: the questions the original brief did not raise, answered for the architecture decision (browser-first versus a Python/qh split) and for the AI and agent surfaces. Extends, and does not repeat, the preliminary report [1] and the in-house client-side search research [2][3][4], as indexed by the in-house inventory [5]. Research date 2026-09-30.

## Summary and recommendation

- **Compute is not the constraint; data licensing is.** A 30k-title recommender fits in a browser: int8 item vectors of about 10 MB, a top-50 item-item neighbour table of about 1.5 to 4 MB, and a metadata catalogue of about 4 to 12 MB (measured on MovieLens and extrapolated, estimates). The largest download is the query encoder (23 MB for MiniLM int8), not the catalogue.
- **TMDB's API terms forbid using TMDB content "in connection with ... a machine learning (ML) or artificial intelligence (AI) based Application", forbid derivatives, and forbid caching beyond 6 months** [6]. TMDB overviews therefore cannot be embedded, fed to the assistant or shipped in a static catalogue without a commercial agreement. IMDb's datasets forbid republishing into any database [7], and MovieLens 25M and the Tag Genome forbid redistribution [8][9].
- **Build the shipped artifacts from open sources**: Wikidata (CC0) as the identifier backbone and filterable facts [10], Wikipedia text under CC BY-SA with attribution [11], and MovieLens ml-32m (redistributable "including transformations" under its research, non-commercial licence) for collaborative signals [12]. Keep TMDB, JustWatch-via-TMDB and OMDb as display-only, live-fetched enrichments behind a user's own key, never inputs to embeddings or the LLM.
- **Architecture**: static-first (Cloudflare Pages or GitHub Pages, artifacts on the Hugging Face Hub), with Python used as an offline build pipeline (`ef`, `vd`, `dol`) rather than as a runtime server. Add a thin `qh` service or Cloudflare Worker only for three things a static site cannot do: a remote MCP endpoint for claude.ai connectors, optional sync, and proxies for CORS-blocked or keyed sources. In-house seams [5]: `zodal` with `zodal-store-localstorage` (or an IndexedDB store) for the user's data and `zodal-store-http` to swap in the server later; `tt/app_ef` as the template for the optional `qh` service; `py2mcp` for MCP.
- **Agents**: the LLM parses the request and explains; a deterministic ranker over catalogue IDs does the ranking. The 2024 to 2026 literature supports this split: LLM rankers show position and popularity bias [13] and their measured quality swings by more than 50% with the candidate generator [14]. Define actions once as `acture` commands and project them to the in-app assistant, a local MCP (`py2mcp`) and a stateless remote MCP.

## 1. In-browser compute feasibility in 2026

The in-house report 08 [2] already covers Transformers.js v3 on ONNX Runtime Web, WebGPU versus WASM, worker isolation, Voy, hnswlib-wasm, EdgeVec and Orama, and quantization for 100k vectors; report 09 [3] covers browser-capable embedding models. What changed since May 2026, and what matters for a recommender, is below.

| Component | Status at 2026-09 | Relevance here | Verdict |
|---|---|---|---|
| Transformers.js v4 | Released 2026-02-09; new C++ WebGPU runtime built with the ONNX Runtime team; about 4x faster BERT-style embedding models; runs in Node, Bun and Deno; `ModelRegistry` cache APIs [15] | Query-time embedding of free text; same code in browser and Node for parity tests | depend |
| WebGPU | Baseline in all major engines since January 2026 (Chrome/Edge 113+, Safari 26, Firefox 141 on Windows, 145 on Apple silicon macOS); Firefox Android and Linux pending [16] | WASM fallback still needed for part of the audience | depend (with WASM fallback) |
| onnxruntime-web | The execution layer under Transformers.js [2][15] | Use directly only for a custom ranker exported from Python | wrap |
| TensorFlow.js | Last release 4.22.0; a Node 24 breakage fixed in source but unreleased as of the issue thread [17]; Google's new web runtime is LiteRT.js for `.tflite` models (July 2026, secondary reporting) [18] | No reason to start on it | avoid |
| duckdb-wasm | About 2.8 MB gzipped plus extensions (secondary source) [19]; reads remote Parquet by HTTP range requests; Hugging Face fixed CORS on range reads from its Xet CDN in February 2026 [20] | SQL over the catalogue and the "for scientists" statistics | wrap (lazy-load on the stats page only) |
| sqlite-wasm + sqlite-vec | sqlite-vec 0.1.10 alphas in 2026 [21]; brute-force vector search [22]; persistence via OPFS VFS (needs COOP/COEP headers) or `opfs-sahpool` (no headers, single connection) [23] | Good for the user's mutable ratings store; vector part adds little over a typed-array scan | study |
| PGlite + pgvector | PGlite 0.7 (2026-07), about 3 MB gzipped, pgvector extension 42.9 KB [24][25] | Heaviest option; only if the server side is Postgres and code should be shared | avoid for v1 |
| Voy / hnswlib-wasm / EdgeVec / Orama | Compared in report 08 (latency, mutation, filtering, size) [2] | ANN is unnecessary below about 100k items: a flat scan of 30k x 384 int8 is about 11.5 M multiply-adds per query, estimated at tens of milliseconds or less in a worker | study; flat scan in v1 |
| USearch (JS) | Documented as "optimized for Node.js and WASM"; the browser build path is not clearly documented [26] | Unverified in browser | avoid until verified |
| Storage quotas | Chrome: up to 60% of disk per origin; Firefox best-effort min(10% of disk, 10 GiB); Safari about 60% for browser apps; whole-origin LRU eviction for non-persistent origins [27] | Artifacts of tens of MB are far below quota | depend |
| Safari 7-day cap | Script-writable storage (IndexedDB, localStorage, Cache, service worker) is deleted after 7 days without interaction; home-screen web apps are exempt [28][27] | Ratings kept only in the browser can vanish on iOS | design for export, PWA install and optional sync |
| Cross-origin isolation | GitHub Pages cannot set COOP/COEP headers (service-worker workaround) [29]; Cloudflare Pages supports a `_headers` file [30] | Needed only for SharedArrayBuffer (multi-threaded WASM, OPFS VFS) | prefer Cloudflare Pages if threads are needed |

**Measured sizes.** On MovieLens ml-latest-small (9,742 titles) [31] embedded with all-MiniLM-L6-v2 (384 dimensions), one vector costs 768 bytes in float16 (672 after brotli), 384 bytes in int8 (323 after brotli) and 48 bytes as a sign bit-vector; float vectors barely compress. Int8 kept 99.0% of the float32 top-10 neighbours; binary kept 58.9% alone and 97.7% with float rescoring of the top 100. A top-50 item-item table stored as uint16 index plus float16 score costs 200 bytes per item raw. Parquet (zstd) with IDs, title, year, genre list and tags cost 25 bytes per row. Script and numbers are from this session; the item-item compression ratio comes from a sparse, 610-user matrix and is optimistic.

| Artifact (estimates) | Raw | Compressed | Cold load at 10 / 50 Mbit/s | Notes |
|---|---|---|---|---|
| 30k x 384 float16 | 23.0 MB | about 20 MB | about 16 s / 3 s | Only if int8 recall is insufficient |
| 30k x 384 int8 | 11.5 MB | about 9.7 MB | about 8 s / 1.6 s | Recommended; 99% neighbour recall measured |
| 30k x 384 binary + int8 rescoring | 1.4 MB first stage | 1.4 MB | about 1 s / 0.2 s | Progressive: search binary first, fetch int8 later |
| 20k item-item, top-50 neighbours | 4.0 MB | about 1.5 to 3 MB | about 1 to 2.5 s / under 0.5 s | A dense 20k x 20k float16 matrix would be 800 MB, so sparsify [32] |
| 20k x 64 matrix-factorization item factors | 2.6 MB | about 2.4 MB | about 2 s / 0.4 s | User vector folded in client-side (a 64 x 64 solve) |
| 30k-row Parquet catalogue | 0.75 MB minimal; about 3 to 6 MB with cast, crew, countries, certification and scores; plus about 6 MB with a paragraph of description | about the same (already compressed) | about 3 to 10 s / 0.5 to 2 s | Split descriptions into a lazily loaded file |
| Query encoder: MiniLM-L6 int8 / bge-small int8 / Qwen3-Embedding-0.6B int8 | 23 / 34 / 614 MB [33] | not compressible | about 18 s / 4 s for MiniLM | The biggest item; Qwen3-0.6B is not viable on mobile |

**Verdict.** Purely client-side: catalogue browsing and faceted filtering, "more like these" from item vectors (no encoder needed), item-item and matrix-factorization scoring for one user, diversity reranking, and the personal train/test harness and statistics. Client-side with a one-time 23 to 34 MB download: free-text semantic queries. Needs Python, but offline at build time rather than at runtime: training collaborative models on ml-32m's 32 M ratings [12], building the catalogue from dumps, and fetching CORS-blocked sources (this session observed no CORS headers on `datasets.imdbws.com` or `files.grouplens.org`, and permissive CORS on the TMDB, OMDb, Wikidata and Hugging Face endpoints). Needs a runtime server: a remote MCP endpoint, cross-device sync, and any shared secret.

## 2. Free hosting for static data and ML artifacts

| Host | Free-tier facts | Fit | Verdict |
|---|---|---|---|
| GitHub Pages | Site at most 1 GB, soft 100 GB/month bandwidth, soft 10 builds/hour; no SaaS or commercial transactions [34]; no custom headers [29] | App shell and small artifacts | use for the app shell |
| Cloudflare Pages | 20,000 files, 25 MiB per file, 500 builds/month [35]; `_headers` supported [30]; bandwidth limit not stated on the limits page | App shell when COOP/COEP is needed | use (alternative to GitHub Pages) |
| Cloudflare R2 | 10 GB-month storage, 1 M Class A and 10 M Class B operations per month, free egress [36]; the `r2.dev` URL is rate-limited and "intended for non-production traffic", so a custom domain is needed [37] | Large artifacts under a domain you control | use if Hugging Face is unsuitable |
| Hugging Face Hub (dataset/model repos) | Public storage "best-effort" free; files under 200 GB recommended [38]; resolver downloads limited to 3,000 per 5 min per IP anonymous, 5,000 per user signed-in (September 2025 table) [39]; range-read CORS fixed 2026-02 [20]; content removable "at our sole discretion" [40] | Versioned Parquet and vector files with a dataset card; the same CDN Transformers.js already uses for models | use for data artifacts |
| jsDelivr from npm | 150 MB package and 20 MB file limits by default [41]; policy forbids use as general file or media hosting but accepts apps with many assets [42] | Small versioned artifacts (under 20 MB each) | use for small artifacts only |
| Data as an npm package | Versioned by semver, mirrored by jsDelivr/unpkg; subject to the limits above | Lets TS consumers `import` the catalogue schema and a small sample | use for schema + sample, not for the full vectors |

Verdict: app shell on GitHub Pages or Cloudflare Pages; data artifacts (catalogue Parquet, int8 vectors, neighbour tables) in a public Hugging Face dataset repo with a dataset card that carries the per-source licences, pinned by revision hash in the app; an npm package for the Zod schema and a tiny sample. Artifacts under 20 MB each keep a jsDelivr fallback possible.

## 3. Data-licensing compliance matrix

Read from the official terms pages on 2026-09-30. This is an engineering reading, not legal advice. "Hosted" means a public app you run; "BYO" means open-source code that each user runs with their own keys or downloads.

| Source | Licence / terms (official) | (a) Hosted public app | (b) Open-source, user's own keys | Verdict |
|---|---|---|---|---|
| TMDB API | Non-commercial licence; attribution with TMDB logo and a fixed notice; no caching beyond 6 months; no derivatives; no use "in connection with, including for training, a machine learning (ML) or artificial intelligence (AI) based Application"; a website that recommends content, or use with an LLM chatbot, is listed as a commercial use; terms dated 2023-10-20 [6]. About 40 requests/second [43] | Display-only live fetches for posters and overviews, with attribution; no static catalogue, no embeddings, nothing passed to the assistant; a commercial agreement if it ever earns revenue | Same restrictions bind each user; the AI clause still applies to the user's own installation | use (display-only); do-not-use as model input |
| TMDB watch providers (JustWatch data) | Must attribute JustWatch; access revoked on non-compliance [44]; plus all TMDB terms | Live display per title and region with JustWatch attribution | Same | use (display-only) |
| JustWatch direct | Partner API only after a contract; attribution on every appearance [45] | Not available free | Not available free | do-not-use |
| MovieLens ml-32m / ml-latest | Research purposes; no commercial use without permission; "may redistribute the data set, including transformations, so long as it is distributed under these same license conditions"; cite Harper and Konstan [12][46] | Shipping derived item-item similarities or factors appears allowed if the app is non-commercial and the licence travels with the artifacts; whether a public recommender counts as "research purposes" is not settled, so ask GroupLens | Users can download and train locally | use (ml-32m), ask GroupLens before a public launch |
| MovieLens ml-25m, Tag Genome | "The user may not redistribute the data without separate permission" [8][9] | Do not ship derivatives | Local training only | do-not-use for shipped artifacts |
| IMDb non-commercial datasets | Personal and non-commercial use; "must not be altered/republished/resold/repurposed to create any kind of online/offline database"; attribution line required [47][7]; no scraping [48] | Do not republish ratings or metadata | A local importer the user runs on files they download (no CORS, so a file drop or a local Python helper) | do-not-use hosted; use locally (BYO) |
| OMDb API | Site content "licensed under CC BY-NC 4.0"; free key limited to 1,000 requests/day; poster API for patrons only [49]; site terms say personal use only and "You may not build a business utilizing the Contributions" [50] | Non-commercial with attribution; the provenance of the Rotten Tomatoes and Metacritic fields it returns cannot be verified from OMDb's pages | Per-user key, 1,000/day | use (BYO, display); flag provenance |
| Wikidata | Structured data CC0 [10]. Query run 2026-09-30 on direct `instance of film` items: 274,442 with IMDb IDs, 243,002 with TMDB IDs, 232,140 with Letterboxd IDs, 71,697 with Rotten Tomatoes IDs, 17,668 with Metacritic IDs, 25,349 with a Rotten Tomatoes review-score statement [51] | Ship freely; the identifier crosswalk and filterable facts (genre, country, language, runtime, cast, director, dates, some certifications) | Same | use (backbone) |
| Wikipedia text | CC BY-SA 4.0; attribution by link; adapted text must be CC BY-SA and marked as modified; images licensed per file [11] | Plot text and LLM-derived summaries shipped under CC BY-SA with links; whether embeddings are "adapted material" is unsettled | Same | use (with attribution; license the derived text dataset CC BY-SA) |
| Netflix Prize | Research only, no redistribution without permission, no commercial use [52]; users re-identified by linking to IMDb ratings in 2007; sequel cancelled in 2010 after a lawsuit and FTC concerns [53] | No | Local research only | do-not-use |
| Letterboxd | API by application only; reported (search snippet of the official page, direct fetch blocked) as not granted for recommendation, LLM or personal projects [54]; terms prohibit indexing a significant portion of content [55] | No API, no scraping | User's own CSV export only | use (user export import only) |

Consequence for the semantic layer: the "storyline, feel, mood" text that gets embedded must come from Wikipedia plots, Wikidata descriptions, MovieLens tags (ml-32m) or text the user writes, never from TMDB overviews. Posters are covered by the separate posters report; TMDB's terms also forbid using TMDB "as an image hosting service" [6].

## 4. API-key handling for a browser app

| Pattern | How | Risk / cost | Verdict |
|---|---|---|---|
| BYO keys in the browser | User pastes TMDB, OMDb or LLM keys in settings (`zodal-dials`); kept in IndexedDB; requests go direct (TMDB, OMDb, Anthropic allow CORS; Anthropic needs the `anthropic-dangerous-direct-browser-access` header [56]) | Any XSS can read the key; mitigate with a strict CSP and no third-party scripts; the user bears rate limits | use (default) |
| Shipped shared TMDB key in client code | TMDB staff said in 2018 that client-side keys are "fine" (older source) [57] | One key's quota and termination risk shared by every user; under the AI clause a hosted AI app with a shared key is the operator's breach [6] | avoid |
| Thin proxy (Cloudflare Worker) | Worker holds the key and caches under 6 months; free tier 100,000 requests/day and 10 ms CPU per request [58] | Operator becomes the TMDB licensee for all traffic | wrap (only for a non-AI display path) |
| Thin proxy (`qh` service) | Same, in Python, alongside the MCP endpoint | Server to operate | wrap (when a server exists anyway) |
| Comparable self-hosted apps | Movary asks for a `TMDB_API_KEY` [59]; Ryot requires a `MOVIES_AND_SHOWS_TMDB_ACCESS_TOKEN` [60] | Established norm: each installation brings its own key | study |

## 5. User data and privacy

- **Local-first by default**: ratings, watch history and preferences live in IndexedDB (via a `zodal` store) or OPFS, following the local-first ideals of ownership, offline use and longevity [61]. Call `navigator.storage.persist()` and prompt PWA installation, because of Safari's 7-day eviction of script-written storage for non-installed sites [28][27].
- **Import formats for cold start**: Letterboxd CSV (Title, Year, imdbID, tmdbID, Rating 0.5 to 5, Rating10, WatchedDate, Tags, Review; 1 MB per file) [62]; IMDb ratings CSV (Const, Your Rating, Date Rated, desktop site only) [63]; Netflix viewing history CSV (title and date only, no ratings) [64]; Trakt export. Resolve all to Wikidata QIDs through the crosswalk in section 3.
- **Export**: one versioned JSON document, plus a Letterboxd-compatible CSV so the user can leave.
- **Optional sync, in order of preference**: a file the user saves to their own cloud folder; Google Drive `appDataFolder`, a hidden per-app folder under the non-sensitive `drive.appdata` scope [65]; a GitHub Gist, noting that GitHub's OAuth token endpoint lacks CORS for SPAs and its SPA support preview is marked "Paused" [66], so it needs a proxy or a pasted token; a small `qh` server only if multi-device sync becomes a core feature.
- **GDPR-minded practice**: the household exemption covers a person processing their own data [67], but Recital 18 also states that the Regulation applies to "controllers or processors which provide the means for processing" for household activities, so any hosted sync makes the operator responsible. Keeping data on-device, collecting no analytics, and publishing a one-paragraph privacy note keeps a hobby app out of controller territory as long as there is no server-side user data.

## 6. Agent surfaces

| Surface | What it gives | 2026 state | Fit for browser-first | Verdict |
|---|---|---|---|---|
| In-app assistant (BYO LLM key) | Chat in the app calling the same commands the UI uses | Direct browser calls possible [56]; `acture` projects one command to palette, hotkey, AI tool and MCP [5] | Native | depend (`acture`) |
| Local MCP server (`py2mcp`/`qh`) | Claude Desktop/Code and other clients read the user's exported ratings and the catalogue files | Mature; local desktop extensions packaged as MCPB [68] | Good for power users | use |
| Remote MCP server for claude.ai connectors | Any plan can add a custom connector by URL (Free: one); authless, OAuth with Dynamic Client Registration, or Client ID Metadata Documents [68] | Spec 2026-07-28 removed sessions and the `initialize` handshake, which suits stateless serverless hosting; DCR is now deprecated in favour of CIMD [69][70] | Needs an HTTPS endpoint: a Worker or `qh`; catalogue-only tools can be authless, user-data tools need OAuth or pass ratings as arguments | use (catalogue tools, authless, v1.5) |
| MCP Apps (`ui://` resources) | Server ships an interactive HTML widget (poster grid) into Claude, ChatGPT and other hosts | Final as the first official MCP extension on 2026-01-26 [71] | Reuses the web components | study |
| WebMCP (`document.modelContext`) | The page registers tools and the browser brokers them to agents | Chrome origin trial 149 to 156; spec moved the getter from `navigator` to `document`; no mainstream agent consumes it yet (secondary source) [72] | Ideal in principle | study; revisit in 2027 |
| Chrome-extension bridges | Extensions relay WebMCP tools or tab control to desktop agents [73] | Community-built, many variants | Fragile | avoid |
| Shipped agent skills | A `SKILL.md` teaching agents the CLI/MCP verbs and the licensing rules | Open standard with name, description, optional scripts and references [74] | Independent of runtime | use |

**LLM as recommender, 2024 to 2026 evidence.** A 2025 survey of LLM agents for recommendation groups work into recommender-oriented, interaction-oriented and simulation-oriented methods [75]. Zero-shot LLM rankers suffer position bias and popularity bias that need bootstrapped reordering to mitigate [13]. LLMs beat fine-tuned conversational recommenders on a large Reddit movie dataset but lean on popularity [76]. A 160-person user study found strong explanations but weak personalization, diversity and trust, and that the number of movies a user has watched mattered more than prompting [77]. On catalogue grounding, four current LLMs hallucinated 0.6 to 2.7% of items on MovieLens-25M but 11.6 to 61% on less famous catalogues, and confidence-based abstention barely helped [78]. On ReDial, switching the candidate pool from semantic to collaborative-filtering candidates raised LLM-reranker NDCG@10 by over 50%, and results depended heavily on scoring protocol [14]. A deployed tool-orchestrating system with more than ten tools produced more relevant, novel and diverse recommendations than vanilla LLMs [79].

**Recommendation.** LLM as query parser, constraint extractor and explainer over a classical candidate generator and ranker; the LLM may rerank a short, grounded list but never generates titles. Every tool returns catalogue IDs with provenance. One schema, defined in Zod and exported as JSON Schema for MCP:

```ts
recommendTonight({
  mood?: string,                 // free text, embedded client-side
  likeTitles?: string[],         // resolved to catalogue IDs first
  exclude?: { genres?: string[], titles?: string[], maxViolence?: 0|1|2|3 },
  maxRuntimeMin?: number, languages?: string[], yearRange?: [number, number],
  services?: string[], region?: string,        // availability filter (display-only data)
  audience?: { minAge?: number, household?: string[] },  // group recommendation
  novelty?: number, diversity?: number, k?: number        // 0..1 dials, default 5 results
}) => { items: { id: string, score: number, reasons: string[], sources: string[] }[] }
```

Companion tools: `searchCatalog`, `getTitle`, `rateTitle`, `explainRecommendation`, `whereToWatch`. The TMDB clause in section 3 means `getTitle` output passed to an agent must be built from open data only.

## 7. Prior art and competitors

Stars and licences read from the GitHub API on 2026-09-30.

| Product | Type | Gets right | Gets wrong or limits | Verdict |
|---|---|---|---|---|
| Letterboxd | Social diary, closed | Import/export CSV, social graph, diary UX [62] | API closed to recommendation and LLM projects [54] | study (UX, CSV format) |
| Trakt | Tracker with API | Scrobbling ecosystem, API | Free tier capped (100 items per list in 2025, raised to 250 in 2026) [80][81] | wrap (import only) |
| JustWatch / Reelgood | Availability guides | Region-aware availability | JustWatch data only by partner contract [45]; neither publishes a personal taste model | study |
| Plex Discover | Universal watchlist, social feed | Cross-service search and friends' activity [82] | Tied to a Plex account | study |
| Criticker, MovieLens, Taste.io | Personal CF services | Covered in [1] | Covered in [1] | study |
| Likewise (Pix) | LLM entertainment assistant | Conversational entry point, proactive alerts [83] | Closed; built on hundreds of millions of proprietary data points | study |
| Flickmetrix | Score aggregator | Combines IMDb, RT, Metacritic, Letterboxd with availability filters [84] | No personalization | study (the "for scientists" comparison) |
| Stremio addons | Addon protocol (SDK MIT, 1,384 stars) | Anyone can publish catalogues into the player UI over HTTPS with CORS [85] | Ecosystem dominated by stream-scraping addons | study (a catalogue addon as a distribution surface) |
| Movary | Self-hosted tracker (MIT, 776 stars) | Imports Trakt, Letterboxd, Netflix; Plex/Jellyfin scrobbling; exports a Radarr list [86][87] | Server app; TMDB key per install | study |
| Ryot | Self-hosted tracker (GPL-3.0, 3,618 stars) | Many media types and imports | Recommendations only in the paid Pro version [88] | study |
| Yamtrack | Self-hosted tracker (AGPL-3.0, 3,654 stars) | CSV export and re-import, Jellyfin/Plex/Emby tracking [89] | No recommender | study |
| Watcharr, MediaTracker | Self-hosted trackers (GPL-3.0 1,520 stars; MIT 933 stars, last push 2025-02) [90][91] | Simple watched lists | No recommender | avoid |
| Jellyfin, Radarr, Seerr | Media server (GPL-2.0, 57,659), downloader (GPL-3.0, 14,474), request and discovery manager (MIT, 12,756) [92][93][94] | Seerr's discovery UI over TMDB; Radarr accepts external lists | Library-centric; the ecosystem assumes a downloader | study (Radarr list export as an optional output) |
| Recommendarr | LLM recommendations from Sonarr/Radarr/Plex libraries (Show HN 2025) [95] | Shows demand for LLM recommendations in self-hosted stacks; bundled in media-stack (1,244 stars) [96] | Pure LLM generation without a ranker; original repository returned 404 on 2026-09-30 | avoid (as a design) |
| letterboxd_recommendations | Letterboxd-based CF web app (GPL-3.0, 405 stars) [97] | Proves the CF-on-public-ratings concept | Built by scraping Letterboxd | avoid (legally) |

Worth studying first: Movary (imports and the Radarr-list output), Yamtrack (export round-trip), Flickmetrix (score comparison UI), Stremio's catalogue protocol (a second surface at almost no cost).

## 8. What an expert would add

- **Rating scale and onboarding.** Netflix moved from five stars to thumbs in 2017 after tests produced 200% more ratings (older source) [98]. Offer thumbs plus an optional half-star scale, normalise per user, and seed cold start by import (section 5) before asking for ratings.
- **Explanation UX.** State which of the seven explanation aims (transparency, scrutability, trust, effectiveness, persuasiveness, efficiency, satisfaction) the UI serves, since they conflict (2007 source) [99]. Scrutability (let the user say "wrong reason") doubles as a feedback signal.
- **Diversity and calibration controls.** Calibrated recommendations match the genre proportions of the user's history [100]; expose novelty and diversity as dials in the tool schema above.
- **Group and household recommendation.** Average, least misery and most pleasure are the standard aggregation strategies [101][102]; add a household profile with per-member vetoes.
- **Accessibility and i18n.** Target WCAG 2.2 AA [103]. The European Accessibility Act has applied since 2025-06-28, with an exemption for microenterprises providing services [104]. Wikidata labels give multilingual titles without TMDB.
- **Maintenance burden.** Every source has a different refresh cadence (IMDb datasets refresh daily [47]; TMDB content must not be cached beyond 6 months [6]); version artifacts by snapshot date on the Hugging Face repo and rebuild with a scheduled CI job.
- **Cost of LLM enrichment (estimates).** 50k titles x (400 input + 120 output tokens) with Claude Haiku 4.5 Batch at $0.50 in / $2.50 out per MTok [105] is about $25 per full pass; embedding 25 M tokens with text-embedding-3-small at $0.02/MTok [106] is about $0.50; a local MiniLM pass embedded 9,742 short texts in 2.9 s in this session. Only Wikipedia-derived or user text may be the input (section 3), and the output then carries CC BY-SA.
- **Evaluation harness as product.** Ship the per-user temporal holdout from [1] as a UI feature running in a worker, and keep strong simple baselines (popularity, item-kNN, EASE [32]) in the comparison, since many neural recommenders failed to beat them when re-run [107].

## 9. Standard terminology

| Term | Meaning |
|---|---|
| Explicit / implicit feedback | Ratings versus behaviour (watched, skipped) |
| Candidate generation (retrieval) / ranking / re-ranking | The three stages of a recommender pipeline |
| Folding-in | Computing a new user's latent vector from fixed item factors without retraining |
| Item-item neighbourhood (kNN), SLIM, EASE | Item-to-item similarity models; EASE has a closed-form solution [32] |
| Conversational recommender system (CRS); critiquing | Recommending through dialogue; "like this but less violent" feedback |
| Calibration, intra-list diversity, novelty, serendipity, coverage, popularity bias | Beyond-accuracy properties of a list [100] |
| Group recommendation; least misery | Recommending to several people; maximise the minimum member score [101] |
| Catalogue grounding; item hallucination | Constraining LLM outputs to real catalogue items [78] |
| Local-first | Software whose primary copy of data is on the user's device [61] |
| BYOK | Bring your own key: the user supplies API credentials |
| CORS; cross-origin isolation (COOP/COEP) | Browser rules for cross-site fetches; headers needed for SharedArrayBuffer |
| OPFS | Origin private file system: fast per-origin file storage in browsers |
| Remote MCP; MCP Apps; WebMCP | Hosted MCP server; server-supplied UI widgets; page-registered tools brokered by the browser |

## Open questions

- Does GroupLens consider a public, non-commercial recommender that ships ml-32m-derived neighbour tables "research purposes"? Needs an email to GroupLens.
- Would TMDB treat display-only use in an app that also has an AI assistant (never given TMDB content) as an "AI based Application"? Needs written clarification from TMDB before launch.
- Are sentence embeddings of CC BY-SA Wikipedia text "adapted material" requiring share-alike? No authoritative answer was found.
- Coverage: how many of the 30k to 60k target titles have a usable Wikipedia plot, and in which languages? Measure during the catalogue build.
- Which query encoder: MiniLM (23 MB, English-leaning) or a multilingual model; decide with report 09 [3] and a small movie-specific retrieval test.
- Is a remote MCP connector needed in v1, or do the in-app assistant and a local MCP suffice?

## REFERENCES

1. [In-house preliminary report: Movie Recommendation Systems (2026-09-30)](<_tmp/movie_recommender_systems_report.md>)
2. [In-house report 08: Client-Side AI Vector Search (2026-05-20)](<g/g_embeddings/docs/research/semantic_search/08 -- Client-Side AI Vector Search.md>)
3. [In-house report 09: Embedding Model Architecture Research Paper (2026-05-20)](<g/g_embeddings/docs/research/semantic_search/09 -- Embedding Model Architecture Research Paper.md>)
4. [In-house report 03: Vector Storage and Retrieval (2026-05-20)](<g/g_embeddings/docs/research/semantic_search/03 -- Vector Storage and Retrieval -- A Deep Research Report for Facade Design.md>)
5. [In-house inventory for the movie-recommender project (2026-09-30), incl. packages ef, vd, qh, py2mcp, dol, zodal, acture, app_ef](<_agent_work/movie-rec/inhouse-inventory.md>)
6. [TMDB API Terms of Use (last updated 2023-10-20)](https://www.themoviedb.org/api-terms-of-use)
7. [IMDb Help: Can I use IMDb data in my software?](https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX)
8. [GroupLens: MovieLens 25M README (usage licence)](https://files.grouplens.org/datasets/movielens/ml-25m-README.html)
9. [GroupLens: Tag Genome dataset README (usage licence)](https://files.grouplens.org/datasets/tag-genome/README.html)
10. [Wikidata: Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)
11. [Wikipedia: Reusing Wikipedia content](https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content)
12. [GroupLens: MovieLens 32M README (usage licence; generated 2023-10-13)](https://files.grouplens.org/datasets/movielens/ml-32m-README.html)
13. [Hou Y et al. Large Language Models are Zero-Shot Rankers for Recommender Systems. ECIR 2024 (arXiv 2023)](https://arxiv.org/abs/2305.08845)
14. [Kapetanovic A et al. Retrieval, Scoring, and Decoding Shape Performance and Stability in LLM-based Conversational Recommendation. CIKM 2026](https://arxiv.org/abs/2609.00086)
15. [Hugging Face: Transformers.js v4 (2026-02-09)](https://huggingface.co/blog/transformersjs-v4)
16. [web.dev: WebGPU is now supported in major browsers; and Wikipedia: WebGPU (browser versions)](https://web.dev/blog/webgpu-supported-major-browsers)
17. [tensorflow/tfjs issue 8609: 4.22.0 tfjs-node broken with Node 24](https://github.com/tensorflow/tfjs/issues/8609)
18. [MarkTechPost: Google releases LiteRT.js (2026-07-15, secondary)](https://www.marktechpost.com/2026/07/15/google-releases-litert-js-a-javascript-binding-of-litert-that-runs-tflite-models-in-browsers-via-webgpu/)
19. [Kanopy Labs: PGlite vs SQLite Wasm vs DuckDB Wasm (2026, secondary)](https://kanopylabs.com/blog/pglite-vs-sqlite-wasm-vs-duckdb-wasm)
20. [huggingface/datasets issue 7931: CORS + HTTP Range on the Xet CDN (closed 2026-02-24)](https://github.com/huggingface/datasets/issues/7931)
21. [asg017/sqlite-vec releases](https://github.com/asg017/sqlite-vec/releases)
22. [Garcia A. Introducing sqlite-vec v0.1.0 (2024, older)](https://alexgarcia.xyz/blog/2024/sqlite-vec-stable-release/index.html)
23. [SQLite: WASM persistence options](https://sqlite.org/wasm/doc/trunk/persistence.md)
24. [PGlite: What is PGlite](https://pglite.dev/docs/about)
25. [PGlite: Extensions (pgvector size)](https://pglite.dev/extensions/)
26. [USearch JavaScript SDK documentation](https://unum-cloud.github.io/USearch/javascript/index.html)
27. [MDN: Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
28. [WebKit: Tracking Prevention in WebKit (7-day cap, home-screen exemption)](https://webkit.org/tracking-prevention/)
29. [GitHub community discussion 13309: Allow setting COOP and COEP headers in GitHub Pages](https://github.com/orgs/community/discussions/13309)
30. [Cloudflare Pages: Headers](https://developers.cloudflare.com/pages/configuration/headers/)
31. [GroupLens: MovieLens ml-latest-small README](https://files.grouplens.org/datasets/movielens/ml-latest-small-README.html)
32. [Steck H. Embarrassingly Shallow Autoencoders for Sparse Data. WWW 2019 (older)](https://arxiv.org/abs/1905.03375)
33. [Hugging Face model file listings: Xenova/all-MiniLM-L6-v2, Xenova/bge-small-en-v1.5, onnx-community/Qwen3-Embedding-0.6B-ONNX](https://huggingface.co/Xenova/all-MiniLM-L6-v2/tree/main/onnx)
34. [GitHub Docs: GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
35. [Cloudflare Pages: Limits](https://developers.cloudflare.com/pages/platform/limits/)
36. [Cloudflare R2: Pricing](https://developers.cloudflare.com/r2/pricing/)
37. [Cloudflare R2: Public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)
38. [Hugging Face Hub: Storage limits](https://huggingface.co/docs/hub/en/storage-limits)
39. [Hugging Face Hub: Rate limits](https://huggingface.co/docs/hub/en/rate-limits)
40. [Hugging Face: Terms of Service (effective 2022-09-15)](https://huggingface.co/terms-of-service)
41. [jsdelivr/jsdelivr issue 18268 (20 MB file limit); duckdb-wasm issue 1561 (150 MB package limit)](https://github.com/jsdelivr/jsdelivr/issues/18268)
42. [jsDelivr Acceptable Use Policy (PR 18247)](https://github.com/jsdelivr/jsdelivr/pull/18247/files)
43. [TMDB developer docs: Rate limiting](https://developer.themoviedb.org/docs/rate-limiting)
44. [TMDB developer docs: Movie watch providers (JustWatch attribution)](https://developer.themoviedb.org/reference/movie-watch-providers)
45. [JustWatch Partner API documentation](https://apis.justwatch.com/docs/api/)
46. [GroupLens: MovieLens ml-latest README (generated 2023-07-20)](https://files.grouplens.org/datasets/movielens/ml-latest-README.html)
47. [IMDb Non-Commercial Datasets](https://developer.imdb.com/non-commercial-datasets/)
48. [IMDb Conditions of Use](https://www.imdb.com/conditions)
49. [OMDb API home page (licence line, key tiers, poster API)](https://www.omdbapi.com/)
50. [OMDb: Terms of use](https://www.omdbapi.com/legal.htm)
51. [Wikidata Query Service (SPARQL counts run 2026-09-30 on wd:Q11424 items with P345, P4947, P6127, P1258, P1712, and P444 qualified by P447 = Q105584)](https://query.wikidata.org/)
52. [Netflix Prize Rules (archived 2009, older)](https://web.archive.org/web/2009/http://www.netflixprize.com/rules)
53. [Wikipedia: Netflix Prize](https://en.wikipedia.org/wiki/Netflix_Prize)
54. [Letterboxd: API (beta access page)](https://letterboxd.com/api-beta/)
55. [Letterboxd: Terms of use](https://letterboxd.com/legal/terms-of-use/)
56. [Willison S. Claude API now supports CORS requests (2024-08-23, older)](https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/)
57. [TMDB Talk: API key security in JavaScript (staff reply 2018-08-08, older)](https://www.themoviedb.org/talk/5b6b0e08925141406a1134de)
58. [Cloudflare Workers: Limits](https://developers.cloudflare.com/workers/platform/limits/)
59. [Movary docs: TMDB data](https://github.com/leepeuker/movary/blob/main/docs/features/tmdb-data.md)
60. [Ryot docs: Configuration](https://github.com/IgnisDa/ryot/blob/main/apps/docs/src/configuration.md)
61. [Kleppmann M et al. Local-first software: you own your data, in spite of the cloud. Ink & Switch 2019 (older)](https://www.inkandswitch.com/essay/local-first/)
62. [Letterboxd: Importing data](https://letterboxd.com/about/importing-data/)
63. [IMDb Help: Ratings FAQ (export)](https://help.imdb.com/article/imdb/track-movies-tv/ratings-faq/G67Y87TFYYP6TWAV)
64. [Data Transfer Initiative portmap: Netflix viewing history](https://portmap.dtinit.org/articles/watch-history4.md/)
65. [Google Drive API: Store application-specific data](https://developers.google.com/workspace/drive/api/guides/appdata)
66. [github/roadmap issue 1153: Single page app support for GitHub Apps (Preview, Paused)](https://github.com/github/roadmap/issues/1153)
67. [GDPR Recital 18: Personal or household activities](https://gdpr-info.eu/recitals/no-18/)
68. [Claude docs: Add a connector that isn't in the directory (remote MCP)](https://claude.com/docs/connectors/custom/remote-mcp)
69. [Model Context Protocol: Versioning (current 2026-07-28)](https://modelcontextprotocol.io/specification/versioning)
70. [Model Context Protocol 2026-07-28: Key changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
71. [SEP-1865: MCP Apps, interactive user interfaces for MCP](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp)
72. [Spronta: The State of WebMCP, July 2026 (secondary)](https://www.spronta.com/blog/state-of-webmcp-july-2026/)
73. [Chrome Web Store: WebMCP Bridge](https://chromewebstore.google.com/detail/webmcp-bridge/chgjbookknohehmaocfijekhaocaanaf)
74. [Agent Skills specification](https://agentskills.io/specification)
75. [Peng Q et al. A Survey on LLM-powered Agents for Recommender Systems. Findings of EMNLP 2025](https://aclanthology.org/2025.findings-emnlp.620/)
76. [He Z et al. Large Language Models as Zero-Shot Conversational Recommenders. CIKM 2023 (older)](https://arxiv.org/abs/2308.10053)
77. [Sun R, Li X, Akella A, Konstan JA. Large Language Models as Conversational Movie Recommenders: A User Study. 2024](https://arxiv.org/abs/2404.19093)
78. [Ravikumar S. Do LLM Recommenders Know When They're Hallucinating? CIKM 2026 short paper](https://arxiv.org/abs/2608.10008)
79. [OMuleT: Orchestrating Multiple Tools for Practicable Conversational Recommendation. 2024](https://arxiv.org/abs/2411.19352)
80. [Trakt forums: Freemium experience, more features for all with usage limits (2025)](https://forums.trakt.tv/t/freemium-experience-more-features-for-all-with-usage-limits/41641)
81. [PlexTraktSync discussion 2407: New Trakt limits for 2026](https://github.com/Taxel/PlexTraktSync/discussions/2407)
82. [Plex blog: Discover Together](https://www.plex.tv/blog/discover-together/)
83. [TechCrunch: Likewise debuts Pix, an AI chatbot for entertainment recommendations (2023, older)](https://techcrunch.com/2023/10/05/likewise-debuts-pix-an-ai-chatbot-for-entertainment-recommendations/)
84. [Flickmetrix](https://flickmetrix.com/)
85. [Stremio addon SDK](https://github.com/Stremio/stremio-addon-sdk)
86. [Movary (GitHub)](https://github.com/leepeuker/movary)
87. [Movary docs: Radarr](https://docs.movary.org/features/radarr/)
88. [Ryot (GitHub)](https://github.com/IgnisDa/ryot)
89. [Yamtrack (GitHub)](https://github.com/FuzzyGrim/Yamtrack)
90. [Watcharr (GitHub)](https://github.com/sbondCo/Watcharr)
91. [MediaTracker (GitHub)](https://github.com/bonukai/MediaTracker)
92. [Jellyfin (GitHub)](https://github.com/jellyfin/jellyfin)
93. [Radarr (GitHub)](https://github.com/Radarr/Radarr)
94. [Seerr (GitHub)](https://github.com/seerr-team/seerr)
95. [Show HN: Recommendarr (2025)](https://news.ycombinator.com/item?id=43230790)
96. [navilg/media-stack (GitHub)](https://github.com/navilg/media-stack)
97. [sdl60660/letterboxd_recommendations (GitHub)](https://github.com/sdl60660/letterboxd_recommendations)
98. [Netflix: Goodbye Stars, Hello Thumbs (2017, older)](https://about.netflix.com/en/news/goodbye-stars-hello-thumbs)
99. [Tintarev N, Masthoff J. Effective explanations of recommendations. RecSys 2007 (older)](https://www.macs.hw.ac.uk/~dwcorne/ACMRecSys07/p203-tintarev.pdf)
100. [Steck H. Calibrated Recommendations. RecSys 2018 (older)](https://dl.acm.org/doi/10.1145/3240323.3240372)
101. [Masthoff J. Group Recommender Systems: Aggregation, Satisfaction and Group Attributes. Recommender Systems Handbook 2015 (older)](https://link.springer.com/chapter/10.1007/978-1-4899-7637-6_22)
102. [Felfernig A et al. Group Recommender Systems (2nd ed.), Springer 2024](https://www.researchgate.net/publication/377665185_Group_Recommender_Systems)
103. [W3C: Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/)
104. [European Accessibility Act, Directive (EU) 2019/882, full text](https://www.accessibilityref.eu/eaa/act)
105. [Claude API: Pricing (Haiku 4.5, Batch discount)](https://platform.claude.com/docs/en/about-claude/pricing)
106. [OpenAI: text-embedding-3-small](https://developers.openai.com/api/docs/models/text-embedding-3-small)
107. [Ferrari Dacrema M, Cremonesi P, Jannach D. Are We Really Making Much Progress? RecSys 2019 (older)](https://arxiv.org/abs/1907.06902)
