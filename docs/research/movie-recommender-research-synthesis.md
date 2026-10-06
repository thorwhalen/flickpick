# Movie recommender: research synthesis

Date: 2026-09-30. Scope: synthesis of one parallel research round (in-house inventory, recommender methods, streaming and ratings APIs, semantic data and filter features, posters, browser feasibility and licensing, naming) against the user's brief [1] and the preliminary report [2]. It adds no new primary research. Facts come from the linked reports; where a report did not settle something, this document says so. It is an engineering reading of published terms, not legal advice. The architecture and seam table is out of scope.

## Summary and recommendation

- Compute is not the binding constraint; data licensing is. Every report that looked at terms reached the same conclusion independently [4][5][6][7][8].
- Build a static, browser-first app. Python is an offline build pipeline (training, catalogue assembly, embedding), with a thin optional `qh` service or Cloudflare Worker only for what a static site cannot do: a remote MCP endpoint, optional sync, and proxies [8].
- Collaborative filtering: EASE trained offline on MovieLens ml-32m, sparsified to the top 100 to 200 neighbours per item. For a 10k to 20k catalogue it is a 2.5 to 10 MB artifact that keeps 98 to 99% of dense NDCG, and it is scored in the browser as one sparse vector-matrix product [4]. iALS is the second scorer, item-kNN the explainable baseline, and RP3beta the long-tail option.
- Semantic layer: Wikipedia plot sections (CC BY-SA) and an LLM-generated "vibe profile" per film with a fixed vocabulary, both embedded with a small 384-dimension model (bge-small-en-v1.5 int8, 34 MB). The vectors ship as int8 (11.5 MB for 30k films) and are searched by brute force, with no ANN index [6][8].
- Facts and IDs come from Wikidata (CC0). TMDB, JustWatch-via-TMDB, OMDb, MDBList and Movie of the Night are display-only, fetched live with the user's own keys and cached locally under each source's rules [5][8].
- Posters: hotlink the TMDB image CDN with attribution, never store copies, and fall back to generated placeholders [7].
- The LLM parses the request, extracts constraints and explains the results. A deterministic ranker over catalogue IDs does the ranking [4][8].
- Evaluation: full-catalogue ranking on the user's own history with a rolling temporal split and confidence intervals. With one user, only large differences between methods can be detected [4].
- Recommended licensing posture: (A) "open core", with a written request to TMDB (posture B) running in parallel. B only adds scope if TMDB agrees in writing (section "The licensing decision").
- Name: the naming report's first choice is `cinepick`, then `reelpick`. GitHub, domain and trademark checks are still outstanding [9].

## Answers to the user's questions

### (a) Browser vs Python

**Answer.** Most of it runs in the browser. Browsing, faceted filtering, "more like these", per-user CF scoring (EASE is s = xB, with no fold-in; iALS needs one d x d solve), diversity reranking, the personal train/test harness and the statistics all run client-side. Free-text semantic queries also run client-side after a one-time download of a 23 to 34 MB query encoder [4][8]. Python is needed offline: training on ml-32m's 32M ratings, building the catalogue from dumps, and fetching sources that block CORS (IMDb datasets and GroupLens files send no CORS headers) [8]. A runtime server is needed only for a remote MCP connector, cross-device sync, or a shared secret [8].

**Method.** Transformers.js v4 (WebGPU with a WASM fallback), typed arrays plus ml-matrix for the linear algebra, duckdb-wasm loaded lazily on the statistics page only. On the Python side: RecTools or LensKit for evaluation, implicit for iALS, and EASE written directly in NumPy [4][8].

**Constraint.** Safari deletes script-written storage after 7 days without interaction, so the app needs export, PWA install and optional sync [8]. Dense EASE training memory grows with n²: 1.6 GB for 20k items [4].

**Detail.** [8] §1–2, [4] §1, §3.

### (b) Streaming availability feed

**Answer.** No free source is redistributable, commercially usable and ML-permitted all at once [5].

**Chosen source.** TMDB `/watch/providers` is the default: free, 180+ countries, JustWatch data. Movie of the Night's Streaming Availability API is the second provider: 1,000 requests a month free, commercial use and caching allowed, daily updates, deep links [5]. Watchmode is optional (2,500 credits a month, non-commercial, 30-day cache). JustWatch's own API is contract-only, and the unofficial JustWatch clients are archived or non-commercial, so both are rejected [5].

**Constraint.** Availability belongs at query time, never in training. Both providers are called with the user's own key. JustWatch and TMDB attribution is mandatory, and access is revoked without it. Every value carries a `fetched_at` date shown as "as of" [5].

**Detail.** [5] §1, §5.

### (c) Ratings scores (RT, IMDb, etc.)

**Answer.** Rotten Tomatoes and Metacritic have no usable public API. RT's terms (2026-01-06) forbid scraping and AI training [5]. The workable free combination is:

- IMDb `title.ratings`: 1.7M rows, 8.7 MB gzipped, refreshed daily. Personal and non-commercial use only, and it may not be republished, so the user downloads it locally.
- TMDB `vote_average`.
- MDBList: 1,000 requests a day free, and the only single source covering RT critic and audience, Metacritic, Letterboxd and Trakt.
- OMDb: IMDb, RT and Metacritic values, 1,000 requests a day, CC BY-NC.
- Wikidata `P444`: a dated CC0 snapshot, but stale; 25,349 films carry an RT score statement and the largest block is dated 2021 [5].

**Constraint.** MDBList's terms were not found, and OMDb's upstream rights to its RT and IMDb values are unverified [5]. The scores differ in kind (percentage positive, weighted mean, undisclosed weights), so each is stored with its source, scale, vote count and date [4][5]. The Letterboxd API refuses recommendation and LLM projects, so Letterboxd data enters only through the user's own export [5].

**Detail.** [5] §2, §5.

### (d) Data for the "for scientists" statistics

**Answer.** Four inputs:

- The user's ratings, from imports (Letterboxd, IMDb, MovieLens, Trakt, Netflix history as implicit feedback) [5].
- Live population scores from (c), frozen as dated snapshots.
- MovieLens ml-32m as the reproducible, citable population baseline [4][5].
- The FiveThirtyEight 2015 dataset (CC BY 4.0) as an illustrative reference: RT critics vs Metacritic ρ = 0.96, RT audience vs IMDb ρ = 0.92, critic vs audience pairs 0.69 to 0.78 [4].

**Method.** Spearman and Kendall τ-b with confidence intervals. Per-user z-score and percentile normalisation. Bland-Altman plots for systematic offsets. PCA across sources, which separates a critic factor from an audience factor. Regularised and ordinal regression with nested cross-validation for "which formula predicts me". Rolling-origin temporal splits, bootstrap and Wilson intervals [4].

**Constraint.**

- Sample size dominates: a Spearman ρ of 0.5 has a 95% interval of 0.15 to 0.74 at n = 30 and 0.33 to 0.64 at n = 100 [4].
- Live scores drift, so snapshot them before the split to avoid leakage [5].
- Ratings are missing not at random, so offline scores mean "predicts what I chose to rate" [4].
- Don't show predicted scores while the user is rating, because users anchor on them [4].
- The terminology tables in [4] §6 and [8] §9 can seed the page that discusses how recommenders work.

**Detail.** [4] §4–6, [5] §4.

### (e) Semantic description data for embedding and semantic filtering

**Answer.** TMDB overviews and keywords are the best structured text, but TMDB's AI clause rules them out as embedding or LLM input [6][8]. The shippable sources are:

- Wikipedia plot sections, 400 to 700 words by the film style guide. 144,245 Wikidata films have a TMDB ID, an IMDb ID and an English article; the share with a Plot section was not measured [6].
- An LLM-generated "vibe profile" per film: mood, pacing, tone, themes, content flags, and a 60-word "feel" paragraph, all from fixed vocabularies seeded from Tag Genome tags [6].

No Hugging Face or Kaggle embedding dataset is fit to depend on [6]. The MovieLens Tag Genome, CMU and MPST corpora are for offline evaluation only [6].

**Method.** Embed the feel paragraph and the plot separately. Parse queries into `{semantic_query, must, must_not}`, because bi-encoders handle negation worse than chance on NevIR [6].

**Constraint.** It is unsettled whether an LLM summary or an embedding of CC BY-SA text is "adapted material", so the conservative choice is to publish profiles under CC BY-SA [6][8]. LLM knowledge is weak on obscure titles, so the model is always given the plot text [6].

**Detail.** [6] §1–4, §7.

### (f) Filterable features

**Answer and sources.**

- Wikidata (CC0) supplies genre, runtime, dates and decade, languages, countries, cast and crew, franchise and awards. Awards (`P166`) are on 14,367 of 349,601 film items [6].
- Age rating (certification) is well covered only by TMDB `/release_dates`, per country with a severity order. Wikidata `P1657` covers 6,249 films [6].
- There is no free, openly licensed source of content descriptors (violence, sex, language). Common Sense Media, IMDb Parents Guide and Kids-in-Mind are partner-only, paid or unlicensed. Content flags are therefore LLM-inferred and labelled "inferred" [6].

**Constraint.** Under posture A, a filter on certification across the full catalogue is the main functional gap. The reports do not resolve it. Options: Wikidata as a partial source, LLM-inferred audience flags, or looking up certification with the user's TMDB key only for the shortlisted candidates. The last is this synthesis's suggestion, not a report finding.

**Detail.** [6] §5, [8] §3.

### (g) Posters

**Answer.** Use the TMDB image CDN. It is free, needs no key at the image layer, sends CORS `*` and roughly one-year cache headers, and is licensed for non-commercial use with the TMDB logo and a fixed notice [7]. Every alternative is paid, closed, unlicensed, or a re-hosted copy of TMDB or IMDb images: OMDb posters, IMDb, Wikipedia non-free images, Kaggle and Hugging Face poster dumps, Letterboxd, iTunes, JustWatch [7]. Fanart.tv is optional for logos and 4K backgrounds once its terms are verified. Trailers are YouTube keys from TMDB `/videos`, embedded behind a click-to-load `youtube-nocookie.com` facade [7].

**Constraint.**

- Posters are copyrighted, and TMDB grants no rights in them [7].
- Hotlink only. Never commit or re-host poster files, blur hashes or poster embeddings. Honour takedowns. Keep any cache under 6 months [7].
- Image URLs need no key, but finding each film's `poster_path` requires the API. See the conflict below on shipping `poster_path` strings.

**Detail.** [7] §1–4.

### (h) What the user did not think of

- **Licensing shapes the architecture.** See the next section [8].
- **Item cold start.** ml-32m ends on 2023-10-12, so later releases have no collaborative signal. They need a content-to-CF bridge [4].
- **Entity resolution across sources.** Wikidata `P345`/`P4947`/`P1258`/`P1712`/`P6127` give the IMDb, TMDB, RT, Metacritic and Letterboxd IDs. MovieLens `links.csv` and TMDB `/find` fill gaps. Ambiguous or one-to-many matches are excluded, not guessed [5][6].
- **API key handling.** A static site cannot hide a key. The user supplies their own keys (the pattern established by the self-hosted Movary and Ryot apps), with a strict CSP; a proxy makes the operator the licensee [5][8].
- **Privacy.** Netflix Prize ratings were re-identified by linking them to public IMDb ratings. Keep ratings on the device by default [4][8].
- **Evaluation pitfalls.** Sampled-negative metrics are inconsistent with full-catalogue ranking. Users' own test-retest noise (RMSE 0.557 to 0.816) sets a floor below which RMSE gains mean nothing. LLMs have memorised MovieLens [4].
- **Queries with exclusions.** Negation and exclusion ("nothing gory") need structured filters, not an embedding [6].
- **List quality beyond accuracy.** Calibration, diversity and novelty dials; group and household recommendation (least misery); explanations the user can correct; eliciting first ratings by importing existing histories [4][8].
- **Surfaces.** Beyond the in-app assistant: remote MCP, MCP Apps, a Stremio catalogue addon, and shipped agent skills. Trakt's API is unstable this quarter: app creation has been VIP-only since 2026-07-30, and app management moves to a developer portal on 2026-10-22 [5][8].
- **Operations.** Refresh cadences, attribution built into the UI components, recording which version of each source's terms applies, and a WCAG 2.2 AA target [7][8].

## The licensing decision

This is the most consequential finding that cuts across all the reports. The binding texts are:

- **TMDB API Terms of Use, last updated 2023-10-20** [10]. They prohibit: "Use the TMDB APIs or TMDB Content in connection with, including for training, a machine learning (ML) or artificial intelligence (AI) based Application". They also:
  - forbid caching beyond 6 months, bulk downloads and derivatives;
  - require the TMDB logo and the notice "This [product] uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB";
  - require a written agreement for any revenue, listing a revenue-generating recommendation site and use with an LLM chatbot as commercial uses [5][7][8].

  A TMDB staff reply of 2026-07-21 says that request-time similarity for a non-commercial project is not what the clause targets. A forum post is not a licence, and the reply does not cover an agent-driven assistant [5][6][7][11].
- **MovieLens.** ml-32m is for research only, with no commercial use without permission. Anyone "may redistribute the data set, including transformations, so long as it is distributed under these same license conditions" [12]. ml-25m and the Tag Genome forbid redistribution without separate permission [13].
- **IMDb non-commercial datasets.** Personal and non-commercial use only. The data "must not be altered/republished/resold/repurposed to create any kind of online/offline database". The attribution line is required [14][15].
- **OMDb:** CC BY-NC 4.0, and its terms forbid derivatives [5].
- **Wikidata:** CC0 [16].
- **Wikipedia text:** CC BY-SA 4.0 [17].
- **Letterboxd API:** refused to recommendation, LLM and personal projects. This wording comes from search excerpts; the page returned 403 to the research tools [18].
- **Trakt:** API app creation VIP-only since 2026-07-30 [19].

In the matrix below, "Local only" means the user's own copy on their own machine, never redistributed. "n/a" means the source has no live API.

| Source | Ship in repo / data package | Use in trained model | Embed / feed to LLM | Display live with user's key |
|---|---|---|---|---|
| TMDB metadata (overview, keywords, certification) | No (6-month cap, no bulk or derivatives) | No | No, as worded; unresolved (see below) | Yes, with logo and notice |
| TMDB watch providers (JustWatch data) | No | No (and time-varying) | No, as worded | Yes, with JustWatch attribution |
| TMDB images | No (hotlink only) | No | No | Yes (image URLs are keyless) |
| MovieLens ml-32m | Data package only, same non-commercial licence, not the code repo | Yes, non-commercial; whether "research purposes" covers a public app is unconfirmed | Not addressed in the reports | n/a |
| MovieLens ml-25m, Tag Genome | No | Offline evaluation only | Not addressed | n/a |
| IMDb datasets | No | Local only | Not addressed by the terms; local only | Local file the user downloads, with the IMDb credit line |
| OMDb | No | No (NC, no derivatives) | Not addressed; avoid | Yes, with CC BY-NC notice |
| MDBList | No | Unknown (terms not found) | Unknown | Yes, pending a terms check |
| Movie of the Night | No (no resharing) | Not addressed | Not addressed | Yes, with link; commercial use allowed |
| Wikidata | Yes | Yes | Yes | Yes |
| Wikipedia text | Yes, as a separate CC BY-SA package with attribution | Yes (share-alike status of derived vectors unsettled) | Yes | Yes |
| Letterboxd API | No | No | No | No; the user's own export only |
| Trakt | No | No (policy bars feeding a catalogue) | Not addressed | Personal history sync only |
| RT / Metacritic direct | No | No (RT bars AI training) | No | No; only via MDBList, OMDb or Wikidata |
| User's own ratings | User's choice | Yes | Yes, with the user's consent | n/a |

There are two viable postures.

**Posture A: "open core".** Shipped artifacts come only from Wikidata, Wikipedia and MovieLens ml-32m. The data package is licensed separately from the code (non-commercial for the MovieLens-derived parts, CC BY-SA for the Wikipedia-derived parts). TMDB, JustWatch-via-TMDB, OMDb, MDBList and Movie of the Night are display-only and fetched live with the user's own keys. None of their content reaches embeddings, the ranker or the LLM.

- Costs: the catalogue-wide certification filter (see (f)); synopses where Wikipedia has no plot; posters for users without a TMDB key.
- Open risk: whether TMDB treats a display-only app that also has an AI assistant as an "AI based Application" [8].

**Posture B: TMDB clearance.** Ask TMDB for a written agreement covering the assistant, the MCP connector and a persisted index, then use TMDB for the catalogue (overviews, keywords, certifications, poster paths). It gives a richer and more uniform catalogue. It still leaves the 6-month cache cap, attribution, and the need for a separate agreement before any revenue. It also makes the project depend on one vendor's revocable permission, and MovieLens terms still govern the CF artifacts.

**Recommendation.** Every report that addressed the question recommends A as the build basis and asking TMDB as a parallel step: [5] "keep TMDB data out of any persisted trained model and get written confirmation", [6] "open core" with a separate CC BY-SA data package, [7] "get written confirmation ... or keep TMDB data out of the LLM path", and [8] "display-only". Build A, send the TMDB request now, and adopt B's additions only if the written answer allows them.

Three answers would settle it:

1. A written reply from TMDB stating whether each of the following is permitted:
   - display-only use in an app that has an AI assistant;
   - request-time similarity over TMDB metadata, or passing it to the LLM;
   - a shipped index derived from TMDB content.
2. A reply from GroupLens on whether a public non-commercial app that ships ml-32m-derived tables counts as "research purposes".
3. Legal clarity on whether embeddings of CC BY-SA text are adapted material.

## Conflicts and disagreements between reports

1. **TMDB metadata at request time for similarity.** [5] and [6] read the July 2026 staff reply as putting request-time similarity outside the AI clause. [8] says TMDB content must never reach embeddings or the LLM. [7] says the reply covers a narrower case than an agent that chooses movies. Resolution: follow [8] until TMDB answers in writing. A forum reply is not a licence, and this app has an assistant by design.
2. **Shipping TMDB `poster_path` strings.** [7] proposes a build-time catalogue snapshot with `poster_path` strings and a Worker holding a shared token. [8] rules out a static TMDB-derived catalogue and treats a shared-key proxy as acceptable only for a non-AI display path. [5] makes user-supplied keys the default. Resolution: under A, resolve posters at runtime with the user's key (IMDb or TMDB ID to `poster_path`) and cache them locally for less than 6 months. Without a key, show generated placeholders. A shared-key Worker waits for TMDB's answer.
3. **Embedding model.** [8] measured MiniLM-L6 (23 MB) as the query encoder. [6] recommends bge-small-en-v1.5 int8 (34 MB, MIT) or arctic-embed-xs (23 MB). MiniLM is weaker at retrieval and truncates text at 256 word pieces. [4] only requires a 384-dimension model. The in-house matrix gives MiniLM an MTEB score of about 58.8, against about 56 in secondary sources [6]. Resolution: bge-small as the default, arctic-embed-xs if download size dominates, MiniLM as a baseline only. Decide on the Tag Genome mood-query proxy.
4. **ANN index.** The preliminary report proposes FAISS [2], and the inventory points to `vd` [3]. [4], [6] and [8] all show brute force suffices below about 100k items (30k × 384 int8 is about 11.5M multiply-adds per query), and that the browser ANN libraries are stale or pre-1.0. Resolution: a flat scan in the browser. `vd`/FAISS only for the optional Python service.
5. **Python as runtime server vs offline pipeline.** The brief allows "python + qh to make a web service" [1], and the preliminary report calls server-side "the natural default" [2]. [8] and [4] show that the per-user computation fits in the browser. Resolution: Python is an offline pipeline. `qh` is a thin, optional service for remote MCP, sync and proxies. `zodal-store-http` keeps a server-backed path open [3].
6. **Catalogue size and primary key.** [4] targets 10k to 20k items for the CF model: the 10k most-rated films carry 96.7% of ratings, and EASE memory grows with n². [6] and [8] target about 30k films for content, roughly IMDb ≥ 2,400 votes. Resolution: two nested sets. The CF artifact covers the 10k to 20k films with MovieLens signal, and content covers about 30k. The key also differs: [5] uses (kind, TMDB ID), [6] uses IMDb tconst plus TMDB ID with the QID as the open join, and [8] uses Wikidata QIDs. Under A, shipped data are Wikidata-derived, so the synthesis suggests the QID as the canonical key, with tconst and the TMDB ID as required cross-IDs. This is a decision for the lead.
7. **Collaborative-filtering artifact.** [8] sketches a top-50 item-item table plus 64-dimension MF factors. [4] measured sparse EASE (top-100/200, int8) and found that iALS needs d ≥ 512 to beat EASE. Resolution: follow [4]. Its numbers were measured on ml-32m.
8. **MovieLens redistribution.** [6] states "no redistribution", citing the 25M and Genome terms. [8] and [4] quote ml-32m, which allows redistribution of transformations under the same licence. Resolution: both are right about different releases. Ship only ml-32m derivatives, in the data package.
9. **Minor numeric disagreements.**
   - IMDb API price: $150,000 per 12 months plus usage [5] vs $400,000 per year [6]. Unresolved and irrelevant, since both reject the API.
   - WebGPU: "about 87% of browsers" [4] vs "Baseline in all major engines" with gaps on Firefox Android and Linux [8]. The conclusion is the same: keep a WASM fallback.
   - Wikidata TMDB-ID counts (243,002 / 243,071 / 237,735 paired with IMDb) come from different queries [5][6][8].
   - LLM-enrichment cost: $3 to $127 for 30k films in batch mode [6] vs about $25 for 50k with Haiku [8]. They assume different token counts (1,500/350 vs 400/120).

## What we will use

| Concern | Chosen default | Alternative | Licence | Report |
|---|---|---|---|---|
| Runtime | Static SPA, browser compute | Thin `qh` service | code: open source | [8] |
| App hosting | GitHub Pages | Cloudflare Pages (if COOP/COEP needed) | n/a | [8] |
| Data artifact hosting | Hugging Face dataset repo, pinned revision | Cloudflare R2 on a custom domain | per-source | [8] |
| CF scorer | Sparse EASE (top-100/200, int8) on ml-32m | iALS fold-in; RP3beta | MovieLens NC, same-conditions | [4] |
| Explainable baseline | Item-kNN; popularity | — | same | [4] |
| Python train/eval | RecTools or LensKit; implicit; NumPy EASE | Cornac, RePlay (study) | MIT / Apache-2.0 | [4] |
| Browser math | Typed arrays + ml-matrix | onnxruntime-web (custom ranker) | MIT | [4] |
| Query encoder | bge-small-en-v1.5 int8 via Transformers.js v4 | snowflake-arctic-embed-xs | MIT / Apache-2.0 | [6][8] |
| Vector search | Brute-force int8 scan in a worker | Binary first pass + int8 rescoring | n/a | [4][6][8] |
| Storyline text | Wikipedia plot sections | Wikidata description (low confidence) | CC BY-SA 4.0 | [6] |
| Mood / feel | LLM vibe profile, fixed vocabulary, batch mode | Tag Genome (evaluation only) | CC BY-SA (conservative) | [6] |
| Facts and facets | Wikidata | TMDB live (user's key) | CC0 | [6][8] |
| Age rating | TMDB `/release_dates` live (user's key) | Wikidata P1657 (partial) | TMDB terms | [6] |
| Content flags | LLM-inferred, labelled "inferred" | Does the Dog Die (opt-in user key) | — | [6] |
| ID crosswalk | Wikidata IDs + MovieLens `links.csv` | TMDB `/find` live | CC0 / MovieLens | [5][6] |
| Streaming availability | TMDB watch providers (user's key) | Movie of the Night (user's key) | TMDB terms / MotN terms | [5] |
| Population scores (display) | MDBList (user's key) | OMDb; TMDB vote_average; Wikidata P444 | unknown / CC BY-NC / TMDB / CC0 | [5] |
| Population scores (stats) | IMDb `title.ratings`, user-downloaded; ml-32m baseline | FiveThirtyEight 2015 (reference) | IMDb personal NC / MovieLens / CC BY 4.0 | [4][5] |
| Posters, backdrops | TMDB CDN hotlink + `srcset` | Generated placeholder; Fanart.tv | TMDB terms, attribution | [7] |
| Trailers | TMDB `/videos` → youtube-nocookie facade | — | YouTube policies | [7] |
| User data | zodal store over IndexedDB/localStorage, export JSON + Letterboxd CSV | Drive `appDataFolder`; qh sync | user-owned | [3][8] |
| Imports | Letterboxd, IMDb, MovieLens CSV | Netflix history, Trakt | user-owned | [5][8] |
| LLM role | Query parser, constraint extractor, explainer | Rerank a short grounded list (test first) | BYO LLM key | [4][8] |
| Agent surfaces | `acture` commands → in-app assistant + local MCP (`py2mcp`) | Authless remote MCP (catalogue only) | — | [3][8] |
| Evaluation | Full ranking, rolling temporal, bootstrap/Wilson CIs | Leave-last-out as one fold | — | [4] |

## Numbers worth remembering

| Fact | Value | Report |
|---|---|---|
| ml-32m | 32,000,204 ratings; 87,585 films; 200,948 users; ends 2023-10-12; median user 73 ratings | [4] |
| Rating concentration | 10k most-rated films carry 96.7% of ratings; 20k carry 98.9% | [4] |
| Dense EASE B | 400 MB (10k) / 1.6 GB (20k), float32; inverse 16 s / 131 s on 10 cores | [4] |
| Sparse EASE, measured | 10k top-100: 3.3 MB fp16 / 2.5 MB int8, 98% of dense NDCG@100; 20k top-200 int8: 10.2 MB, 99% | [4] |
| EASE vs popularity (10k, measured) | Recall@20 0.394 vs 0.160; NDCG@100 0.446 vs 0.198 | [4] |
| iALS factors | 20k × 128 fp16 5.1 MB; 20k × 512 fp16 20 MB | [4] |
| Text vectors, 30k × 384 | fp32 46 MB; int8 11.5 MB; binary 1.4 MB | [6][8] |
| Quantization quality | int8 kept 99.0% of top-10 neighbours; binary 58.9%, 97.7% with rescoring | [8] |
| Query encoders (ONNX int8) | MiniLM 23 MB; arctic-xs 23 MB; bge-small 34 MB; EmbeddingGemma q4f16 175 MB; Qwen3-0.6B 568–614 MB | [6][8] |
| Catalogue Parquet, 30k rows | 0.75 MB minimal; 3–6 MB with facets; +6 MB with descriptions | [8] |
| Catalogue sizing | IMDb ≥ 2,400 votes ≈ 30k films; ≥ 750 ≈ 60k | [6] |
| Wikidata film coverage | 274,442 IMDb IDs; ~243k TMDB IDs; 232,140 Letterboxd; 71,697 RT; 17,668 Metacritic; 25,349 RT score statements | [5][8] |
| Wikipedia coverage | 144,245 films with TMDB ID + IMDb ID + English article | [6] |
| Vibe-profile cost, 30k films, batch | GPT-5 nano $3.23; Haiku 4.5 $48.75; Sonnet 5.5 $126.75 | [6] |
| Embedding cost, 30k × 400 tokens | about $0.24 (text-embedding-3-small) | [6] |
| TMDB API | about 40 requests/s; 6-month cache cap | [5][7] |
| Free tiers | Movie of the Night 1,000 req/month; Watchmode 2,500 credits/month; OMDb 1,000/day; MDBList 1,000/day; Cloudflare Worker 100,000 req/day | [5][7][8] |
| IMDb title.ratings | 1,715,455 rows, 8.7 MB gz, daily | [5] |
| Hit-rate CI (Wilson, HR = 0.20) | 0.11–0.33 at 50 events; 0.15–0.26 at 200 | [4] |
| Spearman CI (ρ = 0.5) | 0.15–0.74 at n = 30; 0.33–0.64 at n = 100; 0.40–0.58 at n = 300 | [4] |
| Rating noise floor | Test-retest RMSE 0.557–0.816 | [4] |
| LLM grounding | Hallucinated items 0.6–2.7% on MovieLens vs 11.6–61% on other catalogues; GPT-4o retrieved 80.76% of ML-1M items (memorisation) | [4][6][8] |
| TMDB poster CDN | w342 ≈ 64 KB, w500 ≈ 104 KB (JPEG); cache max-age ≈ 369 days | [7] |
| Browser storage | Safari deletes script-written storage after 7 days idle; opaque cross-origin responses count ≈ 7 MB each in Chrome | [7][8] |

## Open questions

1. TMDB: send a written request covering the three uses listed in the licensing section and record the answer in the repo. **This needs the user.**
2. GroupLens: does a public non-commercial app shipping ml-32m-derived tables count as "research purposes"? **This needs the user.**
3. Are embeddings or LLM summaries of CC BY-SA text "adapted material"? This needs legal advice; no report found an authoritative answer.
4. MDBList terms (caching, redistribution, upstream rights) and OMDb's source rights for RT and IMDb values: unverified. Fanart.tv terms and the Letterboxd beta page could not be fetched and need a human to read them [5][7].
5. Trakt after 2026-10-22: whether the VIP gate is lifted, and what the per-user app caps are [5].
6. The IMDb-vote-based catalogue selection: may the ID list be published, or must it be rebuilt from open counts at build time [6]?
7. What share of the target catalogue has a Wikipedia Plot section, and what share of titles have a TMDB poster? Not measured; measure during the first build [6][7].
8. Feeding explicit ratings into EASE/iALS: binarise at the personal median, centre, or weight. To be settled on the personal benchmark [4].
9. Is a remote MCP connector needed in v1, or do the in-app assistant and a local MCP suffice [8]?
10. EmbeddingGemma's licence conflicts between its Hub metadata and its launch blog. This only matters if a larger model is considered [6].
11. The chart library for the "for scientists" page was not chosen by any report. The inventory found no in-house charting package [3].
12. The example ratings file from the addendum [1] has an `average_rating` column. Its columns match the MovieLens account export format [5], so it may be MovieLens-derived data. No report assessed whether that file can go in a public repository. The user should also weigh re-identification risk from publishing a personal rating history [4]. **This needs the user.**
13. Name: confirm `cinepick` (or the runner-up) after GitHub, domain and trademark checks [9].

## REFERENCES

1. [User request and addendum (2026-09-30)](request.md)
2. [Preliminary report: Movie recommendation systems (2026-09-30)](../../../_tmp/movie_recommender_systems_report.md)
3. [In-house inventory (2026-09-30)](inhouse-inventory.md)
4. [Recommender methods, libraries and evaluation (2026-09-30)](recsys-methods-libraries-evaluation.md)
5. [Streaming availability and ratings APIs (2026-09-30)](streaming-availability-and-ratings-apis.md)
6. [Semantic movie data and filter features (2026-09-30)](semantic-movie-data-and-filter-features.md)
7. [Movie posters and media sources (2026-09-30)](movie-posters-and-media-sources.md)
8. [Browser-first feasibility, licensing, agents, prior art (2026-09-30)](browser-first-feasibility-licensing-agents-prior-art.md)
9. [Brand name report (2026-09-30), Recommendation section](brand-name-report.md)
10. [TMDB. API Terms of Use (last updated 2023-10-20)](https://www.themoviedb.org/api-terms-of-use)
11. [TMDB Talk. Clarification needed: training an AI/ML system (staff reply 2026-07-21)](https://www.themoviedb.org/talk/6a5e284be6125cf4396873a6)
12. [GroupLens. MovieLens 32M README, usage licence (generated 2023-10-13)](https://files.grouplens.org/datasets/movielens/ml-32m-README.html)
13. [GroupLens. MovieLens 25M README, usage licence](https://files.grouplens.org/datasets/movielens/ml-25m-README.html)
14. [IMDb. Non-commercial datasets](https://developer.imdb.com/non-commercial-datasets/)
15. [IMDb Help. Can I use IMDb data in my software?](https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX)
16. [Wikidata. Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)
17. [Wikipedia. Reusing Wikipedia content](https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content)
18. [Letterboxd. API beta access page (wording via search excerpts; page returned 403)](https://letterboxd.com/api-beta/)
19. [Trakt Forums. Failure to register an API](https://forums.trakt.tv/t/failure-to-register-an-api/116157)
