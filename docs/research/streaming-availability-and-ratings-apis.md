# Streaming availability and population ratings: free feeds and APIs for a movie-recommender app

Scope: which free (or free-tier) sources can supply streaming availability and population ratings (IMDb, Rotten Tomatoes, Metacritic, Letterboxd, TMDB, Trakt, Douban) for a public, open-source, browser-first movie recommender with an optional Python backend, and under which terms. Extends the earlier recommender-systems report (LensKit/Surprise/RecBole, ranking metrics, MovieLens 25M, consumer services) without repeating it. Research date 2026-09-30; every claim is tied to a source read on or near that date, and items I could not verify are labelled. This is a technical reading of published terms, not legal advice.

## Summary and recommendation

No source gives free, redistributable, commercially usable, ML-permitted data for both problems. The design that survives contact with the terms is "IDs ship in the repo, everything else is fetched at runtime with the user's own keys and cached locally under per-source rules".

For streaming availability, use TMDB `/watch/providers` as the default (free, 180+ countries, JustWatch-sourced, mandatory JustWatch and TMDB attribution, non-commercial licence, 6-month cache ceiling) [1][2], and offer Movie of the Night's Streaming Availability API as a second provider (free tier 1,000 requests per month, commercial use and caching allowed, attribution required, no resale of data) [3][4]. Do not use unofficial JustWatch GraphQL clients: the flagship Python one is archived and states non-commercial-only use [5].

For ratings, the workable free combination is: IMDb's daily `title.ratings` dataset (1.7 million rows, 8.7 MB gzipped, personal and non-commercial use) [6]; TMDB `vote_average` and `vote_count`; MDBList (free 1,000 requests per day) for the Rotten Tomatoes, Metacritic, Letterboxd and Trakt scores that have no public API [7]; and Wikidata (CC0) as an offline, dated seed for IDs and RT/Metacritic snapshots [8]. Rotten Tomatoes and Metacritic have no usable official API, and RT's terms forbid scraping and AI training [9]. Letterboxd's API is by request and, per its beta page, currently refused to recommendation, data-analysis, LLM and personal projects, so Letterboxd enters only through the user's own export file [10].

Two findings change the architecture. First, TMDB's terms prohibit using TMDB content "in connection with, including for training" an ML/AI application and classify training on TMDB content as commercial use; a TMDB staff reply in July 2026 says request-time similarity over TMDB metadata for a non-commercial project is outside that carve-out [2][11]. Keep TMDB data out of any persisted trained model and get written confirmation before shipping. Second, Trakt made API-app creation VIP-only on 2026-07-30 and is moving app management to a developer portal with a sunset on 2026-10-22; staff call the paywall temporary, so treat Trakt as unstable this quarter [12][13].

For the "scientists" side, the cleanest population-rating baseline is not an API at all: MovieLens (non-commercial licence, `links.csv` carries IMDb and TMDB ids) gives reproducible, citable ratings for train/test work [14]. Live scores are display and feature-enrichment data with recorded fetch dates.

## 1. Streaming availability sources

Terminology: availability is per (title, country, service, offer type); TMDB and JustWatch offer types are flatrate (subscription), rent, buy, ads and free [1]. "Deep link" means a URL opening the title inside the service's app. Availability is time-varying and per-market, so it is a filter and display attribute, not a stable training feature.

| Source | Coverage | Free tier and limits | Terms that matter | Browser-safe key? | Verdict |
|---|---|---|---|---|---|
| TMDB `/watch/providers` | 180+ country codes, flatrate/rent/buy/ads; no deep links (a TMDB locale URL instead); freshness not documented [1] | Free key; about 40 requests/s soft limit, HTTP 429 above it [15] | Must attribute JustWatch, non-compliance revokes access [1]; TMDB logo and disclaimer; non-commercial default; cache at most 6 months; no ML/AI use as worded [2] | Responds with `access-control-allow-origin: *` (measured 2026-09-30, on an error response), so calls work from a browser, but the key is visible to visitors; use BYO key or a proxy | depend (default) |
| Streaming Availability API (Movie of the Night) | 65 countries, 3,342+ catalogs, 200,000+ titles, deep links, expiry dates, IMDb/TMDB id lookup [16]; data updated daily [17] | Free: 1,000 requests/month, hard cap, no overage; paid $49 to $299 [3] (a search-engine snippet quoted different prices; I used the vendor page) | Commercial use allowed on all plans; may cache; attribute with link when data or images are public; may not reshare or resell to other businesses, including via database access or exports [4] | Sends `access-control-allow-origin: *` (measured); the vendor's own client warns that browser use exposes the key [17]; rate-limit numbers not found | depend (second provider, BYO key) |
| Watchmode | 50+ countries, about 372 providers [18] | Free: 2,500 credits/month, 3 countries, no deep links, non-commercial; paid $349 and up [18]; 120 requests/minute free per a docs excerpt (secondary, unverified) [19] | Free plan: cache 30 days then refresh or delete; delete all on cancellation; no resale or sharing with third parties; no ML clause found [20] | Not verified | wrap (optional, tight free tier) |
| JustWatch official Data API | Full JustWatch catalogue | Partner contract only, "bigger partners and clients" [21] | Branded links required; partner terms bar scraping and public or commercial reuse without authorisation [22] | n/a | avoid (not obtainable) |
| JustWatch unofficial GraphQL clients | Same catalogue | Undocumented endpoint, no key | Library disclaimer: no commercial use, API can change without notice; the Python client repo was archived 2026-03-18 [5]; JustWatch's own consumer terms not verified (page returned 404) | Not tested | avoid |
| Reelgood Partner API | 300+ services, 25+ countries (S3 export) | Sales-led, no public free tier or pricing [23] | Not disclosed | n/a | avoid (paid) |
| FlixPatrol API v2 | New/leaving/coming-soon for about 7 services in 10 European countries (added April 2026) [24] | Paid: $9.99 to $49/month for 1,000 calls (search snippet, official page returned 403) [25] | Not verified | n/a | study (charts and premieres, not lookup) |
| uNoGS (RapidAPI) | Netflix only, 30+ countries, scraped daily | Free Basic plan, Pro $10/month [26] | Unofficial, terms not verified | Proxy needed (RapidAPI key) | avoid |
| Utelly (RapidAPI) | Not verified | Not verified | I found no current documentation or status; cannot verify it still operates | n/a | avoid (unverifiable) |
| Simkl | Tracking and discovery, not a general catalogue | Free below $150/month revenue; 10 GET/s [27] | Link back to each item, attribute Simkl in trending UI, use TMDB/TVDB for raw metadata, `client_id` may be public, `client_secret` may not [27] | client_id yes | study (no availability role) |
| Trakt | Watch tracking, calendars; no availability feed | See section 2 | See section 2 | See section 2 | study |
| Plex Discover | Plex's own catalogue and watchlist; undocumented endpoints [28] | Account-bound | No public terms found | No | avoid for availability |

Notes. (a) I did not find a 2025-2026 free newcomer that beats the two recommended sources; FlixPatrol is the only new entrant I could confirm and it is paid. (b) Freshness is the weak point everywhere: TMDB documents none, Movie of the Night says daily. Store `fetched_at` and show "as of" dates. (c) A public static site cannot hide a key, so each visitor should paste their own TMDB or Movie of the Night key (stored in local storage), or a small proxy must hold one shared key and enforce the same terms, which turns a "local with BYO keys" app into a hosted service (section 5).

## 2. Population ratings sources

Terminology: the Tomatometer is the share of critic reviews that are positive, not an average; the audience score is a separate figure; Metacritic's Metascore is a weighted average of critic scores (0-100); IMDb's figure is documented as a "weighted average of all the individual user ratings" [6], so it is not a raw mean. These scores are not on one scale or definition and should be stored with source, scale, vote count and date.

| Source | What it gives | Access and limits | Terms that matter | Verdict |
|---|---|---|---|---|
| IMDb datasets `title.ratings.tsv.gz` | `tconst`, `averageRating`, `numVotes`; measured 1,715,455 lines, 8.7 MB gz, refreshed 2026-09-29 | Free download, daily refresh [6] | Personal and non-commercial use only; local copies allowed; do not build databases from it or republish; attribution "Information courtesy of IMDb"; scraping the site is prohibited [6][29] | use (local, user-downloaded; never committed) |
| IMDb API | Ratings, rankings, box office | AWS Data Exchange; listed at $150,000 per 12 months plus per-byte usage [30]; access by contacting IMDb licensing [31] | EULA | do-not-use |
| OMDb | One call returns IMDb, Rotten Tomatoes and Metacritic values in a `Ratings` array (still present per a 2026 client) [32] | Free key, 1,000 requests/day via Patreon email signup [33]; `access-control-allow-origin: *` (measured) | Site states content is "CC BY-NC 4.0" and "not endorsed by or affiliated with IMDb" [34]; legal page limits use to personal, non-commercial purposes and forbids derivatives [35]; where its IMDb/RT values come from is not stated (cannot verify) | use (optional, BYO key, non-commercial, never redistribute) |
| TMDB `vote_average` | Community score with `vote_count`, in every movie response | Same key as above | Same TMDB terms; 6-month cache cap [2] | use |
| MDBList API | Aggregates IMDb, TMDB, RT critic and audience, Metacritic (critic and user), Letterboxd, Trakt, Roger Ebert, MyAnimeList, plus its own score [36] | Free key, 1,000 requests/day; paid tiers 10,000 to 1,500,000/day from 1 to 20 EUR [7]; lookup by IMDb or TMDB id [37]; `access-control-allow-origin: *` (measured) | I could not find a terms page covering commercial use, caching or redistribution; upstream permission for the RT/Letterboxd values is unknown | wrap (best single source for RT/Metacritic/Letterboxd; BYO key; isolate behind one provider seam) |
| Rotten Tomatoes | Tomatometer, audience score | No self-serve API. The Fandango developer host did not resolve from my machine on 2026-09-30 [38]; secondary sources describe an application-only programme (unverified) | Terms (updated 2026-01-06) forbid robots, scrapers and data mining "for any purpose", forbid using content to train AI, and limit use to personal non-commercial [9] | do-not-use directly; scores only via Wikidata or MDBList |
| Kaggle RT snapshots | Scraped critic/audience data, e.g. dated 2020-10-31, labelled CC0 [39] | Download | A CC0 label on Kaggle does not release RT's own terms; whether downstream users are bound is untested (my inference, not a legal finding) | do-not-use for shipping; study only |
| Metacritic | Metascore, user score | No public API found | I could not retrieve its terms of use (404), so its scraping stance is unverified | avoid (unverified) |
| Wikidata `P444` review score (qualifier `P447` = source, `P585` = date) | Free-text scores such as `86%` or `6.9/10` with dates [40] | SPARQL endpoint, dumps, action API; follow the User-Agent policy [41] | CC0 for structured data [8] | use as dated snapshot (see below) |
| Trakt `/movies/{id}/ratings` | 0-10 community rating and distribution; OAuth optional [42] | 1,000 GET per 5 minutes reported [43]; `access-control-allow-origin: *` (measured) | API policy bars feeding Trakt ratings, activity or discovery data into another service's own catalogue, bulk harvesting and redistribution; personal client tools are permitted [44]; app creation VIP-gated since 2026-07-30, temporary per staff, portal migration due 2026-10-22 [12][13] | wrap (personal history sync only; not a population-rating source) |
| Letterboxd API | Film metadata, ratings, diary; OAuth2 | By email request only; beta page says no access for data-analysis, visualization or recommendation projects, LLM/GPT use, private or personal projects [10][45] | Beta page returned 403 to my fetcher; the wording comes from two search-result excerpts of the official page and should be re-read by a human | do-not-use (use exports) |
| Douban | Chinese-language community ratings | No working public API found; I could not verify this from an official Douban page, only from scraper-vendor descriptions [46] | Unknown | avoid (unverifiable) |

Wikidata coverage, measured on 2026-09-30 with SPARQL over items whose `instance of` is exactly film [41]: 274,442 have an IMDb id; 237,735 have IMDb and TMDB ids; 232,140 a Letterboxd id; 71,697 a Rotten Tomatoes id; 17,668 a Metacritic id; 17,089 all five. Films carrying an RT score statement: 25,349; Metacritic: 9,912; IMDb: 1,237. Score dates are skewed: the largest single-year block is 2021 (22,915 statements), with 3,668 dated 2024, 4,576 dated 2025 and 1,764 dated 2026. Subclasses of film are excluded, so these counts are lower bounds. Conclusion: Wikidata is a strong ID hub and a weak, stale score source; use its scores only as a dated fallback for popular titles.

Recommended combination and caching (each layer has its own TTL, stored as configuration, and every stored value carries `source`, `fetched_at`, `licence_class`):

| Layer | Source | Where it lives | TTL and rule |
|---|---|---|---|
| Identity | MovieLens `links.csv` + Wikidata ids | Committed to the repo (ids only, no scores) | Rebuild on release |
| Bulk ratings | IMDb `title.ratings` | User's machine, downloaded by the app | Daily at most; never committed or served to others |
| Per-title scores | TMDB, MDBList and/or OMDb via BYO keys | User's local store | Refresh weekly; delete at 6 months (TMDB cap); Watchmode 30 days |
| Availability | TMDB, then Movie of the Night | User's local store | Refresh daily to weekly on demand; show "as of" |
| Baseline for statistics | MovieLens ratings | Dataset download | Fixed, citable |

## 3. ID crosswalk

Hub choice: use the pair (kind, TMDB id) as the internal key, because TMDB ids resolve to metadata, posters and watch providers, keep IMDb `tconst` alongside as the join key to IMDb data, and store all other ids as attributes. TMDB movie and TV ids live in separate namespaces, so the kind must be part of the key.

| Mechanism | What it gives | Limits | Verdict |
|---|---|---|---|
| MovieLens `links.csv` | `movieId`, `imdbId`, `tmdbId` per movie; `ml-latest` generated 2023-07-20 [14] | Frozen in 2023; misses newer films; non-commercial licence, redistribution only under the same licence [14] | use (seed) |
| TMDB `/find/{external_id}` | Maps `imdb_id`, `tvdb_id`, `wikidata_id` (and social ids) to TMDB movie/TV/person results [47] | No RT, Metacritic or Letterboxd ids | use (resolve gaps live) |
| TMDB daily ID exports | Line-delimited JSON of all movie ids, `files.tmdb.org`, 7-8 AM UTC, kept 3 months [48] | Ids and basic fields only (I did not confirm the field list) | study |
| Wikidata | `P345` IMDb, `P4947` TMDB movie [49], `P1258` RT (prefix `m/`) [50], `P1712` Metacritic [51], `P6127` Letterboxd slug [52] | Coverage figures above; RT and Metacritic ids are much sparser than IMDb/TMDB | use (hub for ids) |

Keeping it consistent: (1) store each mapping as `(id_a, id_b, source, checked_at)` and never overwrite silently; (2) resolve conflicts by agreement of at least two sources, otherwise mark ambiguous and exclude from joins; (3) treat one-to-many results (one IMDb id returning several TMDB movies, or the reverse) as ambiguous rather than picking the first; (4) re-verify a sample against `/find` on each rebuild and report the disagreement rate; (5) Letterboxd slugs can be the numeric form `film:N` as well as a slug, per the property's format pattern [52], so normalise before joining. IMDb merges and redirects of ids are a known hazard that I did not verify in this pass.

## 4. Importing a user's own ratings and history

| Source | Format | Scale and IDs | Matching strategy |
|---|---|---|---|
| Letterboxd export ZIP | `ratings.csv`, `diary.csv`, `watched.csv`, `watchlist.csv`, `reviews.csv`, `lists.csv`; columns include Date, Name, Year, Letterboxd URI, Rating [53][54] | 0.5-5 stars; no IMDb or TMDB id in the export | Name + year first; resolve the Letterboxd URI to a TMDB id if an id is needed (community tools fetch the film page for it) [55]; Wikidata `P6127` is a second route |
| Letterboxd import (for round trips) | CSV with `LetterboxdURI`, `tmdbID`, `imdbID` or `Title`, optional `Year`, `Rating`, `WatchedDate`; UTF-8, 1 MB max [56] | 0.5-5 or `Rating10` | Emit `tmdbID` when known |
| IMDb ratings export | CSV from "Your Ratings" on desktop: `Const`, `Your Rating`, `Date Rated`, `Title`, `URL`, `Title Type`, `IMDb Rating`, `Runtime (mins)`, `Year`, `Genres`, `Num Votes`, `Release Date`, `Directors` (format valid since 2017, per a third-party analyzer) [57] | 1-10; `Const` is the `tconst` | Exact join on `tconst` to IMDb datasets and `links.csv`; filter `Title Type` to movies |
| Netflix viewing activity | Web download gives `Title` and `Date` (M/D/YY); a full personal-data request adds `ViewingActivity.csv` with profile, start time, duration [58][59] | No ratings, no ids; episodes appear as separate rows | Fuzzy title match against TMDB search with year unavailable; strip `Season`/`Episode` suffixes; confirm low-confidence matches with the user; treat as implicit feedback (watched), and use duration for completion |
| Trakt | API sync: history, ratings, watchlist, with `ids` blocks (imdb, tmdb); `traktexport` for a JSON dump [60] | 1-10 | Direct id join; needs an app registration, currently VIP-gated [12] |
| MovieLens export | `movielens-ratings.csv` from account settings; columns `movie_id`, `imdb_id`, `tmdb_id`, `rating`, `average_rating`, `title` (per a community converter) [61] | 0.5-5 | Direct id join |
| Criticker export | CSV/XML/HTML/TXT from the profile export box [62] | Scale and column names not verified here | Title + year; ids not confirmed |
| Plex | Undocumented community GraphQL endpoint for watch history [28]; server API exposes session history (not verified here) | Play events, not ratings | Plex GUIDs embed external ids (not verified here) |
| Jellyfin | `Items` endpoint with the `IsPlayed` filter; `UserData` has `PlayCount`, `Played`, `LastPlayedDate` [63] | Play state only | Provider ids on items (not verified here); Tautulli covers Plex only, Jellystat covers Jellyfin [64] |

Matching policy for all sources: exact external id, else normalised title plus year (plus or minus one) plus runtime, else TMDB search, else a review queue; always output an "unmatched" report. Normalise rating scales per user (for example map to z-scores) before comparing with population scores, and keep explicit ratings separate from implicit watch events.

## 5. Legal and terms matrix

"Non-comm." and "Comm." refer to what the published terms allow; "BYO" is the effect of each user supplying their own key and downloading their own data.

| Source | Non-comm. | Comm. | Attribution | Cache / redistribute | ML/AI | Hosted app | Local + BYO keys |
|---|---|---|---|---|---|---|---|
| TMDB API | Yes (default licence) | Written agreement; a revenue-generating recommender site counts as commercial | TMDB logo + disclaimer; JustWatch for providers | Cache max 6 months; no derivatives | Prohibited as worded; staff say request-time similarity is outside it (July 2026) [11]; academic-ML questions unanswered [65] | Allowed if free and non-commercial; key must be BYO or proxied | Simplest |
| Movie of the Night | Yes | Yes | Required when public, link to vendor | Cache freely; no resale or reshare to other businesses | Not addressed | Shared server key counts against 1,000/month | Best fit |
| Watchmode free | Yes | No (paid plans only) | Required | 30 days max | Not addressed | Sharing data with third parties barred | Fine within 2,500 credits |
| IMDb datasets | Yes | Licence needed | "Information courtesy of IMDb" | Local copies only; no republishing or databases | Not addressed | Ambiguous for a public service (my reading) | Fits the "personal use" wording best |
| OMDb | Yes | No | CC BY-NC 4.0 notice | NC; no derivatives | Not addressed | Same as above | Fits |
| MDBList | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Prefer; verify terms |
| Rotten Tomatoes / Metacritic (direct) | Personal use only (RT) | No | n/a | No scraping (RT) | Training barred (RT) | No | No |
| Wikidata | Yes | Yes (CC0) | None | Free | Free | Yes | Yes |
| MovieLens | Yes | Permission needed | Cite Harper and Konstan | Same-licence redistribution | Research use | Non-commercial only | Fits |
| Trakt | Personal client tools | Unclear; policy bars catalogue feeding | Branding guide | No bulk harvesting or redistribution | Not addressed | Backend for a client app is allowed if per-user | Fits |
| Letterboxd API | Refused for this use | Unknown | n/a | n/a | Refused | n/a | Export files only |

What BYO changes: the app then acts as a client tool on the user's behalf, each user accepts the vendor terms themselves, and no data is redistributed by the maintainer; that is the same reasoning Trakt's policy applies to client apps [44]. It does not by itself cure a non-commercial ceiling for a maintainer who monetises, and it does not remove attribution duties at display time. If the maintainer hosts a shared key and serves results to the public, the maintainer becomes the licensee: TMDB's 6-month cache, Movie of the Night's no-reshare rule and Watchmode's no-third-party rule then bind the hosted service. The repository must ship no cached provider data, only ids and code.

## 6. Terminology, and what an expert would add

- Entity resolution or record linkage is the general name for the crosswalk problem; "provenance" (source, date, licence per value) is what makes purge-on-terms-change possible.
- SVOD (subscription), TVOD (rent/buy), AVOD/FAST (ad-supported and free channels) are the standard offer classes; the API names differ (flatrate, rent, buy, ads, free).
- Population ratings differ in semantics (percent-positive versus mean versus weighted mean), audience (critics versus users) and vote counts; use vote count as a confidence weight, shrink low-count titles toward a prior (Bayesian average), and compare within a source, not across.
- Population scores drift over time and are influenced by the user's own site; for train/test, freeze a dated snapshot and use only information that predates the split, to avoid leakage between a feature and the rating being predicted.
- Provider seams: model each data kind (availability, score, poster) as a provider with policy metadata as data (`ttl`, `may_cache`, `may_train`, `attribution`, `needs_key`), so a terms change is a config edit; the ML flag lets the pipeline refuse to feed TMDB fields into training automatically.
- Attribution is a UI requirement, not a footnote: TMDB and JustWatch logos or text next to the provider list, Simkl links, Movie of the Night link, IMDb credit line; put them in the display component so they cannot be dropped.
- Availability belongs at query time (filter by country and the user's subscribed services), and "leaving soon" and "new" signals are worth surfacing.
- No in-house package inventory existed when I ran (its folder was empty), so no local packages are cited.

## Open questions

- Does TMDB's ML clause permit a persisted embedding index over TMDB overviews and keywords? The July 2026 reply covers request-time similarity only [11]; ask TMDB in writing and record the answer.
- MDBList terms (caching, redistribution, upstream permissions) and OMDb's source rights for its IMDb and RT values are unverified; decide before making either a default.
- Metacritic's terms of use could not be retrieved; Douban's API status rests on non-official descriptions; Utelly's status is unknown.
- Letterboxd's beta page returned 403 to automated fetches; a human should re-read it, and it may change.
- Trakt's post-2026-10-22 rules (developer portal, per-user app caps of 5 free and 25 VIP per the migration PR) and whether the VIP gate is lifted as staff promised [13].
- Watchmode credit cost per endpoint and Movie of the Night rate limits were not found in fetched text.
- CORS headers were measured on error responses with invalid keys; confirm on successful responses before relying on browser-direct calls.
- Whether IMDb's "personal and non-commercial" licence covers a public open-source app that downloads the file on the user's behalf.

## REFERENCES

[1] [TMDB. Watch Providers (movie) - API reference](https://developer.themoviedb.org/reference/movie-watch-providers)
[2] [TMDB. API Terms of Use (last updated 2023-10-20)](https://www.themoviedb.org/api-terms-of-use)
[3] [Movie of the Night. Streaming Availability API pricing](https://www.movieofthenight.com/about/api/pricing)
[4] [Movie of the Night. Streaming Availability API Terms (TERMS.md)](https://github.com/movieofthenight/streaming-availability-api/blob/main/TERMS.md)
[5] [dawoudt. JustWatchAPI (unofficial Python client; archived 2026-03-18)](https://github.com/dawoudt/JustWatchAPI)
[6] [IMDb. Non-commercial datasets](https://data.imdb.com/non-commercial-datasets/)
[7] [MDBList. Supporter tiers and API limits](https://docs.mdblist.com/docs/supporter)
[8] [Wikidata. Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)
[9] [Rotten Tomatoes. Terms of Use (last updated 2026-01-06)](https://www.rottentomatoes.com/policies/terms-of-use)
[10] [Letterboxd. API (beta access page; returned 403 to my fetcher, wording taken from search-result excerpts)](https://letterboxd.com/api-beta/)
[11] [TMDB Talk. Clarification needed: training an AI/ML system (staff reply 2026-07-21)](https://www.themoviedb.org/talk/6a5e284be6125cf4396873a6)
[12] [Trakt Forums. Failure to register an API](https://forums.trakt.tv/t/failure-to-register-an-api/116157)
[13] [trakt-web pull request 3311. Point API app management at the developer portal](https://github.com/trakt/trakt-web/pull/3311)
[14] [GroupLens. MovieLens ml-latest README](https://files.grouplens.org/datasets/movielens/ml-latest-README.html)
[15] [TMDB. Rate limiting](https://developer.themoviedb.org/docs/rate-limiting)
[16] [Movie of the Night. Streaming Availability API overview](https://www.movieofthenight.com/about/api)
[17] [Movie of the Night. ts-streaming-availability (client README)](https://github.com/movieofthenight/ts-streaming-availability)
[18] [Watchmode. API plans and coverage](https://api.watchmode.com/)
[19] [Watchmode. API Explorer and documentation (rate-limit figure from a search excerpt only)](https://api.watchmode.com/docs)
[20] [Watchmode. Terms and Conditions (updated 2026-09-01)](https://api.watchmode.com/tc)
[21] [JustWatch. Partner API documentation](https://apis.justwatch.com/docs/api/)
[22] [JustWatch. Terms of Use for partners](https://partners.justwatch.com/legal/termsofuse)
[23] [Reelgood for Business. API documentation](https://data.reelgood.com/api-docs/api-documentation/)
[24] [FlixPatrol. Changelog](https://flixpatrol.com/about/changelog/)
[25] [FlixPatrol. API (pricing from a search excerpt; page returned 403)](https://flixpatrol.com/about/api/)
[26] [uNoGS on RapidAPI](https://rapidapi.com/unogs/api/unogs)
[27] [Simkl. API rules](https://api.simkl.org/api-rules)
[28] [martadams89. plex-community-watch-history-cleanup (documents the undocumented community.plex.tv GraphQL endpoint)](https://github.com/martadams89/plex-community-watch-history-cleanup)
[29] [IMDb Help. Can I use IMDb data in my software?](https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX)
[30] [AWS Marketplace. IMDb Essential Metadata for Movies/TV/OTT (API)](https://aws.amazon.com/marketplace/pp/prodview-wdqq4hg3bcbws)
[31] [IMDb. Data and API documentation](https://data.imdb.com/documentation/)
[32] [icco. omdb (Go client returning IMDb, Metacritic and Tomatometer values)](https://github.com/icco/omdb)
[33] [OMDb API. API key page](https://www.omdbapi.com/apikey.aspx)
[34] [OMDb API. Home](https://www.omdbapi.com/)
[35] [OMDb API. Terms of use](https://www.omdbapi.com/legal.htm)
[36] [MDBList. Documentation home](https://docs.mdblist.com/)
[37] [MDBList. API documentation](https://docs.mdblist.com/docs/api)
[38] [Fandango. Rotten Tomatoes Developer Network (host did not resolve on 2026-09-30)](https://developer.fandango.com/rotten_tomatoes)
[39] [Kaggle. Rotten Tomatoes movies and critic reviews dataset](https://www.kaggle.com/datasets/stefanoleone992/rotten-tomatoes-movies-and-critic-reviews-dataset)
[40] [Wikidata. Property P444 (review score)](https://www.wikidata.org/wiki/Property:P444)
[41] [Wikidata. Data access (SPARQL endpoint used for the coverage counts)](https://www.wikidata.org/wiki/Wikidata:Data_access)
[42] [Trakt API discussion 567. Fetching the rating for a single movie](https://github.com/trakt/trakt-api/discussions/567)
[43] [Trakt Forums. Trakt rate limit reached: 429](https://forums.trakt.tv/t/trakt-rate-limit-reached-429/41464)
[44] [trakt-api pull request 941. Clarify permitted API use](https://github.com/trakt/trakt-api/pull/941)
[45] [API Evangelist. Letterboxd API profile (independent, third party)](https://github.com/api-evangelist/letterboxd)
[46] [Apify. Douban Scraper (third-party listing; no official Douban statement found)](https://apify.com/zhorex/douban-scraper)
[47] [TMDB. Find by ID](https://developer.themoviedb.org/reference/find-by-id)
[48] [TMDB. Daily ID exports](https://developer.themoviedb.org/docs/daily-id-exports)
[49] [Wikidata. Property P4947 (TMDB movie ID)](https://www.wikidata.org/wiki/Property:P4947)
[50] [Wikidata. Property P1258 (Rotten Tomatoes ID)](https://www.wikidata.org/wiki/Property:P1258)
[51] [Wikidata. Property P1712 (Metacritic ID)](https://www.wikidata.org/wiki/Property:P1712)
[52] [Wikidata. Property P6127 (Letterboxd film ID)](https://www.wikidata.org/wiki/Property:P6127)
[53] [Letterboxd. Export your data](https://letterboxd.com/user/exportdata/)
[54] [Achriom. How to export your Letterboxd diary (file and column description, secondary)](https://www.achriom.com/blog/how-to-export-your-letterboxd-diary/)
[55] [Tetrax-10. letterboxd-csv-imdb-tmdb-mapper](https://github.com/Tetrax-10/letterboxd-csv-imdb-tmdb-mapper)
[56] [Letterboxd. Importing data](https://letterboxd.com/about/importing-data/)
[57] [dresa. imdb-list-analyzer (documents the IMDb export columns, secondary)](https://github.com/dresa/imdb-list-analyzer)
[58] [MakeUseOf. How to see your Netflix viewing activity (secondary)](https://www.makeuseof.com/tag/how-to-download-netflix-viewing-history/)
[59] [sergiorua. netflix-viewing-activity (uses the detailed ViewingActivity.csv, secondary)](https://github.com/sergiorua/netflix-viewing-activity)
[60] [traktexport (PyPI)](https://pypi.org/project/traktexport/)
[61] [DenverCoder1. Convert MovieLens CSV export to Letterboxd import format (gist)](https://gist.github.com/DenverCoder1/f218260e3f5cfc6551fab88e7b07d9f0)
[62] [Criticker. Film rating import and export resources](https://www.criticker.com/resources/)
[63] [Jellyfin. TypeScript SDK, ItemsApiGetItemsRequest](https://typescript-sdk.jellyfin.org/interfaces/generated-client.ItemsApiGetItemsRequest.html)
[64] [JellyWatch. Jellystat, the Tautulli alternative for Jellyfin (2026)](https://jellywatch.app/blog/jellystat-tautulli-alternative-jellyfin-statistics-setup-2026)
[65] [TMDB Talk. Clarification on using TMDb API for non-commercial academic ML research (2025-06-13, no staff reply)](https://www.themoviedb.org/talk/684b56e31516e3e64b343bce)
