# Recommender methods, libraries and evaluation for a browser-first movie recommender

Scope: extends the preliminary report (LensKit/Surprise/RecBole, RMSE vs ranking metrics, hybrid sketch, MovieLens 25M, consumer services) with the library landscape including browser runtimes, the algorithms that suit a single-user, precompute-offline / score-in-browser design, a personal evaluation protocol, the "for scientists" agreement analyses, standard terminology, and gaps. Versions, release dates and licences were read from the PyPI and npm registry APIs and from each repository's LICENSE (via GitHub's licence detection) on 2026-09-30 [1], [2], [3]. Sources older than 2024 are cited for foundational algorithms, protocols and psychometrics, and every reference carries its year; measurements labelled "measured" or "computed" were run for this report, and all sizes not so labelled are arithmetic estimates.

## Summary and recommendation

1. The core should be a **linear item-item model trained offline on MovieLens 32M and scored in the browser**: EASE (closed form, one matrix inverse) as the default, iALS item factors with a closed-form user fold-in as the second scorer, item-kNN as the explainable baseline. Well-tuned versions of these simple models match or beat most published neural models on standard benchmarks [4], [5], [6].
2. EASE needs no fold-in at all: a new user's score vector is their rating row times the item-item matrix B [7]. Dense B for 10k items is 400 MB, but top-k sparsification per item keeps accuracy close to dense (SANSA reports 50 to 1,000 times sparser models on par with EASE [8]); our own probe on MovieLens 32M (Section 3) puts a 10k-item, top-100 artifact at 3.3 MB (float16 weights, zlib) while keeping 98% of dense NDCG@100.
3. In the browser, no recommender library is worth depending on; the math is a sparse vector-matrix product and a small linear solve. Depend on typed arrays plus a small linear-algebra helper (ml-matrix) for fold-in, onnxruntime-web or transformers.js only if a text encoder must run client-side, and brute-force cosine over ~20k embeddings instead of an ANN index (an estimated few milliseconds; ANN libraries in wasm are either stale or pre-1.0).
4. In Python, depend on RecTools or LensKit for training and evaluation (both active in 2026, permissive licences) and on implicit for iALS; implement EASE directly (about five lines of NumPy).
5. LLMs should not rank the catalogue. Zero-shot LLM rankers lag trained collaborative filtering when interaction data exist [9], [10], are biased by popularity and prompt position [10], [11], and have memorised MovieLens, which inflates benchmark results [12]. Use them for query parsing, constraint extraction, reranking a short CF-generated list, and explanation.
6. Personal evaluation must use full-catalogue ranking (never sampled negatives [13]), a rolling temporal protocol, and confidence intervals: with 50 test events a hit rate of 0.20 has a 95% interval of about 0.11 to 0.33, so only large differences between methods are detectable for one person.
7. Licensing is a design constraint: MovieLens forbids commercial use without permission and requires that redistributed transformations carry the same conditions [14]. A precomputed B matrix served to browsers is such a transformation, so the data artifact must be licensed separately from the (open-source) code. Avoid the Netflix Prize data.

## 1. Libraries

### 1.1 Python (training, offline evaluation)

| Library | Latest release (date) | Licence | What it adds beyond LensKit/Surprise/RecBole | Verdict |
|---|---|---|---|---|
| implicit [15] | 0.7.3 (2026-05-08) | MIT | Fast iALS, BPR, item-kNN on CPU/GPU; `recalculate_user=True` folds in a new user's items at query time [16] | depend (iALS training) |
| RecTools [17] | 0.19.0 (2026-06-13) | Apache-2.0 | One API over EASE, PureSVD, iALS/LightFM wrappers, DSSM two-tower, SASRec/BERT4Rec/eSASRec [18], HSTU; warm/cold inference flags; strong transformer benchmarks | depend (evaluation, baselines) |
| LensKit [19] | 2026.4.0 (2026-09-30) | MIT | Pipeline API; `RecQuery.history_items` scores users absent from training [20] | depend (evaluation, teaching) |
| Cornac [21] | 3.0.1 (2026-09-14) | Apache-2.0 | Multimodal models using item text and images; comparative experiment runner | study |
| RePlay [22] | 0.22.0 (2026-08-31) | Apache-2.0 | Full pipeline incl. splitters, two-stage ensembles, optional PySpark | study |
| Elliot [23] | no PyPI release; last GitHub release v0.3.1 (2021-07), commits in 2026-09 | Apache-2.0 | Config-driven experiments with beyond-accuracy, bias and fairness metrics | study |
| Microsoft Recommenders [24] | 1.2.1 (2024-12-24) | MIT | Notebooks and reference implementations for many algorithms; no release for 21 months although the repo is active | study |
| SANSA [25] | 1.1.0 (2024-04-15) | Apache-2.0 | Sparse approximate EASE with prescribed density; needs SuiteSparse | study (only if the catalogue grows past ~30k items) |
| LightFM [26] | 1.17 (2023-03-20) | Apache-2.0 in the repo LICENSE; PyPI metadata says MIT (discrepancy) | Hybrid MF with item features (cold-start items) [27] | avoid (stale; use RecTools' wrapper if needed) |
| TorchRec [28] | 1.9.0 (2026-09-11) | BSD-3-Clause | Sharded embedding tables for industrial scale | avoid (wrong scale) |
| RecBole [29] | 1.2.1 (2025-02-24) | MIT | Covered in the preliminary report; no release in 19 months | study |
| scikit-learn only [30] | 1.9.1 (2026-09-10) | BSD-3-Clause | `NearestNeighbors` (item-kNN), `TruncatedSVD` (PureSVD), `HistGradientBoosting*` (Section 5) | depend (analyses) |

### 1.2 JavaScript / TypeScript / browser

| Library | Latest release (date) | Licence | Role here | Verdict |
|---|---|---|---|---|
| npm "recommender" packages: @fizm/nano-recommender, collaborative-filter, recommender, raccoon [31] | 2026-06, 2020-07, 2017-05, 2017-03 | MIT | Toy user-based CF; 69 to 397 downloads/month; raccoon needs Redis | avoid |
| onnxruntime-web [32] | 1.30.0 (2026-09-14) | MIT | Runs any ONNX model (text encoder, two-tower user tower) on wasm or WebGPU; WebGPU EP documented [33] | depend (only if a model runs client-side) |
| Transformers.js (@huggingface/transformers) [34] | 4.3.0 (2026-09-16) | Apache-2.0 | Sentence-embedding pipelines in the browser; v4 (2026-02-09) added a C++ WebGPU runtime and reports ~4x faster BERT-style embeddings [35] | depend (query embedding) |
| TensorFlow.js [36] | 4.22.0 (2024-10-21) | Apache-2.0 | No npm release in ~23 months; Google positions LiteRT.js (2026-07) for model inference [37] | avoid |
| ml-matrix [38] | 6.15.0 (2026-08-05) | MIT | Cholesky/LU solve for the d x d iALS fold-in | depend |
| voy-search [39] | 0.6.3 (2023-09-20) | MIT or Apache-2.0 | Rust/wasm k-d tree; index must be rebuilt on update | avoid (stale) |
| hnswlib-wasm [40] | 0.8.2 (2023-07-08) | Apache-2.0 | HNSW in wasm | avoid (stale) |
| hnswlib-node [41] | 3.0.0 (2024-03-11) | Apache-2.0 | Native Node addon, not a browser library | avoid (browser) |
| usearch (npm) [42] | 2.26.2 (2026-08-31) | Apache-2.0 | Active; the npm package is a native Node addon, and the repo's `wasm/` README is an empty stub, so browser use is unverified | study |
| sqlite-vec [43] | 0.1.9 (2026-03-31); 0.1.10 alphas to 2026-05 | MIT or Apache-2.0 | Runs in SQLite-wasm; self-described pre-v1 with breaking changes; exact KNN via `vec0` [44] | study |
| DuckDB-Wasm [45] | 1.33.1-dev57 (2026-06-22) | MIT | SQL plus brute-force `array_cosine_similarity`; the `vss` HNSW extension is not in the documented Wasm extension list and its index persistence is experimental [46], [47] | study (if the app already uses DuckDB for the scientist views) |
| PGlite + pgvector [48] | 0.5.8 / pglite-pgvector 0.0.9 (2026-08-26) | Apache-2.0 | Postgres in wasm; pgvector listed as supported extension [49] | avoid (heavy for this job) |
| Orama [50] | 3.1.18 (2025-12-19) | Apache-2.0 | In-memory full-text + vector + facet search in TS | study (filters + search UI) |
| WebLLM [51] | 0.2.85 (2026-09-08) | Apache-2.0 | In-browser LLM for the assistant surface, not for ranking | study |

WebGPU is supported by about 87% of browsers globally according to caniuse (2026-09); Firefox and desktop Safari coverage is partial, so every GPU path needs a wasm fallback [52].

Brute force is enough at this scale: 20k items x 384 dimensions is 7.7 million multiply-adds per query, which is an estimated few milliseconds in wasm or plain typed-array JavaScript. ANN indexes pay off only at hundreds of thousands to millions of items.

## 2. Methods and algorithms

| Method | Idea | Offline artifact | New-user scoring | Evidence and trade-offs | Verdict |
|---|---|---|---|---|---|
| Item-kNN [53] | Similarity between item columns (cosine, adjusted cosine) | Top-k neighbours per item | Sum of neighbour similarities over rated items | Transparent ("because you liked X"); competitive when tuned [4] | depend (baseline, explanations) |
| EASE [7] | Linear item-item autoencoder, zero diagonal, closed form | Item-item weight matrix B | s = x B | ML-20M Recall@20 0.391, NDCG@100 0.420 [5]; O(n^3) training; dense B | depend (default scorer) |
| SLIM [54] | Sparse non-negative item-item regression | Sparse W | s = x W | ML-20M Recall@20 0.370 [5]; slow to train; EASE drops the L1/non-negativity | study |
| RP3beta [55] | 3-step random walk on user-item graph, popularity-penalised by beta | Sparse item-item transition matrix | s = x W | Second-best on Yelp2018 in a graph-CF replication [6]; cheap; boosts long tail | depend (diversity-oriented second scorer) |
| iALS [56], [5] | Weighted matrix factorisation on implicit data | Item factors H (n x d) and Gram H^T H | Closed-form d x d solve | Well-tuned iALS: ML-20M Recall@20 0.395, NDCG@100 0.425, on par with Mult-VAE [5] | depend |
| LightGCN [57] | Linear graph convolution over user-item graph | Item embeddings | Needs user embedding or graph propagation | Gains over tuned classical baselines not robust [6] | avoid |
| SASRec / BERT4Rec [58], [59] | Transformer over the ordered history | Network weights (ONNX-exportable) | Forward pass | For "next item" sequences; BERT4Rec needed up to 30x more training than default to replicate [60]; movie ratings entered in bulk (imports) have weak sequence signal | study |
| Two-tower [61], [62] | Separate user and item encoders, dot product | Item embeddings; user tower | Run user tower (onnxruntime-web) | Built for huge catalogues and features; overkill for 20k items | study |
| Content / embedding kNN | Text embedding of plot, mood, tags; cosine | Item text embeddings | Mean of liked-item embeddings, or query text embedding | Only route for items unseen in MovieLens (post-2023 releases) and for "feel/mood" queries | depend |
| Hybrid reranker | Learn-to-rank over CF score, content similarity, population ratings, filters | Small feature model | Few features per candidate | With one user's few hundred labels, keep it low-dimensional (Section 5) | depend |
| LLM as ranker / agent [10], [63], [64] | Prompt with history and candidates; or LLM plans tool calls | None (API) | One LLM call per list | See below | wrap (constraints, explanations, rerank of short list) |
| Generative retrieval / semantic IDs [65] | Decode item "semantic ID" codes autoregressively | Trained seq2seq model | Decoding | 2026 reproducibility work: no SID design is universally best [66]; apparent generalisation often reduces to token-level memorisation [67] | avoid (research) |

**EASE, precisely.** Let X be the |U| x |I| user-item matrix (binary: 1 if the user rated the film at least 4 of 5, the usual protocol [68]). EASE solves min over B of ||X - XB||_F^2 + lambda ||B||_F^2 subject to diag(B) = 0 [7]. With the item Gram matrix G = X^T X and P = (G + lambda I)^-1, the solution is B_ij = -P_ij / P_jj for i != j and B_jj = 0. A user with row x gets scores s = x B, with already-rated items masked. Training cost is one n x n inverse; Netflix Prize (17,770 items) trained in under two minutes in the original paper [7]. In NumPy: `G = X.T @ X; G[d] += lam; P = inv(G); B = P / -diag(P); B[d] = 0`. The regulariser lambda is tuned on validation users (hundreds to low thousands on MovieLens; our probe used 500). EASE is suited to catalogues where an n x n dense matrix fits in the training machine's memory (10k items: 0.4 GB float32; 20k: 1.6 GB; 30k: 3.6 GB); beyond that SANSA replaces the inverse with a sparse approximate factorisation [8].

**iALS, precisely.** Hu, Koren and Volinsky minimise the sum over all (u, i) of c_ui (p_ui - w_u^T h_i)^2 + lambda (sum_u ||w_u||^2 + sum_i ||h_i||^2), with preference p_ui = 1 if r_ui > 0 else 0 and confidence c_ui = 1 + alpha r_ui [56]. Rendle et al. rewrite it as L(W, H) = sum over observed (u, i) of (w_u^T h_i - 1)^2 + alpha0 sum over all (u, i) of (w_u^T h_i)^2 + R(W, H), with frequency-scaled regularisation R = lambda ( sum_u (|I(u)| + alpha0 |I|)^nu ||w_u||^2 + sum_i (|U(i)| + alpha0 |U|)^nu ||h_i||^2 ) [5]. Holding item factors H fixed, the user solution (the fold-in) is w_u = (alpha0 H^T H + sum over i in I(u) of h_i h_i^T + lambda_u I)^-1 sum over i in I(u) of h_i, where lambda_u = lambda (|I(u)| + alpha0 |I|)^nu. H^T H is d x d and precomputed offline, so a browser needs H, H^T H, and one d x d Cholesky solve (d = 128: about 2 million flops). Quality depends strongly on d: on ML-20M their best run used d = 2048, d = 512 was needed to beat EASE, and d = 64 already beat previously published iALS numbers [5]. For a browser artifact this matters: 20k items at d = 512 in float16 is 20 MB, larger than a top-200 sparse EASE matrix of similar accuracy (Section 3).

**What the evidence says about LLMs versus classical CF.** Hou et al. find zero-shot LLM rankers promising but report that they struggle to perceive the order of the history and are biased by item popularity and candidate position in the prompt; the authors state that surpassing trained models is not the goal of zero-shot evaluation, and their ML-1M setup ranks 20 candidates per user, i.e. a sampled protocol [10]. Kang et al. find zero-shot LLMs lag traditional models that see interaction data on rating prediction, while fine-tuned LLMs match them with less data [9]. Sanner et al. find LLMs competitive with item-based CF only in the near cold-start case with language-based preferences [69]. Di Palma et al. show GPT and Llama models have memorised MovieLens-1M (GPT-4o retrieved 80.76% of items) and that recommendation performance tracks memorisation, which contaminates any MovieLens-based LLM benchmark [12]. Reproducibility studies report significant performance fluctuations in LLM-based recommenders [70] and, for LLMRec, drops of 51% to 72% traced to its LLM data-augmentation step [71], and a 2026 preprint derives that under leave-one-out NDCG@k of any reranker is bounded by the recall of the candidate generator, finding no reranking strategy that beats CF baselines under realistic retrieval (preprint, not peer reviewed) [72]. Surveys cover the space [73], [74], [75], [76]. Conclusion: CF generates candidates; an LLM may reorder or explain a short list and translate natural-language constraints, and should be evaluated with the same full-ranking protocol as everything else.

## 3. The single-user setting: precompute offline, score in the browser

MovieLens 32M: 32,000,204 ratings, 87,585 films, 200,948 users, 1995-01-09 to 2023-10-12, 0.5 to 5 stars in half-star steps, and a `links.csv` mapping to IMDb and TMDB ids [14]. In our count, 84,432 films have at least one rating, 23,350 have at least 20, 12,191 at least 100 and 6,226 at least 500; the 10k most-rated films carry 96.7% of all ratings and the 20k most-rated 98.9%; the median user has 73 ratings (measured). A 10k to 20k catalogue therefore covers almost all collaborative signal; the long tail beyond it needs content features.

Which methods give a downloadable item-side artifact and a one-step user computation:

| Method | Offline artifact | Browser computation for one user | Fold-in literature |
|---|---|---|---|
| EASE, SLIM, RP3beta, item-kNN | Sparse item-item matrix | s = x B (sparse vector times sparse matrix, cost about |I(u)| x k) | None needed: the model is a function of the user's row [7]; LensKit and RecTools expose the same by passing history at query time [20], [17] |
| iALS | Item factors H, Gram H^T H | One d x d solve (above) | Closed-form least-squares user step [56], [5]; `recalculate_user` in implicit [16] |
| PureSVD / SVD | Item factors V, singular values | Fold-in: u = x V Sigma^-1 | Folding-in from latent semantic indexing [77] and incremental SVD recommenders [78] |
| Two-tower / SASRec | Item embeddings + user network | Forward pass in onnxruntime-web | Model-specific |
| Content embeddings | Item text vectors | Mean of liked, minus disliked; or encode a text query | Also the only option for items absent from MovieLens (item cold start) [79] |

Artifact sizes (estimates from arithmetic unless marked measured; n = items, k = kept neighbours per item, d = factor dimension):

| Artifact | 10k items | 20k items | Notes |
|---|---|---|---|
| Dense EASE B, float32 | 400 MB | 1.6 GB | Not downloadable |
| Top-k sparse B, uint16 index + float16 weight (4 bytes per entry), k = 100 | 4.0 MB raw | 8.0 MB raw | uint16 indexes cover up to 65,536 items |
| Same, k = 200 | 8.0 MB raw | 16.0 MB raw | |
| Same, int8 weights (3 bytes per entry), k = 100 | 3.0 MB raw | 6.0 MB raw | Per-row scale factor |
| Measured on ML-32M, top-k sparse EASE, zlib level 9, float16 / int8 weights | k = 50: 1.7 / 1.3 MB; k = 100: 3.3 / 2.5 MB; k = 200: 6.7 / 5.0 MB | k = 100: 6.7 / 5.1 MB; k = 200: 13.5 / 10.2 MB | Float weights barely compress (about 17%); delta-encoding sorted indexes should do better (untested) |
| iALS item factors, d = 128, float16 | 2.6 MB | 5.1 MB | Plus 64 KB Gram matrix |
| iALS item factors, d = 128, int8 | 1.3 MB | 2.6 MB | |
| Text embeddings, 384-d, float16 / int8 / binary | 7.7 / 3.8 / 0.5 MB | 15.4 / 7.7 / 1.0 MB | Binary for coarse pre-filter only |

**Probe (measured, this study).** Setup: MovieLens 32M ratings of 4 or more as positives [68]; the 10k (then 20k) films with most positives; 10,000 random users with at least 5 positives held out, 80% of their positives folded in and 20% as targets (strong generalisation, random rather than temporal split, so absolute numbers are for comparing variants only); EASE with lambda = 500 (200 and 1,000 gave the same NDCG@100 to three decimals); each item row of B kept to its k largest-magnitude weights. Results below are Recall@20 / NDCG@100.

| Variant | 10k items | 20k items |
|---|---|---|
| Popularity | 0.160 / 0.198 | 0.162 / 0.201 |
| Dense EASE | 0.394 / 0.446 | 0.398 / 0.448 |
| Top-20 | 0.364 / 0.413 (93% of dense NDCG) | not run |
| Top-50 | 0.381 / 0.428 (96%) | not run |
| Top-100 | 0.388 / 0.436 (98%) | 0.391 / 0.439 (98%) |
| Top-200 | 0.391 / 0.442 (99%) | 0.395 / 0.443 (99%) |
| Top-500 | 0.393 / 0.445 (100%) | not run |
| Top-100 / top-200 with int8 weights | not run | 0.390 / 0.439; 0.395 / 0.443 |

The dense inverse took 16 s for 10k items and 131 s for 20k on a 10-core CPU. The magnitudes match published EASE results on ML-20M (Recall@20 0.391, NDCG@100 0.420 [5]). Conclusion: a top-100 to top-200 sparse EASE matrix with int8 weights, 2.5 to 10 MB compressed, keeps 98% to 99% of dense accuracy, which agrees with SANSA's finding that heavily sparsified models match EASE [8].

Two practical consequences. First, with a 10k to 20k catalogue the whole CF model is a single-digit-megabyte static file, which fits the static-hosting constraint. Second, explicit ratings need a decision the literature leaves open for this setting: EASE and iALS were designed and benchmarked on binarised data [68]. Options are to binarise the user's ratings at their personal median, to feed centred ratings (dislikes become negative inputs), or to weight by rating; which works better for one user is an empirical question for the personal benchmark (Section 4), not something the cited papers settle.

## 4. Evaluation for a personal benchmark

| Choice | Recommendation | Why |
|---|---|---|
| Split | Rolling-origin temporal evaluation over the user's history (expanding window: fold in everything before t, predict the next month or next m ratings, advance) | Splitting strategy changes model rankings [80]; random or leave-one-out splits leak future information [81] |
| Leave-last-out | Report as one fold only | A single hold-out point per user is noisy; for one user it is one test event |
| Population data timeline | Train the population model only on data before the user's test period, or accept and report the leak | Global-timeline leakage [81]; ML-32M ends 2023-10-12, so later releases are item cold start |
| Candidates | Full catalogue ranking, minus items not yet released at time t and minus already rated items | Sampled metrics are inconsistent with full metrics [13]; full ranking of 20k items is cheap in the browser |
| Metrics | Hit@10, NDCG@10, MRR for "did a film I rated highly appear near the top"; Spearman/Kendall between predicted score and actual rating on the test films; coverage and novelty | Ranking metrics as in the preliminary report; rank correlation for the "for scientists" view |
| Uncertainty | Bootstrap over test events; Wilson interval for hit rates; paired bootstrap or randomisation test for method differences | Randomisation and bootstrap tests behave well for IR metrics [82] |
| Sample size | Hit rate 0.20: 95% interval 0.11 to 0.33 at 50 events, 0.15 to 0.26 at 200 (Wilson, computed). Spearman 0.5: 0.15 to 0.74 at n = 30, 0.33 to 0.64 at n = 100, 0.40 to 0.58 at n = 300 (Bonett-Wright standard error, computed) [83] | A single user needs a few hundred test ratings to separate methods whose correlations differ by about 0.1 |
| Selection bias | Treat offline scores as "predicts what I chose to watch and rate", not "predicts what I would enjoy"; add a small randomly sampled set of films the user rates on request | Ratings are missing not at random [84], [85]; Sanner et al. collected ratings on random items for this reason [69] |
| Noise floor | Do not chase RMSE below the user's own test-retest noise | Re-rating the same films gave RMSE 0.557 to 0.816 between sessions [86]; the "magic barrier" [87] |
| Offline vs online | Log every recommendation shown with timestamp; later outcomes (watched, rating) give a prospective estimate | Offline and online rankings of algorithms can disagree [88], [89]; the validity of offline designs varies by dataset (2026 preprint) [90] |

## 5. The "for scientists" analyses

Population scores are not on one scale and are not all means. The Tomatometer is the percentage of positive critic reviews; the audience Popcornmeter is the percentage of users rating 3.5 stars or higher [91]; the Metascore is a weighted average of critic scores with undisclosed weights [92]; the IMDb rating is a weighted average with an undisclosed method [93]. Proportions and means should not be mixed in one linear model without transformation, and a proportion near 100% carries little rank information.

| Analysis | Established method | Implementation note | Verdict |
|---|---|---|---|
| Agreement with each source | Spearman rho and Kendall tau-b (half-star data has ties) with confidence intervals [83]; Pearson only on transformed scores | scipy.stats; report n per source | use |
| Normalisation of the user's ratings | Per-user mean-centring or z-scores [94]; percentiles (Criticker's approach, covered in the preliminary report) | Keep raw, z and percentile views side by side | use |
| Systematic offset | Bland-Altman plot of user minus source after mapping to a common 0 to 100 scale [95] | Shows "I rate critics' darlings lower", which correlation hides | use |
| Source structure | Correlation matrix / PCA across sources | See the 2015 figures below: a critic factor and an audience factor | use |
| Predicting the user's rating | Regularised linear and ordinal (cumulative-link) regression on population scores + features; gradient boosting only with nested cross-validation [96] | With a few hundred ratings, a GBM with many features overfits; report cross-validated Spearman and RMSE against a "user mean" and an "IMDb only" baseline | use |
| Critic vs audience evidence | Holbrook: popular appeal and expert judgement use partly different criteria but the data do not support a negative relation [97]; Plucker et al.: students agreed less with critics than with other lay raters, and heavy viewers agreed more with both [98] | Frame the user's position on the critic-audience axis as a finding, not a defect | use |

Reference numbers, computed here from the FiveThirtyEight film-ratings dataset (146 films with at least 30 Fandango reviews in 2015, CC BY 4.0 [99]): Spearman rho between Rotten Tomatoes critics and Metacritic 0.96, between Rotten Tomatoes audience and IMDb 0.92, and 0.69 to 0.78 across critic-audience pairs. The sample is small, old and selected on 2015 ticket sales, so treat it as illustrative; the app can recompute the same matrix on its own catalogue.

Rating-scale psychometrics: users rate fairly consistently across scales, but shift their ratings toward a displayed prediction, so the app should not show its predicted score while the user is rating [100]. The five-star scale was the best liked; finer scales take longer [101]. Coarse scales are faster but carry less preference information per rating [102]. In simulation on MovieLens 25M, losing even a small share of feedback quantity hurt more than reducing granularity [103]. Netflix reported 200% more ratings after moving from stars to thumbs (a company claim) [104]. Implication: accept half-stars on import (Letterboxd, IMDb exports), but offer a fast like/dislike/skip mode for elicitation.

## 6. Terminology

| Term | Meaning (use this name in code and docs) |
|---|---|
| explicit / implicit feedback | Ratings versus behavioural signals (watched, added) [56] |
| interaction (user-item) matrix, X | Rows users, columns items |
| item-item weight / similarity matrix, B or S | EASE/SLIM weights vs kNN similarities [7], [53] |
| Gram matrix, G = X^T X | Item co-occurrence counts |
| item factors / embeddings, H | Latent vectors per item |
| fold-in | Computing a new user's representation from fixed item parameters [77] |
| user / item cold start | Too little data about a user / item [105], [79] |
| preference elicitation, active learning | Choosing which films to ask a new user to rate [106], [105] |
| candidate generation (retrieval) and ranking (reranking) | Two-stage pipeline [61] |
| top-N recommendation | Ranking task, as opposed to rating prediction |
| strong vs weak generalisation | Test users unseen in training vs held-out items of training users [68] |
| temporal split, leave-one-out, rolling origin | Split protocols [80] |
| full vs sampled evaluation | Ranking against all items vs sampled negatives [13] |
| data leakage (global timeline) | Training on information from after the test point [81] |
| missing not at random (MNAR), selection bias | Observed ratings are not a random sample [84] |
| popularity bias, calibration, diversity (MMR) | Beyond-accuracy properties [11], [107], [108] |
| magic barrier, natural noise | Upper bound set by rating inconsistency [87], [86] |

## 7. What an expert would add

- Data licence as architecture: the code can be MIT/Apache, but any artifact derived from MovieLens inherits its non-commercial, same-conditions terms [14]. Netflix Prize ratings were shown to be re-identifiable by linking to public IMDb ratings, which ended Netflix's planned second contest [109]; the same applies to this app's users, so a personal rating history should stay on the client unless the user opts to upload it.
- Item cold start is structural: ML-32M stops in October 2023, so every later release has no CF signal. Plan a content-to-CF bridge (train a small regressor from text embeddings to item factors, in the spirit of DropoutNet [79]) and the MovieLens Tag Genome (1,084 tags x 9,734 films, 2021) as mood/feel features with the same licence caveat [110], [111].
- Calibration and diversity: rerank so the genre mix of recommendations matches the user's history (KL calibration [107]) and penalise near-duplicates (MMR [108]); LLM rankers add popularity bias [11].
- Elicitation for new users: choose initial films by popularity times entropy rather than at random [106], [105].
- Uncertainty per recommendation: split-conformal intervals around the predicted rating give calibrated "how sure" bands without distributional assumptions [112].
- Reproducibility hygiene: fixed seeds, versioned artifacts with a hash in the UI, and the same evaluation code in Python and TypeScript, since most published gains shrink under replication [4], [113].

## Open questions

- Catalogue cut-off: top 10k versus 20k films by MovieLens positive-rating count, and whether to add post-2023 releases via the content bridge only.
- Explicit ratings into EASE/iALS: binarise at the personal median, centre, or weight; to be settled on the personal benchmark.
- Whether the MovieLens terms allow the planned hosting of derived artifacts; GroupLens permission may be needed if any revenue is involved.
- Whether the in-browser text encoder is needed, or whether query embeddings can be computed by the backend (qh) at small cost.
- Whether `vss` works in DuckDB-Wasm today (not in the documented list; not tested here).
- LLM reranking: worth testing on the personal benchmark with full ranking and a fixed candidate list; the evidence so far does not justify it as a default.

## REFERENCES

1. [PyPI JSON API (package metadata, queried 2026-09-30)](https://docs.pypi.org/api/json/)
2. [npm registry API (package metadata and download counts, queried 2026-09-30)](https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md)
3. [GitHub REST API, repository licence detection](https://docs.github.com/en/rest/licenses/licenses)
4. [Ferrari Dacrema M, Cremonesi P, Jannach D. Are we really making much progress? A worrying analysis of recent neural recommendation approaches. RecSys 2019](https://doi.org/10.1145/3298689.3347058)
5. [Rendle S, Krichene W, Zhang L, Koren Y. Revisiting the performance of iALS on item recommendation benchmarks. RecSys 2022 (arXiv 2110.14037)](https://arxiv.org/abs/2110.14037)
6. [Anelli VW, Malitesta D, Pomo C, et al. Challenging the myth of graph collaborative filtering: a reasoned and reproducibility-driven analysis. RecSys 2023](https://arxiv.org/abs/2308.00404)
7. [Steck H. Embarrassingly shallow autoencoders for sparse data. WWW 2019](https://arxiv.org/abs/1905.03375)
8. [Spisak M, Bartyzal R, Hoskovec A, Peska L, Tuma M. Scalable approximate nonsymmetric autoencoder for collaborative filtering. RecSys 2023](https://doi.org/10.1145/3604915.3608827)
9. [Kang WC, Ni J, Mehta N, et al. Do LLMs understand user preferences? Evaluating LLMs on user rating prediction. arXiv 2305.06474, 2023](https://arxiv.org/abs/2305.06474)
10. [Hou Y, Zhang J, Lin Z, et al. Large language models are zero-shot rankers for recommender systems. ECIR 2024 (arXiv 2305.08845)](https://arxiv.org/abs/2305.08845)
11. [Lichtenberg JM, Buchholz A, Schwobel P. Large language models as recommender systems: a study of popularity bias. arXiv 2406.01285, 2024](https://arxiv.org/abs/2406.01285)
12. [Di Palma D, Merra FA, Sfilio M, et al. Do LLMs memorize recommendation datasets? A preliminary study on MovieLens-1M. SIGIR 2025](https://arxiv.org/abs/2505.10212)
13. [Krichene W, Rendle S. On sampled metrics for item recommendation. KDD 2020](https://doi.org/10.1145/3394486.3403226)
14. [GroupLens. MovieLens 32M README, including usage licence (generated 2023-10-13)](https://files.grouplens.org/datasets/movielens/ml-32m-README.html)
15. [benfred/implicit (GitHub)](https://github.com/benfred/implicit)
16. [implicit documentation: AlternatingLeastSquares (recommend, recalculate_user)](https://benfred.github.io/implicit/api/models/cpu/als.html)
17. [MTSWebServices/RecTools (GitHub)](https://github.com/MTSWebServices/RecTools)
18. [eSASRec: enhancing transformer-based recommendations in a modular fashion. RecSys 2025 (arXiv 2508.06450)](https://arxiv.org/abs/2508.06450)
19. [lenskit/lkpy (GitHub)](https://github.com/lenskit/lkpy)
20. [LensKit documentation: queries and RecQuery.history_items](https://lenskit.org/latest/guide/queries.html)
21. [PreferredAI/cornac (GitHub)](https://github.com/PreferredAI/cornac)
22. [sb-ai-lab/RePlay (GitHub)](https://github.com/sb-ai-lab/RePlay)
23. [sisinflab/elliot (GitHub)](https://github.com/sisinflab/elliot)
24. [recommenders-team/recommenders (GitHub)](https://github.com/recommenders-team/recommenders)
25. [glami/sansa (GitHub)](https://github.com/glami/sansa)
26. [lyst/lightfm LICENSE (GitHub)](https://github.com/lyst/lightfm/blob/master/LICENSE)
27. [Kula M. Metadata embeddings for user and item cold-start recommendations. arXiv 1507.08439, 2015](https://arxiv.org/abs/1507.08439)
28. [meta-pytorch/torchrec (GitHub)](https://github.com/meta-pytorch/torchrec)
29. [RUCAIBox/RecBole (GitHub)](https://github.com/RUCAIBox/RecBole)
30. [scikit-learn (PyPI)](https://pypi.org/project/scikit-learn/)
31. [npm search: recommender packages (e.g. @fizm/nano-recommender, collaborative-filter)](https://www.npmjs.com/search?q=keywords%3Arecommender)
32. [onnxruntime-web (npm)](https://www.npmjs.com/package/onnxruntime-web)
33. [ONNX Runtime documentation: using WebGPU in ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html)
34. [huggingface/transformers.js (GitHub)](https://github.com/huggingface/transformers.js)
35. [Hugging Face. Transformers.js v4: now available on npm (2026-02-09)](https://huggingface.co/blog/transformersjs-v4)
36. [tensorflow/tfjs releases (GitHub)](https://github.com/tensorflow/tfjs/releases)
37. [google-ai-edge/LiteRT, litert/js (GitHub); @litertjs/core on npm since 2025-08](https://github.com/google-ai-edge/LiteRT/tree/main/litert/js)
38. [mljs/matrix (ml-matrix, GitHub)](https://github.com/mljs/matrix)
39. [tantaraio/voy (GitHub)](https://github.com/tantaraio/voy)
40. [ShravanSunder/hnswlib-wasm (GitHub)](https://github.com/ShravanSunder/hnswlib-wasm)
41. [yoshoku/hnswlib-node (GitHub)](https://github.com/yoshoku/hnswlib-node)
42. [unum-cloud/USearch (GitHub; see wasm/ and javascript/)](https://github.com/unum-cloud/USearch)
43. [asg017/sqlite-vec (GitHub)](https://github.com/asg017/sqlite-vec)
44. [sqlite-vec documentation: KNN queries](https://alexgarcia.xyz/sqlite-vec/features/knn.html)
45. [duckdb/duckdb-wasm (GitHub)](https://github.com/duckdb/duckdb-wasm)
46. [DuckDB documentation: extensions in DuckDB-Wasm](https://duckdb.org/docs/current/clients/wasm/extensions.html)
47. [DuckDB documentation: vector similarity search (vss) extension](https://duckdb.org/docs/current/core_extensions/vss)
48. [electric-sql/pglite (GitHub)](https://github.com/electric-sql/pglite)
49. [PGlite documentation: extensions (pgvector)](https://pglite.dev/extensions/)
50. [oramasearch/orama (GitHub)](https://github.com/oramasearch/orama)
51. [mlc-ai/web-llm (GitHub)](https://github.com/mlc-ai/web-llm)
52. [Can I use: WebGPU (accessed 2026-09-30)](https://caniuse.com/webgpu)
53. [Sarwar B, Karypis G, Konstan J, Riedl J. Item-based collaborative filtering recommendation algorithms. WWW 2001](https://doi.org/10.1145/371920.372071)
54. [Ning X, Karypis G. SLIM: sparse linear methods for top-N recommender systems. ICDM 2011](https://doi.org/10.1109/ICDM.2011.134)
55. [Paudel B, Christoffel F, Newell C, Bernstein A. Updatable, accurate, diverse, and scalable recommendations for interactive applications (RP3beta). ACM TiiS 2016](https://doi.org/10.1145/2955101)
56. [Hu Y, Koren Y, Volinsky C. Collaborative filtering for implicit feedback datasets. ICDM 2008](https://doi.org/10.1109/ICDM.2008.22)
57. [He X, Deng K, Wang X, et al. LightGCN: simplifying and powering graph convolution network for recommendation. SIGIR 2020](https://arxiv.org/abs/2002.02126)
58. [Kang WC, McAuley J. Self-attentive sequential recommendation (SASRec). ICDM 2018](https://arxiv.org/abs/1808.09781)
59. [Sun F, Liu J, Wu J, et al. BERT4Rec: sequential recommendation with bidirectional encoder representations from transformer. CIKM 2019](https://arxiv.org/abs/1904.06690)
60. [Petrov A, Macdonald C. A systematic review and replicability study of BERT4Rec for sequential recommendation. RecSys 2022](https://arxiv.org/abs/2207.07483)
61. [Covington P, Adams J, Sargin E. Deep neural networks for YouTube recommendations. RecSys 2016](https://doi.org/10.1145/2959100.2959190)
62. [Yi X, Yang J, Hong L, et al. Sampling-bias-corrected neural modeling for large corpus item recommendations. RecSys 2019](https://doi.org/10.1145/3298689.3346996)
63. [Wang Y, Jiang Z, Chen Z, et al. RecMind: large language model powered agent for recommendation. Findings of NAACL 2024](https://aclanthology.org/2024.findings-naacl.271/)
64. [Geng S, Liu S, Fu Z, Ge Y, Zhang Y. Recommendation as language processing (RLP): a unified pretrain, personalized prompt and predict paradigm (P5). RecSys 2022](https://arxiv.org/abs/2203.13366)
65. [Rajput S, Mehta N, Singh A, et al. Recommender systems with generative retrieval (TIGER). NeurIPS 2023](https://arxiv.org/abs/2305.05065)
66. [What makes a good semantic ID for generative recommendation? A reproducibility study. arXiv 2609.24430, 2026 (preprint)](https://arxiv.org/abs/2609.24430)
67. [How well does generative recommendation generalize? arXiv 2603.19809, 2026 (preprint)](https://arxiv.org/abs/2603.19809)
68. [Liang D, Krishnan RG, Hoffman MD, Jebara T. Variational autoencoders for collaborative filtering. WWW 2018](https://doi.org/10.1145/3178876.3186150)
69. [Sanner S, Balog K, Radlinski F, Wedin B, Dixon L. Large language models are competitive near cold-start recommenders for language- and item-based preferences. RecSys 2023](https://arxiv.org/abs/2307.14225)
70. [Tahmasebi S, Nikzad N, Payberah AH, et al. Fact vs. fiction: are the reportedly 'magical' LLM-based recommenders reproducible? ECIR 2025](https://link.springer.com/chapter/10.1007/978-3-031-88717-8_7)
71. [How powerful are LLMs to support multimodal recommendation? A reproducibility study of LLMRec. RecSys 2025](https://dl.acm.org/doi/10.1145/3705328.3748154)
72. [Wang Z. The recall ceiling of LLM recommendation reranking. arXiv 2609.27953, 2026 (preprint)](https://arxiv.org/abs/2609.27953)
73. [Wu L, Zheng Z, Qiu Z, et al. A survey on large language models for recommendation. arXiv 2305.19860 (2023; journal version 2024)](https://arxiv.org/abs/2305.19860)
74. [Lin J, Dai X, Xi Y, et al. How can recommender systems benefit from large language models: a survey. arXiv 2306.05817 (2023; ACM TOIS)](https://arxiv.org/abs/2306.05817)
75. [Zhao Z, Fan W, Li J, et al. Recommender systems in the era of large language models (LLMs). arXiv 2307.02046 (2023; IEEE TKDE 2024)](https://arxiv.org/abs/2307.02046)
76. [A survey on LLM-powered agents for recommender systems. arXiv 2502.10050, 2025](https://arxiv.org/abs/2502.10050)
77. [Berry MW, Dumais ST, O'Brien GW. Using linear algebra for intelligent information retrieval (folding-in). SIAM Review 1995](https://doi.org/10.1137/1037127)
78. [Sarwar B, Karypis G, Konstan J, Riedl J. Incremental singular value decomposition algorithms for highly scalable recommender systems. 2002](https://www.semanticscholar.org/paper/Incremental-Singular-Value-Decomposition-Algorithms-Sarwar-Karypis/02ff37cd0059cf1af1ecfa62c32304c05ab3bf96)
79. [Volkovs M, Yu G, Poutanen T. DropoutNet: addressing cold start in recommender systems. NeurIPS 2017](https://papers.nips.cc/paper_files/paper/2017/hash/dbd22ba3bd0df8f385bdac3e9f8be207-Abstract.html)
80. [Meng Z, McCreadie R, Macdonald C, Ounis I. Exploring data splitting strategies for the evaluation of recommendation models. RecSys 2020](https://arxiv.org/abs/2007.13237)
81. [Sun A. Take a fresh look at recommender systems from an evaluation standpoint. SIGIR 2023](https://arxiv.org/abs/2210.04149)
82. [Smucker MD, Allan J, Carterette B. A comparison of statistical significance tests for information retrieval evaluation. CIKM 2007](https://doi.org/10.1145/1321440.1321528)
83. [Bonett DG, Wright TA. Sample size requirements for estimating Pearson, Kendall and Spearman correlations. Psychometrika 2000](https://doi.org/10.1007/BF02294183)
84. [Marlin BM, Zemel RS. Collaborative prediction and ranking with non-random missing data. RecSys 2009](https://doi.org/10.1145/1639714.1639717)
85. [Steck H. Training and testing of recommender systems on data missing not at random. KDD 2010](https://doi.org/10.1145/1835804.1835895)
86. [Amatriain X, Pujol JM, Oliver N. I like it... I like it not: evaluating user ratings noise in recommender systems. UMAP 2009](https://link.springer.com/chapter/10.1007/978-3-642-02247-0_24)
87. [Herlocker JL, Konstan JA, Terveen LG, Riedl JT. Evaluating collaborative filtering recommender systems. ACM TOIS 2004](https://doi.org/10.1145/963770.963772)
88. [Beel J, Langer S. A comparison of offline evaluations, online evaluations, and user studies in the context of research-paper recommender systems. TPDL 2015](https://link.springer.com/chapter/10.1007/978-3-319-24592-8_12)
89. [Garcin F, Faltings B, Donatsch O, et al. Offline and online evaluation of news recommender systems at swissinfo.ch. RecSys 2014](https://doi.org/10.1145/2645710.2645745)
90. [On the convergent validity of offline evaluation designs for recommender systems. arXiv 2607.25097, 2026 (preprint)](https://arxiv.org/abs/2607.25097)
91. [Rotten Tomatoes. About: Tomatometer and Popcornmeter](https://www.rottentomatoes.com/about)
92. [Metacritic. About us: how the Metascore is computed](https://www.metacritic.com/about-us/)
93. [IMDb Help. Ratings FAQ (weighted average)](https://help.imdb.com/article/imdb/track-movies-tv/ratings-faq/G67Y87TFYYP6TWAV)
94. [Herlocker JL, Konstan JA, Borchers A, Riedl J. An algorithmic framework for performing collaborative filtering. SIGIR 1999](https://doi.org/10.1145/312624.312682)
95. [Bland JM, Altman DG. Statistical methods for assessing agreement between two methods of clinical measurement. Lancet 1986](https://doi.org/10.1016/S0140-6736(86)90837-8)
96. [Cawley GC, Talbot NLC. On over-fitting in model selection and subsequent selection bias in performance evaluation. JMLR 2010](https://jmlr.org/papers/v11/cawley10a.html)
97. [Holbrook MB. Popular appeal versus expert judgments of motion pictures. Journal of Consumer Research 1999](https://academic.oup.com/jcr/article-abstract/26/2/144/1784927)
98. [Plucker JA, Kaufman JC, Temple JS, Qian M. Do experts and novices evaluate movies the same way? Psychology & Marketing 2009](https://doi.org/10.1002/mar.20283)
99. [Hickey W. Be suspicious of online movie ratings, especially Fandango's. FiveThirtyEight 2015; data at fivethirtyeight/data/fandango (CC BY 4.0)](https://github.com/fivethirtyeight/data/tree/master/fandango)
100. [Cosley D, Lam SK, Albert I, Konstan JA, Riedl J. Is seeing believing? How recommender interfaces affect users' opinions. CHI 2003](https://experts.umn.edu/en/publications/is-seeing-believing-how-recommender-interfaces-affect-users-opini)
101. [Sparling EI, Sen S. Rating: how difficult is it? RecSys 2011](https://doi.org/10.1145/2043932.2043961)
102. [Kluver D, Nguyen TT, Ekstrand M, Sen S, Riedl J. How many bits per rating? RecSys 2012](https://doi.org/10.1145/2365952.2365974)
103. [Peska L, Balcar S. The effect of feedback granularity on recommender systems performance. RecSys 2022](https://doi.org/10.1145/3523227.3551479)
104. [TechCrunch. Netflix is replacing five-star ratings with thumbs up or down (2017-03-16)](https://techcrunch.com/2017/03/16/netflix-is-replacing-five-star-ratings-with-thumbs-up-or-down/)
105. [Elahi M, Ricci F, Rubens N. A survey of active learning in collaborative filtering recommender systems. Computer Science Review 2016](https://doi.org/10.1016/j.cosrev.2016.05.002)
106. [Rashid AM, Albert I, Cosley D, et al. Getting to know you: learning new user preferences in recommender systems. IUI 2002](https://doi.org/10.1145/502716.502737)
107. [Steck H. Calibrated recommendations. RecSys 2018](https://doi.org/10.1145/3240323.3240372)
108. [Carbonell J, Goldstein J. The use of MMR, diversity-based reranking for reordering documents and producing summaries. SIGIR 1998](https://doi.org/10.1145/290941.291025)
109. [Narayanan A, Shmatikov V. Robust de-anonymization of large sparse datasets (Netflix Prize). IEEE S&P 2008](https://arxiv.org/abs/cs/0610105)
110. [GroupLens. MovieLens datasets (incl. Tag Genome 2021)](https://grouplens.org/datasets/movielens/)
111. [Vig J, Sen S, Riedl J. The tag genome: encoding community knowledge to support novel interaction. ACM TiiS 2012](https://doi.org/10.1145/2362394.2362395)
112. [Angelopoulos AN, Bates S. A gentle introduction to conformal prediction and distribution-free uncertainty quantification. arXiv 2107.07511, 2021](https://arxiv.org/abs/2107.07511)
113. [Reproducibility in recommender systems: a survey. arXiv 2607.26074, 2026](https://arxiv.org/abs/2607.26074)
