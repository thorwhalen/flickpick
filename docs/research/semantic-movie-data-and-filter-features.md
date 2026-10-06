# Semantic movie data and filterable features for the catalogue and semantic search

Scope: data that describes movies semantically (storyline, themes, mood, tone) for embedding and semantic-query filtering, plus the filterable feature data (age rating, genre, runtime, language, country, decade, cast, awards, content descriptors), for a ~30k-movie catalogue in a browser-first, AI-enabled movie recommender. Date of research: 2026-09-30. It extends the preliminary report [1] (LensKit/Surprise/RecBole, ranking metrics, MovieLens 25M, consumer services) and does not repeat it. Streaming availability, posters, population ratings and the full ID crosswalk are covered by other reports.

## Summary and recommendation

1. TMDB is the best structured free source (overview, tagline, keywords, per-country certifications, credits), but its API terms prohibit using TMDB content "in connection with, including for training, a machine learning (ML) or artificial intelligence (AI) based Application", bulk downloads, derivatives and caching beyond 6 months, and require a separate agreement for commercial use [2]. An AI-enabled open-source app should therefore not ship a TMDB-derived corpus; TMDB should be an optional, runtime, bring-your-own-key enrichment, and the project should ask TMDB for written clarification (a staff forum reply of 2026-07-21 says request-time similarity for a portfolio project is not what the clause targets, but a forum post is not a licence) [3].
2. The shippable "open core" is built from openly licensed text and facts: Wikidata (CC0) for IDs and facts, Wikipedia film plot sections (CC BY-SA 4.0; 400-700 words per the film style guide) for storyline, and an LLM-generated structured "vibe profile" per film. Published as a separate CC BY-SA data package, not mixed into the code licence.
3. No Hugging Face or Kaggle dataset is fit to depend on: the movie-embedding datasets found are small, stale or of unstated vintage (one is built on TMDB data collected up to 2017), trained for the wrong objective, or carry licences that contradict their upstream terms (section 2). Compute our own; it costs cents.
4. Generating a vibe profile for 30k films costs an estimated $3 to $127 with a Batch API (GPT-5 nano up to Claude Sonnet 5.5) at 1,500 input and 350 output tokens per film (arithmetic in section 3). Use a cheap model, fixed vocabulary (AgenticTagger-style) and a human-checked sample; LLM knowledge degrades on obscure titles, so feed it the plot text.
5. In the browser, use a 384-d model with an MIT/Apache licence: bge-small-en-v1.5 (int8 34 MB) or snowflake-arctic-embed-xs (int8 23 MB); ship 30k vectors as int8 (11.5 MB) or binary (1.4 MB) with rescoring, and brute-force the dot product instead of building an ANN index. EmbeddingGemma is stronger on MTEB (69.67 English v2) but is under Gemma terms and its q4 files are 175-197 MB.
6. Queries like "slow-burn melancholic sci-fi, nothing gory" cannot be answered by one embedding: bi-encoders handle negation worse than chance on NevIR. Parse the query into a positive semantic part (embedded) and exclusions/constraints (structured fields: content flags, certification, runtime), and use MovieLens Tag Genome tags offline as the evaluation proxy for "mood" retrieval.
7. There is no free, openly licensed source of content descriptors (violence, nudity, language): IMDb Parents Guide, Common Sense Media and Kids-in-Mind are paid, partner-only or unlicensed. Certifications come from TMDB; content flags must be LLM-inferred and labelled as inferred.

## 1. Semantic text sources per movie

Verdict vocabulary for data sources: use / do-not-use, with the condition in the cell. "Ship" means the project distributes derived data in its public repository or static assets.

| Source | Size and coverage | Licence / terms | How to obtain | Verdict |
|---|---|---|---|---|
| TMDB overview, tagline, keywords | One overview and tagline per title, keywords via a separate endpoint [4, 5]; per-title coverage not measurable without a key | API terms (revision of 2023-10-20): free non-commercial, no ML/AI-application use, no bulk/derivatives, cache at most 6 months, logo and notice required [2, 6] | API key; about 40 requests per second, stated as approximate and changeable [7]; unauthenticated daily ID exports [8] | use at runtime with the user's own key; do-not-use for shipped data until cleared in writing |
| Wikipedia film plot sections | Style guide asks 400-700 words per feature film [9]; 144,245 Wikidata film items have a TMDB ID, an IMDb ID and an English Wikipedia article (my SPARQL count, 2026-09-30) [10]; share of those with a Plot section not measured | CC BY-SA 4.0 (dumps also GFDL); attribution and share-alike for adaptations [11, 12] | Dumps or REST API, joined through Wikidata sitelinks | use, as the storyline backbone; ship as a separate CC BY-SA package |
| CMU Movie Summary Corpus | 42,306 plot summaries from Wikipedia plus Freebase metadata (box office, genres, runtime, languages), 46 MB [13] | CC BY-SA [13] | Direct download | use for evaluation and history; too old to be the catalogue basis (published 2013) |
| Wikipedia Movie Plots (Kaggle) | 34,886 films, scraped from Wikipedia (search-result summary of the Kaggle page; snapshot date not stated on pages I could read) [14] | CC BY-SA 4.0, per the same summary | Kaggle download | do-not-use as a dependency (a stale copy of what fresh extraction gives); study for schema |
| MPST | 14,828 synopses with 71 tags [15]; Hugging Face card states CC BY 4.0 [16] | Synopses were collected from IMDb and Wikipedia [15], so upstream IMDb terms are not cleared by the card's licence (my inference) | Hugging Face or project page | use for offline evaluation of tag prediction only; do-not-use as shipped data |
| MovieLens Tag Genome | 25M release: 1,128 tags (counted from genome-tags.csv) [17]; dense movie-by-tag relevance from tags, ratings and reviews [18]. 2021 release: 1,084 tags, 9,734 movies, 10.5M scores, 1.8 GB [19]. The 2024 ml-32m release has no genome files [20] | Research use; no redistribution; no commercial use without permission [18] | grouplens.org download | use offline (evaluation proxy, labels for a tag predictor); do-not-use as shipped data |
| MovieLens user tags | About 2M tag applications in the 32M release [21] | Same licence | Same download | do-not-use (noisy free text; licence) |
| IMDb plot and keywords | Not in the free datasets, which contain akas, basics, crew, episode, principals, ratings and name.basics only [22]; scraping prohibited [23]; the licensed API is sold through AWS Data Exchange with a flat subscription the marketplace listing states as $400,000 per year [24] | Personal and non-commercial use only; no republishing into a database [25] | none legitimate for free | do-not-use |
| Rotten Tomatoes critic consensus | Only through Fandango's approved API; reported to require a paid licence from $60,000 per year (search-result summary of the official page; the page itself could not be fetched) [26] | Proposal review; no support for unofficial use [26] | Application | do-not-use |
| Letterboxd | API by request; per the official beta page (via search summary) not granted to data-analysis, visualization, recommendation, LLM or personal projects [27] | Closed | Email request | do-not-use |
| Netflix altgenres | Unofficial gists of numeric micro-genre codes (for example "Deep Sea Horror Movies") [28] | Scraped, unofficial; Netflix terms not verified | Gists | do-not-use as data; study as vocabulary for mood/style facets |
| Douban, Filmaffinity | No verified open API; Filmaffinity has unofficial scrapers only [29]; Douban API status not verified (a 2019 forum thread reports problems) [30] | Unverified | Scraping | do-not-use |
| OMDb plot field | Short or full plot per title; free key limited to 1,000 requests per day [31] | Homepage says content is CC BY-NC 4.0 [32]; the legal page allows personal non-commercial use only and forbids derivatives and indexing [33] | API key | do-not-use for anything shipped |

What the Tag Genome tags look like (from the 25M `genome-tags.csv`): mood and style tags such as atmospheric, melancholic, bleak, tense, intense, slow paced, fast paced, feel-good, heartwarming, quirky, cerebral, tear jerker, dark humor, visually stunning; content tags such as gore, gory, violence, gratuitous violence, sexualized violence. Some plausible query words are absent ("cozy", "slow burn" have no tag). This vocabulary is a good seed for the fixed vibe vocabulary of section 3, and its dense scores give a graded proxy relevance for offline tests of mood queries.

## 2. Precomputed embeddings and description datasets on Hugging Face and Kaggle

Searched the Hub on 2026-09-30 with terms movie embeddings, tmdb, movielens, movie plots, MPST, imdb movies and movie recommendation. Downloads are Hub counters at that date.

| Dataset | Content | Licence on card | Problems | Verdict |
|---|---|---|---|---|
| [ujwal-jibhkate/enriched-movie-dataset-with-multimodal-embeddings](https://huggingface.co/datasets/ujwal-jibhkate/enriched-movie-dataset-with-multimodal-embeddings) [34] | 44,000+ films, 512-d fused embedding (MiniLM text plus CLIP poster through an MLP trained with genre/director/actor triplet loss), TMDB IDs | cc-by-sa-4.0 | Built from Kaggle "The Movies Dataset", whose data was collected from the TMDB API up to July 2017 [35]; objective is genre/director/actor similarity, not mood; a Kaggle licence cannot override TMDB terms (my inference) | do-not-use; study the triplet-fusion idea |
| [krishnakamath/movielens-32m-movies-enriched](https://huggingface.co/datasets/krishnakamath/movielens-32m-movies-enriched) [36] | 87,555 MovieLens titles with 100-150-word plot summaries written by gpt-3.5-turbo | none stated | LLM recall rather than source text (hallucination risk on obscure titles); derived from MovieLens, which forbids redistribution [18] | do-not-use |
| [vishnupriyavr/wiki-movie-plots-with-summaries](https://huggingface.co/datasets/vishnupriyavr/wiki-movie-plots-with-summaries) and its "-faiss-embeddings" twin [37] | Wikipedia Movie Plots plus AI summaries; the twin adds embeddings | cc-by-sa-4.0 | Embedding twin has no card ("More Information needed"): model and dimension unknown | do-not-use |
| [cryptexcode/MPST](https://huggingface.co/datasets/cryptexcode/MPST) [16] | MPST synopses and tags | cc-by-4.0 | See section 1 | study |
| omeyb/movie-plots-nomic-embeddings, RobinMillford/movie-embeddings-rag-db [38] | 1K-10K tutorial-scale vectors (nomic v1.5 via Ollama; ChromaDB) | mit | Too small; tutorial artefacts | do-not-use |
| [alitourani/movielens-25m-thumb](https://huggingface.co/datasets/alitourani/movielens-25m-thumb) [39] | Visual features from 65,000+ MovieLens thumbnails | gpl-3.0 | Visual, not text; relevant only to the posters report | study |

Conclusion: nothing is worth depending on. The one architectural point worth taking is to embed text and keep vectors separable from the model: any dataset of vectors is tied to a model we do not control.

## 3. LLM-generated "vibe" profiles

Prior art (2023-2026). LLM-Rec prompts an LLM to enrich sparse item descriptions and reports that the augmented text improves recommendation quality even with simple downstream models [40]. Extended chain-of-thought feature generation reports a 12% NDCG@10 gain from more and more specific generated features [41]. AgenticTagger builds a hierarchical, low-cardinality vocabulary of descriptors with an architect LLM and annotator LLMs, because open-ended generation gives high-cardinality descriptors that perform poorly [42]. A survey covers the wider family [43]. These papers support the approach; none is a controlled test on a mood-query retrieval task, and I did not find a 2024-2026 paper doing exactly that.

Proposed profile schema (fixed vocabularies, so fields are filterable): mood (multi-label, seeded from Tag Genome tags), pacing (one of slow/measured/brisk/frantic), tone, themes (free short phrases, max 5), content flags (violence/gore, sex/nudity, language, substance use, distress themes, each none/mild/strong), audience notes, similar-to (only titles present in the catalogue), a 60-word "feel" paragraph for embedding, and `source` and `confidence` fields.

Cost estimate. Assumptions (estimates, not measurements): 1,500 input tokens per film (400 instructions and schema, ~600 plot text, ~500 review or keyword snippets) and 350 output tokens. Formula: cost = (1,500 x input price + 350 x output price) / 10^6 per film, times film count. Claude models from 4.7 up use a tokenizer that produces about 30% more tokens [44], so Sonnet 5.5 and Opus 5.5 token counts are multiplied by 1.3. Prices in USD per million tokens (input/output), read from the vendors' pricing pages on 2026-09-30; Batch API is 50% off where offered.

| Model | Price in/out | Per film | 10k | 30k | 60k | 30k with Batch |
|---|---|---|---|---|---|---|
| GPT-5 nano [45] | 0.05 / 0.40 | $0.00021 | $2.15 | $6.45 | $12.90 | $3.23 |
| GPT-5 mini [45] | 0.25 / 2.00 | $0.00108 | $10.75 | $32.25 | $64.50 | $16.13 |
| Gemini 3.5 Flash-Lite [46] | 0.30 / 2.50 | $0.00133 | $13.25 | $39.75 | $79.50 | $19.88 |
| DeepSeek flash, peak / off-peak [47] | 0.30 / 1.20 and 0.15 / 0.60 | $0.00087 / $0.00044 | $8.70 / $4.35 | $26.10 / $13.05 | $52.20 / $26.10 | no batch tier on the page; off-peak is the discount |
| Claude Haiku 4.5 [44] | 1 / 5 | $0.00325 | $32.50 | $97.50 | $195.00 | $48.75 |
| Claude Sonnet 5.5 [44] | 2 / 10 (x1.3 tokens) | $0.00845 | $84.50 | $253.50 | $507.00 | $126.75 |
| Claude Opus 5.5 [44] | 4 / 20 (x1.3 tokens) | $0.01690 | $169.00 | $507.00 | $1,014.00 | $253.50 |

Example arithmetic, Sonnet 5.5: (1,500 x 1.3 x 2 + 350 x 1.3 x 10) / 10^6 = (3,900 + 4,550) / 10^6 = $0.00845 per film; x 30,000 = $253.50; Batch halves it to $126.75. Self-hosted open-weights models cost GPU time rather than tokens; not estimated here. Embedding the resulting ~400-token texts with a hosted model is negligible: 30,000 x 400 = 12M tokens, so $0.24 with text-embedding-3-small at $0.02 per million [45]. A 30k catalogue is therefore cheap enough to regenerate in full when the schema changes; the real cost is review time.

Quality caveats. (a) Knowledge bias: LLM recall is much better for popular items than for the long tail [48, 49], so give the model the plot text and score `confidence` lower when only a title is available. (b) Hallucination: catalogue-faithfulness audits find hallucinated items at 0.6-2.7% on MovieLens and 12-61% on other catalogues, with confidence not tracking correctness [50]; constrain `similar-to` to catalogue IDs and validate. (c) Licence chain: feeding TMDB overviews to an LLM is arguably "use in connection with ... an AI based Application" under the TMDB terms [2]; feed Wikipedia plots. (d) Share-alike: whether an LLM summary or an embedding of CC BY-SA text is an "Adapted Material" under CC BY-SA is not settled in the sources I could read [11, 51]; publishing the profiles under CC BY-SA is the conservative choice. (e) Measure: hand-label 200 films across decades and check flags against Tag Genome and Parents-Guide-style expectations before trusting the fields.

## 4. Embedding models

Two constraints drive the choice. Documents are 60-400-word plots or vibe paragraphs; queries are short, mood-heavy and often negated. Sizes below are the ONNX files in the transformers.js-compatible repositories, measured through the Hub API on 2026-09-30 [52]. Transformers.js v4 (2026-02-09) rewrote the WebGPU runtime and reports about 4x faster BERT-family embedding [53]. MTEB values are the vendors' card values (different MTEB revisions, so compare within a column only).

| Model | Params, dim, max length | MTEB | ONNX size (fp32 / int8 / q4f16) | Query vs passage | Licence |
|---|---|---|---|---|---|
| all-MiniLM-L6-v2 [54] | 22.7M, 384, 256 word pieces (truncates) | About 56 average and 39.8-42.9 retrieval (secondary reports, revisions differ) [55] | 90 / 23 / 30 MB [52] | Symmetric, no prefix | Apache-2.0 |
| bge-small-en-v1.5 [56] | 33.4M, 384, 512 | 62.17 average, 51.68 retrieval | 133 / 34 / 36 MB | Query instruction "Represent this sentence for searching relevant passages:" | MIT |
| gte-small [57] | 33.4M, 384, 512 | 61.36 average, 49.46 retrieval | 133 / 34 / 36 MB | No prefix | MIT |
| snowflake-arctic-embed-xs [58] | 22M, 384, 512 | 50.15 retrieval | 90 / 23 / not listed | Query prefix as bge | Apache-2.0 |
| nomic-embed-text-v1.5 [59] | 0.1B (card), 768 (Matryoshka to 64), 8,192 | 62.28 at 768, 61.04 at 256, 59.34 at 128 | 547 / 137 / 111 MB | `search_query:` and `search_document:` prefixes required | Apache-2.0 |
| EmbeddingGemma-300m [60, 61] | 308M, 768 (MRL 512/256/128), 2,048 | 69.67 English v2 (Q8 69.49, Q4 69.31) | 1,235 / 309 / 175 MB (q4f16) | Prompts "task: search result \| query: ..." and "title: ... \| text: ..." | Hub metadata says Gemma terms, manual gating; the launch blog says Apache-2.0: conflict, read the licence before adopting |
| Qwen3-Embedding-0.6B (server or WebGPU only) [62] | 0.6B, up to 1,024 (MRL 32-1,024), 32K | 70.70 English v2 | q4f16 568 MB | "Instruct: {task}\nQuery:{query}" | Apache-2.0 |

Recommendation. Browser default: bge-small-en-v1.5 at int8 (34 MB one-time download, cached) or arctic-embed-xs (23 MB) if download size dominates; MiniLM is weaker at retrieval and truncates plots at 256 word pieces, which is why a 60-word "feel" paragraph (section 3) matters. If Matryoshka truncation is wanted, nomic-v1.5 loses about 1.2 MTEB points going from 768 to 256 dimensions. Server side (offline precompute and the qh service): any of the above, or a hosted model, chosen so the query embedder equals the document embedder; the index header must record model id, prefix template and quantization. Queries must be encoded with the model's query prefix and documents with the passage prefix; mixing them silently degrades retrieval.

Shipping vectors. 30,000 x 384: fp32 46 MB, int8 11.5 MB, binary 1.4 MB; 60,000 x 384: 92 / 23 / 2.9 MB (arithmetic: n x d x bytes). At 768 dimensions double these. In HF's quantization study on mxbai-embed-large-v1, int8 kept about 99% of retrieval performance with rescoring and binary about 96% with rescoring (92.5% without) [63]. At 30k vectors a brute-force int8 dot product is roughly 11.5M multiply-adds per query (estimate: milliseconds in a web worker), so no HNSW index is needed; binary search plus int8 rescoring only pays above roughly 100k vectors (judgment, in line with [64]). The in-house client-side vector search report reaches the same memory arithmetic and quantization-rescoring pipeline [64].

Query side. Negation and exclusion are a known bi-encoder weakness: on NevIR bi-encoders perform worse than random and cross-encoders only slightly above [65]; compositional queries ("British comedies but not romances") are better served by set-theoretic representations than by vectors [66]. Tip-of-the-tongue movie search is a maintained TREC task (movie domain in 2023, wider domains since), where participants have used dense retrieval followed by LLM reranking [67], and Reddit-Movie provides 634k natural recommendation requests usable as realistic test queries [68]. Design: an LLM (or a small parser) turns the user's text into {semantic_query, must, must_not} where must/must_not refer to facet fields; only semantic_query is embedded; must_not is applied as a filter over content flags and moods. Optionally rerank the top 50 with a cross-encoder or the in-app assistant. The in-house embedding-model matrix [69] covers cloud, self-hosted and browser models generally; it lists MiniLM at MTEB about 58.8, which disagrees with the ~56 in secondary sources above, so treat that cell as unverified.

## 5. Filterable features and where each comes from

| Feature | Best source | Licence | Verdict |
|---|---|---|---|
| Genre | IMDb title.basics (up to three genres) [22, 70]; TMDB genres [4]; MovieLens has 20 genre labels, including "(no genres listed)" for 7,080 of 87,585 titles (my count) [20] | IMDb: non-commercial, no republishing [25]; TMDB terms above | use TMDB at runtime; use Wikidata genre for shipped facts (CC0 [71]); do-not-use IMDb data in the shipped catalogue |
| Runtime, release date/decade, original language, spoken languages, production countries, collection/franchise | TMDB movie details (runtime, release_date, original_language, spoken_languages, production_countries, belongs_to_collection) [4]; IMDb runtimeMinutes and startYear (runtime present for 486,582 of 758,115 IMDb "movie" rows, my count 2026-09-30) [70]; Wikidata for shipped facts | As above | use Wikidata (shipped) plus TMDB (runtime, BYO key) |
| Cast and crew | TMDB credits; IMDb title.principals and title.crew [22]; Wikidata | As above | use Wikidata for the shipped top-billed subset; TMDB at runtime |
| Age rating (certification) | TMDB `/movie/{id}/release_dates`: per-country certification per release type [72], with a country-scoped list and severity `order` field to normalise across systems (MPAA, BBFC, FSK, ...) [73]; OMDb "Rated" is US-centric and non-commercial [33]; Wikidata P1657 (MPA rating) exists but only 6,249 of 349,601 film items carry it (my SPARQL count) [10, 74] | TMDB terms | use TMDB (runtime, BYO key); Wikidata as a partial fallback |
| Content descriptors (violence, sex, language, substances) | Common Sense Media API is partner-key only [75]; IMDb Parents Guide exists only as a paid add-on dataset [76]; Kids-in-Mind publishes reviews with 0-10 scores but I found no API or data licence [77]; BBFC has no official API (an unofficial scraper exists under AGPL-3.0) [78]; Does the Dog Die has a free non-commercial API tier and a $50-a-month commercial tier with per-screen attribution (search-result summary of its terms) [79] | Mixed | do-not-use as bulk data; DDD only as an opt-in user-key lookup for specific triggers; otherwise LLM-inferred flags labelled "inferred" |
| Awards | Wikidata P166 (award received, with year and "for work" qualifiers) [80]: 14,367 of 349,601 film items have one (my count) [10]; Oscars scrape on Kaggle (1927-2026, CC0 per the page summary, but a scrape of the official database) [81] | Wikidata CC0 [71] | use Wikidata; do-not-use the Kaggle scrape unless its provenance is cleared |
| Box office and budget | TMDB budget and revenue fields [4] (user-contributed, sparse; not verified); Box Office Mojo and The Numbers: scraping prohibited without consent [82] | TMDB terms; BOM consent | use TMDB at runtime only; do-not-use Box Office Mojo |
| Subtitle and dubbing availability | Per-title data belongs with streaming availability (other report); TMDB carries spoken_languages [4]; the OpenSubtitles free tier is download-limited (search summary: 5 per day anonymous, 20 with an account) [83] | Mixed | do-not-use as a catalogue field; treat as a streaming-availability sub-field |
| Popularity/vote-count prior | IMDb title.ratings (numVotes) [22]; TMDB popularity [8] | Non-commercial | use to choose the 30k, not to ship |

Sizing the catalogue: computed from IMDb title.basics and title.ratings downloaded on 2026-09-30 (758,115 rows of type "movie", 9,102 flagged adult), counting non-adult movies by vote threshold: at least 10,000 votes, 12,607 films; 5,000 votes, 19,124; 2,500 votes, 29,057; 2,000 votes, 33,286; 1,000 votes, 49,156; 500 votes, 70,787. A 30k catalogue is therefore roughly "IMDb votes of at least about 2,400", and 60k is roughly 750 votes. This is a selection rule computed from IMDb data; the resulting list of IDs is a derived fact set, but confirm that publishing the selection is acceptable, or reproduce it from Wikidata sitelink counts and TMDB vote counts at build time.

## 6. ID crosswalk (brief)

MovieLens `links.csv` maps movieId to imdbId and tmdbId; in ml-32m all 87,585 rows carry an imdbId and 87,461 (99.86%) a tmdbId (my count) [20]. TMDB `/movie/{id}/external_ids` returns imdb_id and wikidata_id (nullable) [84]. Wikidata holds TMDB movie ID (P4947; 243,071 film items have one) and IMDb ID (P345; 274,792 do) (my counts) [10, 85]. Practical rule: key the catalogue on IMDb tt-ID plus TMDB ID, carry the Wikidata QID as the open-data join key and MovieLens movieId only for evaluation. Reconcile mismatches (remakes, alternate cuts, TV movies, adult flag) with title-plus-year fuzzy matching and log unresolved rows; the dedicated crosswalk report should own this.

## 7. Recommended pipeline for a ~30k-movie catalogue

Terminology: content-based filtering, dense retrieval with a bi-encoder, asymmetric search (query and passage encoders or prefixes differ), metadata pre-filtering versus post-filtering, hybrid search (BM25 plus dense with reciprocal rank fusion), Matryoshka representation learning, scalar and binary quantization with rescoring, folksonomy (user tags) versus controlled vocabulary, certification (an age classification) versus content descriptors, crosswalk, provenance.

1. Select. Rank IMDb-ID/TMDB-ID pairs by votes and keep about 30k; join Wikidata QIDs (P345, P4947) and English sitelinks. Store `provenance` per field (source, licence, retrieved_at) so any source can be dropped or expired (TMDB: 6 months).
2. Open-core text. Extract Wikipedia Plot sections with the REST API or dumps; keep the revision id and author-list link for attribution. Where no plot exists, fall back to the Wikidata description and mark `confidence: low`.
3. Vibe profile. Run the section 3 schema with a cheap model in Batch mode over plot text; validate against the fixed vocabularies; hand-check 200 films.
4. Embed. Embed the "feel" paragraph and, separately, the plot with the chosen small model; write int8 (and optionally binary) vectors plus a header with model id, prefix template and dimension. Use in-house `ef` as the embedding-flow facade for the offline run [86].
5. Facets. Build inverted indexes for genre, decade, language, country, runtime bands, normalised certification, mood/pacing/content flags, franchise. The in-house `vd` facade (memory, sqlite_vec or duckdb backends) covers the server variant with metadata filtering [86].
6. Runtime enrichment (optional, BYO TMDB key): overview, keywords, release-date certifications, credits, fetched by the user's client and cached for at most 6 months; no TMDB content in shipped assets, logo and notice in the UI [2]. At 30,000 films and one details request with `append_to_response` (up to 20 appended endpoints [4]) per film, a full build is 30,000 requests, about 50 minutes at 10 requests per second (estimate, well below the stated ~40 per second [7]).
7. Refresh. Full rebuild quarterly, or when the schema or model changes; monthly delta for new releases (IMDb datasets are regenerated daily, as the file timestamps show [87]); Wikidata and Wikipedia deltas at each build.
8. Evaluate. Use Tag Genome scores as graded relevance for mood queries (offline, not shipped) and Reddit-Movie or TREC ToT movie queries for natural requests [67, 68]; report NDCG@10 per model and per quantization level.

Additions an expert would make: store text and vectors separately so a model change is a rebuild, not a migration; keep several vectors per film (plot, feel, keywords) and fuse scores; add BM25 for titles and names (hybrid with reciprocal rank fusion); derive a user taste vector from liked and disliked items (Rocchio-style) to connect the semantic layer to the ratings-based recommender of the preliminary report [1]; handle multilingual queries with a multilingual model (EmbeddingGemma or bge-m3 class) only if the catalogue text becomes multilingual; expose the query-parse step to the user so exclusions are visible and editable (see the in-house faceted-filter skill [86]). In-house building blocks for the Python side: `ef`, `vd`, `dol` (cache store), `equate` (fuzzy title reconciliation), `qh` and `py2mcp` for the service and agent surfaces, with the browser side on the zodal and acture stack [86].

## Open questions

1. Does TMDB grant written permission for an open-source, AI-enabled, non-commercial app to use its API at runtime with user-supplied keys, and would it permit a shipped derived index? The staff forum reply is informal [3]; the terms text is not [2]. Ask sales/support and record the answer in the repo.
2. Are LLM-generated profiles and embeddings of CC BY-SA text "Adapted Material"? If so, the data package must be CC BY-SA; if not, more freedom. Legal advice needed; not resolved by the sources read [51].
3. Can the IMDb-vote-based selection list be published, or must it be rebuilt from open counts at build time?
4. What fraction of the 30k has a Wikipedia Plot section? Not measured; determines how many profiles rest on low-confidence input.
5. Does an int8 384-d model retain enough mood discrimination versus the 768-d/EmbeddingGemma option on the Tag Genome proxy? The vendor MTEB numbers do not test mood.
6. EmbeddingGemma's licence: Hub metadata (Gemma terms, gated) conflicts with the launch blog (Apache-2.0) [60, 61]. Resolve before choosing it.
7. Verification limits: pages were read through a fetch tool that summarises them, so quoted clauses and prices should be checked verbatim against the official pages before they are relied on (notably the TMDB clause and the OpenAI price list [45]). Pages that returned errors (Letterboxd, Does the Dog Die terms, Fandango) are cited through search-result summaries and marked as such.
8. Data-handling note: while sizing the catalogue I downloaded IMDb title.basics and title.ratings into a scratch directory; a cleanup command was refused by the permission system, so that scratch copy still exists and must not be committed.

## REFERENCES

[1] Preliminary report, Movie Recommendation Systems: Benchmarks, Consumer Services, and Building a Custom Recommender (in-house, 2026-09-30): _tmp/movie_recommender_systems_report.md
[2] [TMDB API Terms of Use (last updated 2023-10-20)](https://www.themoviedb.org/api-terms-of-use)
[3] [TMDB Talk: "Clarification needed: training an AI/ML system" (staff reply dated 2026-07-21)](https://www.themoviedb.org/talk/6a5e284be6125cf4396873a6)
[4] [TMDB API reference: Movie Details](https://developer.themoviedb.org/reference/movie-details)
[5] [TMDB API reference: Movie Keywords](https://developer.themoviedb.org/reference/movie-keywords)
[6] [TMDB API FAQ](https://developer.themoviedb.org/docs/faq)
[7] [TMDB API: Rate Limiting](https://developer.themoviedb.org/docs/rate-limiting)
[8] [TMDB API: Daily ID Exports](https://developer.themoviedb.org/docs/daily-id-exports)
[9] [Wikipedia Manual of Style/Film (plot summaries 400-700 words)](https://en.wikipedia.org/wiki/Wikipedia:Manual_of_Style/Film)
[10] [Wikidata Query Service (author's SPARQL counts of film items, run 2026-09-30)](https://query.wikidata.org/)
[11] [Wikipedia: Reusing Wikipedia content](https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content)
[12] [Wikimedia Downloads: Legal](https://dumps.wikimedia.org/legal.html)
[13] [CMU Movie Summary Corpus (Bamman, O'Connor, Smith, ACL 2013)](https://www.cs.cmu.edu/~ark/personas/)
[14] [Kaggle: Wikipedia Movie Plots (jrobischon)](https://www.kaggle.com/datasets/jrobischon/wikipedia-movie-plots)
[15] [Kar et al., MPST: A Corpus of Movie Plot Synopses with Tags (LREC 2018)](https://arxiv.org/abs/1802.07858)
[16] [Hugging Face dataset card: cryptexcode/MPST](https://huggingface.co/datasets/cryptexcode/MPST)
[17] [MovieLens 25M archive (genome-tags.csv read by range request, 2026-09-30)](https://files.grouplens.org/datasets/movielens/ml-25m.zip)
[18] [MovieLens 25M README (usage licence, Tag Genome)](https://files.grouplens.org/datasets/movielens/ml-25m-README.html)
[19] [GroupLens: MovieLens Tag Genome Dataset 2021](https://grouplens.org/datasets/movielens/tag-genome-2021/)
[20] [MovieLens 32M archive (README, links.csv, movies.csv read by range request, 2026-09-30)](https://files.grouplens.org/datasets/movielens/ml-32m.zip)
[21] [GroupLens: MovieLens datasets](https://grouplens.org/datasets/movielens/)
[22] [IMDb Non-Commercial Datasets](https://data.imdb.com/non-commercial-datasets/)
[23] [IMDb Conditions of Use](https://www.imdb.com/conditions)
[24] [AWS Marketplace: IMDb and Box Office Mojo for Movies/TV/OTT (API)](https://aws.amazon.com/marketplace/pp/prodview-nzspap6vaousm)
[25] [IMDb Help: Can I use IMDb data in my software?](https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX)
[26] [Fandango: Rotten Tomatoes Developer Network (via search-result summary; page not fetchable)](https://developer.fandango.com/rotten_tomatoes)
[27] [Letterboxd API beta page (via search-result summary; page returned 403)](https://letterboxd.com/api-beta/)
[28] [GitHub gist: Netflix list of genres (unofficial)](https://gist.github.com/b7a1f4e1dabb5f1f408393ddd9b94278)
[29] [GitHub: xsga/filmaffinity-api (unofficial)](https://github.com/xsga/filmaffinity-api)
[30] [Douban group topic on movie API problems (2019, forum)](https://www.douban.com/group/topic/140584175/)
[31] [OMDb API: API key page (free tier 1,000 daily limit)](https://www.omdbapi.com/apikey.aspx)
[32] [OMDb API](https://www.omdbapi.com/)
[33] [OMDb API: Legal](https://www.omdbapi.com/legal.htm)
[34] [Hugging Face dataset card: ujwal-jibhkate/enriched-movie-dataset-with-multimodal-embeddings](https://huggingface.co/datasets/ujwal-jibhkate/enriched-movie-dataset-with-multimodal-embeddings)
[35] [Kaggle: The Movies Dataset (rounakbanik)](https://www.kaggle.com/datasets/rounakbanik/the-movies-dataset)
[36] [Hugging Face dataset card: krishnakamath/movielens-32m-movies-enriched](https://huggingface.co/datasets/krishnakamath/movielens-32m-movies-enriched)
[37] [Hugging Face dataset: vishnupriyavr/wiki-movie-plots-with-summaries](https://huggingface.co/datasets/vishnupriyavr/wiki-movie-plots-with-summaries)
[38] [Hugging Face Hub dataset search, "movie embeddings" (omeyb, RobinMillford entries)](https://huggingface.co/datasets/omeyb/movie-plots-nomic-embeddings)
[39] [Hugging Face dataset card: alitourani/movielens-25m-thumb](https://huggingface.co/datasets/alitourani/movielens-25m-thumb)
[40] [Lyu et al., LLM-Rec: Personalized Recommendation via Prompting Large Language Models (Findings of NAACL 2024)](https://arxiv.org/abs/2307.15780)
[41] [Inference Computation Scaling for Feature Augmentation in Recommendation Systems (2025)](https://arxiv.org/abs/2502.16040)
[42] [AgenticTagger: Structured Item Representation for Recommendation with LLM Agents (2026)](https://arxiv.org/abs/2602.05945)
[43] [Large Language Model Enhanced Recommender Systems: A Survey (2024/2025)](https://arxiv.org/abs/2412.13432)
[44] [Anthropic: Claude API pricing (read 2026-09-30)](https://platform.claude.com/docs/en/about-claude/pricing)
[45] [OpenAI API pricing (read 2026-09-30)](https://developers.openai.com/api/docs/pricing)
[46] [Google: Gemini API pricing (read 2026-09-30)](https://ai.google.dev/gemini-api/docs/pricing)
[47] [DeepSeek API: Models and pricing (read 2026-09-30)](https://api-docs.deepseek.com/quick_start/pricing)
[48] [Large Language Models as Recommender Systems: A Study of Popularity Bias (2024)](https://arxiv.org/abs/2406.01285)
[49] [Do LLMs Memorize Recommendation Datasets? (2025)](https://arxiv.org/abs/2505.10212)
[50] [Do LLM Recommenders Know When They're Hallucinating? Auditing Confidence Calibration in Catalog Faithfulness (2026)](https://arxiv.org/abs/2608.10008)
[51] [Creative Commons Attribution-ShareAlike 4.0 legal code, as reproduced on Wikipedia](https://en.wikipedia.org/wiki/Wikipedia:Text_of_the_Creative_Commons_Attribution-ShareAlike_4.0_International_License)
[52] [Hugging Face Hub API file trees of Xenova/all-MiniLM-L6-v2, Xenova/bge-small-en-v1.5, Snowflake/snowflake-arctic-embed-xs, nomic-ai/nomic-embed-text-v1.5, onnx-community/embeddinggemma-300m-ONNX, onnx-community/Qwen3-Embedding-0.6B-ONNX (queried 2026-09-30)](https://huggingface.co/api/models/Xenova/bge-small-en-v1.5/tree/main/onnx)
[53] [Hugging Face blog: Transformers.js v4 (2026-02-09)](https://huggingface.co/blog/transformersjs-v4)
[54] [Model card: sentence-transformers/all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
[55] [mixpeek: all-MiniLM-L6-v2 model page (secondary report of MTEB values)](https://mixpeek.com/model/sentence-transformers/all-MiniLM-L6-v2)
[56] [Model card: BAAI/bge-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5)
[57] [Model card: thenlper/gte-small](https://huggingface.co/thenlper/gte-small)
[58] [Model card: Snowflake/snowflake-arctic-embed-xs](https://huggingface.co/Snowflake/snowflake-arctic-embed-xs)
[59] [Model card: nomic-ai/nomic-embed-text-v1.5](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5)
[60] [Model card: google/embeddinggemma-300m](https://huggingface.co/google/embeddinggemma-300m)
[61] [Hugging Face blog: Introducing EmbeddingGemma](https://huggingface.co/blog/embeddinggemma)
[62] [Model card: Qwen/Qwen3-Embedding-0.6B](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B)
[63] [Hugging Face blog: Binary and Scalar Embedding Quantization for Significantly Faster and Cheaper Retrieval](https://huggingface.co/blog/embedding-quantization)
[64] In-house report: Client-Side AI Vector Search (2026-05-20): g/g_embeddings/docs/research/semantic_search/08 -- Client-Side AI Vector Search.md
[65] [Weller et al., NevIR: Negation in Neural Information Retrieval](https://arxiv.org/abs/2305.07614)
[66] [Answering Compositional Queries with Set-Theoretic Embeddings](https://arxiv.org/abs/2306.04133)
[67] [Overview of the TREC 2025 Tip-of-the-Tongue track](https://arxiv.org/abs/2601.20671)
[68] [He et al., Large Language Models as Zero-Shot Conversational Recommenders (CIKM 2023; Reddit-Movie)](https://arxiv.org/abs/2308.10053)
[69] In-house report: Embedding Model Architecture Research Paper (2026-05-20): g/g_embeddings/docs/research/semantic_search/09 -- Embedding Model Architecture Research Paper.md
[70] [IMDb title.basics.tsv.gz and title.ratings.tsv.gz (author's counts, files dated 2026-09-29/30)](https://datasets.imdbws.com/title.basics.tsv.gz)
[71] [Wikidata: Licensing (structured data under CC0)](https://www.wikidata.org/wiki/Wikidata:Licensing)
[72] [TMDB API reference: Movie Release Dates](https://developer.themoviedb.org/reference/movie-release-dates)
[73] [TMDB API reference: Certifications, Movie List](https://developer.themoviedb.org/reference/certification-movie-list)
[74] [Wikidata property P1657: MPA film rating](https://www.wikidata.org/wiki/Property:P1657)
[75] [Common Sense Media: API Overview](https://www.commonsensemedia.org/developers/api-overview)
[76] [IMDb data licensing page (API via AWS Data Exchange; parental guidance add-on)](https://data.imdb.com/)
[77] [Kids-In-Mind: About our methodology, ratings and reviews](https://kids-in-mind.com/about.htm)
[78] [GitHub: Fustra/bbfcapi (unofficial, AGPL-3.0)](https://github.com/Fustra/bbfcapi)
[79] [Does the Dog Die: API Terms of Service (via search-result summary; page returned 403)](https://www.doesthedogdie.com/api/terms)
[80] [Wikidata property P166: award received](https://www.wikidata.org/wiki/Property:P166)
[81] [Kaggle: The Oscar Award, 1927-2026](https://www.kaggle.com/datasets/unanimad/the-oscar-award/data)
[82] [Box Office Mojo Conditions of Use](https://www.boxofficemojo.com/article/ed997786628)
[83] [OpenSubtitles Help Center: About the API (limits via search-result summary)](https://opensubtitles.tawk.help/article/about-the-api)
[84] [TMDB API reference: Movie External IDs](https://developer.themoviedb.org/reference/movie-external-ids)
[85] [Wikidata property P4947: TMDB movie ID](https://www.wikidata.org/wiki/Property:P4947)
[86] In-house inventory for the movie-recommender project (2026-09-30): _agent_work/movie-rec/inhouse-inventory.md
[87] [IMDb datasets host, file Last-Modified headers (2026-09-29/30)](https://datasets.imdbws.com/title.principals.tsv.gz)
