# Research

The research round of 2026-09-30 that preceded the first commit. Start with the synthesis, then the report a question points to. The architecture that came out of it is in [../architecture.md](../architecture.md).

| File | What it holds |
|---|---|
| [original-request.md](original-request.md) | The request that started the project, verbatim, plus its addendum |
| [movie-recommender-research-synthesis.md](movie-recommender-research-synthesis.md) | Cross-report synthesis: answers to each question, the licensing decision, conflicts and resolutions, what we use, numbers worth remembering, open questions |
| [inhouse-inventory.md](inhouse-inventory.md) | What already existed in the author's package ecosystem |
| [recsys-methods-libraries-evaluation.md](recsys-methods-libraries-evaluation.md) | Recommender methods and libraries, the single-user setting, personal evaluation, the statistics behind the "for scientists" page |
| [streaming-availability-and-ratings-apis.md](streaming-availability-and-ratings-apis.md) | Streaming availability feeds, population-rating sources, ID crosswalk, ratings import, terms matrix |
| [semantic-movie-data-and-filter-features.md](semantic-movie-data-and-filter-features.md) | Semantic text sources, existing embeddings, LLM vibe profiles and their cost, embedding models, filterable features |
| [movie-posters-and-media-sources.md](movie-posters-and-media-sources.md) | Poster, backdrop, logo and trailer sources; copyright posture; delivery |
| [browser-first-feasibility-licensing-agents-prior-art.md](browser-first-feasibility-licensing-agents-prior-art.md) | In-browser compute, hosting, licensing matrix, key handling, privacy, agent surfaces, prior art, terminology |
| [brand-name-report.md](brand-name-report.md) | The naming analysis that produced "flickpick" |
| [prompts/](prompts/) | The research prompts, one per theme, for rerunning or extending |

Verified from the primary source on 2026-09-30: TMDB's API Terms of Use (last updated 2023-10-20) prohibit using TMDB APIs or content "in connection with, including for training, a machine learning (ML) or artificial intelligence (AI) based Application", cap caching at 6 months, require TMDB-logo attribution, and require a written agreement for any revenue. That clause is why the shipped artifacts are built from Wikidata, Wikipedia and MovieLens only.
