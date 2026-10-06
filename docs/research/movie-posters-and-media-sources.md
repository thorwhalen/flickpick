# Movie posters, backdrops, logos and trailers: sourcing and delivery for a free, browser-first movie app

Scope: where a free, public, open-source, browser-first movie recommender can legally and reliably get posters, backdrops, logos and trailers; what the copyright position is; how to deliver the images. Dated 2026-09-30. Extends the preliminary recommender report, which does not touch images. Companion topics (streaming availability, ratings APIs, semantic descriptions) are covered elsewhere and appear here only where they intersect with images.

## Summary and recommendation

Use the TMDB image CDN as the only poster/backdrop/logo source, reached through a small provider seam (`tmdb | none`) so the app degrades to generated placeholders. TMDB is the only source that is free, keyless at the image layer, broad, browser-friendly (CORS `*`, one-year cache headers) and explicitly licensed for non-commercial use with attribution [1][2]. Every alternative is either paid, closed, unlicensed, or a laundering of TMDB/IMDb images.

There is one blocker that must be resolved before shipping the AI assistant. TMDB's API terms (last updated 2023-10-20) forbid using TMDB content "in connection with, including for training, a machine learning (ML) or artificial intelligence (AI) based Application", and list LLM chatbots and revenue from recommending movies as commercial uses [1]. A TMDB staff member said in July 2026 that similarity scoring on metadata for a student's non-commercial recommender is not what the clause targets [3]. That reply covers a narrower case than an agent-driven assistant that chooses movies, so get written confirmation from TMDB for the exact architecture, or keep TMDB data out of the LLM path.

Posters are copyrighted marketing material; TMDB itself says it grants no rights in them and that attribution "has nothing to do with copyrights" [4]. The lowest-risk posture for a public repo is: hotlink (do not host copies), attribute, never redistribute poster files in the repo or in datasets, honour takedowns, and keep any app-controlled cache under the 6-month limit [1]. The TMDB API key is only needed for metadata, never for image URLs, so the clean design is a build-time catalogue snapshot (with `poster_path` strings) plus a keyless CDN, with a small Cloudflare Worker or qh endpoint only for the few live calls (videos, watch providers).

Trailers: take YouTube keys from TMDB `/videos` and embed with a click-to-load facade on `youtube-nocookie.com`; do not download or re-host video [5][6].

Do not use: OMDb posters (patron-only, non-commercial terms), IMDb images (no licence path), Wikipedia/Wikimedia posters (non-free, mostly absent from Commons), Kaggle/Hugging Face poster dumps (licence labels do not cover the images), Letterboxd (access refused for this kind of project), iTunes Search (movie search returned empty results in my probe), JustWatch image scraping (terms forbid scraping).

## 1. Sources compared

Verdict vocabulary: use / do-not-use / optional. "Terms verified" means read on the official terms or docs page in this session; anything else is flagged.

| Source | Coverage and sizes | Terms and licence | Key handling | Verdict |
|---|---|---|---|---|
| TMDB images (`image.tmdb.org/t/p/`) | Posters, backdrops, logos, stills, profiles for movies, TV, people. Poster sizes w92, w154, w185, w342, w500, w780, original; backdrop w300, w780, w1280, original; logo w45 to w500, original (SVG only at original) [2][7]. Language-tagged, with `include_image_language` filter [8]. | Free for non-commercial use with attribution: TMDB logo plus the notice "This [product] uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB" [1]. No caching of TMDB information beyond 6 months; no derivatives; AI/ML clause; commercial use needs a written agreement [1]. Terms verified. | Image URLs need no key; only `/movie/{id}` and `/images` need a key or read token [2][9]. | use, subject to the AI clause |
| OMDb API (omdbapi.com) | Metadata plus a Poster API "over 280,000 posters, updated daily with resolutions up to 2000x3000", patron-only [10]. Free key limited to 1,000 requests/day [11]. | Site content stated as CC BY-NC 4.0 [10]; site terms are personal, non-commercial use only [12]. The CC label cannot cover copyrighted posters (my inference). Patron tier prices not verifiable from the pages fetched. | Key in query string; posters need a patron key. | do-not-use for posters |
| Fanart.tv | Movie art types: `hdmovielogo`, `movieposter`, `moviebackground` (1920x1080), `movie4kbackground`, `hdmovieclearart`, `moviebanner`, `moviethumb`, `moviedisc` [13]. Homepage snapshot reported 389,390 movie images (date unverified) [14]. Community-uploaded, TMDB-id keyed [13]. | Official terms pages returned a bot challenge (403) to my fetcher, so terms are unverified from the primary page. Secondary sources: project keys are for developers, personal keys optional; public programs must tell users about fanart.tv and the images used; no commercial use without written consent [15]. Client library is MIT; the art is not [13]. | Project `api_key` (7-day image delay); optional user-supplied `client_key` (2-day delay); VIP real-time [13][15]. Strongly suggests letting users enter their own personal key [15]. | optional, for clear logos and 4K backgrounds; verify terms first |
| IMDb | Non-commercial TSV datasets contain no images [16]. Official IMDb API is GraphQL, sold through AWS Data Exchange, price by sales contact; docs list "Title Primary Images" as a bulk category [17]. | Conditions of Use bar scraping, robots and framing of images; images are IMDb's or its suppliers' [18]. | Paid contract. | do-not-use (paid; not in scope) |
| Wikimedia Commons | Free content only; rejects fair use, non-commercial licences and posters unless public domain or freely released [19]. Wikidata property P3383 links a film to a Commons poster file when one exists [20]. | Commons: public domain if published before 1931 (US) or expired in both countries [19]. | Keyless. | optional, only as a fallback for old films |
| Wikipedia poster images | English Wikipedia hosts posters as non-free content under a rationale that requires minimal use, one article minimum, and article-namespace-only placement; it states such content cannot be freely reused by others [21]. | Not licensed for reuse by third parties. | n/a | do-not-use |
| Letterboxd API | Film data, posters, member activity. | Access by request only; the page states it is not granting access for data-analysis, visualization or recommendation projects, LLM/GPT use, or private/personal projects [22]. Only reachable through a search snippet; the page itself returned 403 to my fetcher. | Approved key. | do-not-use |
| MovieLens / GroupLens | No images. `links.csv` gives `tmdbId` and `imdbId`, which is the join key to TMDB [23]. | Non-commercial use, acknowledgement required [23]. | n/a | use for IDs only |
| Kaggle / Hugging Face poster datasets | Examples: PosterLens (62,061 posters from MovieLens-25M, labelled MIT, poster source not stated in its README) [24]; "The Movies Dataset" (CC0 label, data sourced from TMDB and GroupLens) [25]; Hugging Face poster sets whose cards read "More Information needed" or tag apache-2.0 [26]. | The uploader's licence covers the uploader's contribution; it cannot grant rights in third-party posters, and the TMDB terms forbid providing cached data sets containing TMDB content to others for ML use [1]. | n/a | do-not-use for distribution; fine for private experiments |
| TheTVDB (v4) | TV first, movies and artwork included. | Official page: tiered licence by parent-company revenue, free under USD 50k/year with attribution and a visible link to TheTVDB; open-source projects discounted; "We do not claim ownership of any of the images" [27]. The GitHub page describes an alternative user-subscription model (USD 12/year per end user) [28]; the two pages disagree in emphasis, so confirm with TVDB. | Licensed key. | optional fallback; adds a second contract |
| Open Media Database (omdb.org) | Berlin community project, content stated as CC BY 2.0 Germany [29]. | Site fetch returned only a captcha, so status, API availability and image policy are unverified. | unknown | do-not-use until verified |
| Apple iTunes Search API | `artworkUrl60/100`, resizable by editing the URL (my observation; not in the docs), about 20 calls/minute [30]. In my probe on 2026-09-30, `media=movie` searches for well-known titles ("Inception", "Jaws") returned zero results, while a generic query returned obscure films. Movie coverage is unreliable. | Promotional content must sit near iTunes badges, be streamed not cached, and serve promotion only [30]. | Keyless, CORS `*` (my probe). | do-not-use |
| Trakt | Posters, fanart, logos, clearart, banners in WebP; images are imported from TMDB and TVDB/Fanart.tv [31]. | Docs state all images must be cached in your app or server and hotlinking is blocked [31]. | Trakt client id. | do-not-use as an image source; it delegates to TMDB |
| JustWatch | Images and offers via unofficial wrappers. | Terms bar scraping, robots and data mining, and public or commercial reuse of Service Content [32]. TMDB's watch-provider data comes from JustWatch and requires attribution to JustWatch [33]. | none official | do-not-use directly; show "JustWatch" attribution when using TMDB provider data |

Points that matter across the table:

- The provider logos for streaming services (Netflix, HBO Max and so on) come from TMDB `logo_path` in `/watch/providers`, and JustWatch attribution is mandatory or API access is revoked [33].
- TMDB image files carry no per-image licence; TMDB says it holds only a licence from uploaders and cannot vouch for permission from copyright owners [4][34][35].
- TVDB and TMDB are both community databases; neither owns the artwork, so both pass the legal risk to the app [4][27].

## 2. Copyright reality

Posters, backdrops and logos are copyrighted (or trademarked) marketing material. TMDB's contributor terms give TMDB a broad licence from uploaders, who warrant they have the rights [35]; TMDB's own staff have said twice that they have no document granting users rights in the images and that attribution is a service condition unrelated to copyright [4][34]. TMDB processes DMCA notices and terminates repeat infringers [36], so a takedown propagates to the CDN file, not to your app's copies.

What "attribution" means in practice: (a) the TMDB logo, less prominent than the app's own branding, and (b) the exact notice sentence, placed prominently, typically in an About or Credits section [1][37][38]. It is a licence condition of API use, not a copyright licence for the posters [4]. Watch-provider data adds a "JustWatch" credit [33].

Risk for a public open-source repo:

- The legal comfort of hotlinking rests on US Ninth Circuit doctrine. Perfect 10 v. Amazon (2007) held that small thumbnails served for retrieving information were transformative fair use, and adopted the server test: inline-linking to content on a third party's server is not a direct display infringement [39]. Hunley v. Instagram (2023) reaffirmed the server test [40]. This is one circuit's law, other courts have been less friendly to embedding, and it is not legal advice; I did not verify the SDNY position or EU law.
- Self-hosting or committing poster files makes the project the publisher and breaks the TMDB 6-month cache limit [1]. Do not commit posters, thumbnails, blur hashes derived from them, or embeddings of poster images to the repo.
- Public-domain posters exist but the boundary is per title: secondary sources say most pre-1960 US posters lacked notice or renewal, and posters from 1978 on are copyrighted [41]. Commons applies a stricter test (US publication before 1931 or expired in both countries) [19]. Per-title clearance is not worth the effort for a recommender; use it only if a specific old poster is needed.
- Non-commercial status matters: TMDB defines commercial by whether the primary purpose is revenue for the owner, and free use requires attribution [37]. Ads, paid tiers or affiliate links on the app would move it into the "written agreement" category [1].

When a poster is missing (TMDB coverage of poster art per title is not verifiable without a key; treat it as incomplete for obscure titles): render a deterministic generated placeholder from the title and year, for example a gradient seeded by a hash of the id with the title set in type, in a 2:3 box with the same intrinsic size as the real image so layout does not shift. TMDB's own image guidelines say it sometimes prefers no image to a very bad one [42]. Do not use AI-generated fake posters that imitate real ones; they invite trademark and confusion problems (my judgment).

## 3. Practical delivery

Measurements below are my own probes of the live CDN on 2026-09-30 for one sample poster; treat as indicative.

- CDN: BunnyCDN edge; `cache-control: public, max-age=31919000` (about 369 days); `access-control-allow-origin: *`; an unauthenticated request with a foreign `Referer` returned 200, so hotlinking is not blocked. Sizes for the sample: w92 6.7 KB, w154 15.8 KB, w185 17.8 KB, w342 63.7 KB, w500 103.5 KB, w780 291 KB, original 1.19 MB. Non-listed sizes (`w123`) return 400.
- Format: sending `Accept: image/webp` returned `image/webp` (81.7 KB against 103.5 KB for JPEG at w500) from the same `.jpg` URL, and no `Vary` header was present. Browsers negotiate this transparently, but any cache you place in front (Worker, CDN) must key on `Accept` or normalise it, or it can serve WebP to a client that cannot decode it.
- API CORS: the `api.themoviedb.org` preflight allowed any origin and the `Authorization` header, so a browser can call the API directly and would expose the key. TMDB docs recommend a bearer read token and say nothing about client-side exposure [9]. The rate limit is about 40 requests/second, subject to change, and 429 must be respected [43]. Whether the limit applies to the image CDN is undocumented [43].

| Option | How it works | Cost and limits | Terms fit | Verdict |
|---|---|---|---|---|
| Hotlink to the TMDB CDN | `<img src="https://image.tmdb.org/t/p/w342/...">` with `srcset` | Free; browser HTTP cache already lasts about a year, TMDB's own choice | Best fit: no copies held; the server test applies [39][40]; TMDB "excessive bandwidth" clause is the only watch-point [1] | depend |
| Cloudflare Worker (or Pages Function) proxy | Worker fetches metadata with a secret token and returns JSON; optionally proxies and edge-caches images with `caches.default` | Free plan: 100,000 requests/day, 10 ms CPU, 50 subrequests per request [44]; Cache API works on custom domains, not in dashboard previews [45] | Proxying images turns you into a host in the server-test sense; cache under 6 months; identify the app (TMDB bars cloaking the accessing application) [1] | wrap for metadata; avoid for images |
| qh service (Python) | qh wraps Python functions as an HTTP service; in-house `dol` gives a store seam for cached responses | Needs a server; fine for the Python fallback path | Same as Worker; suitable if the recommender backend already exists | wrap |
| Self-hosted image cache (bucket or repo) | Download once, serve from your own storage | Storage and egress cost; refresh at most every 6 months | Highest exposure: you distribute posters, and termination requires purging all cached content [1] | avoid |
| Build-time catalogue snapshot | CI fetches metadata and image paths, ships a static JSON/Parquet catalogue | Free; refresh on a schedule under 6 months | Fits the 6-month cap [1]; do not publish it as a downloadable dataset for others [1] | use |

Delivery details:

- `srcset` with width descriptors and a `sizes` attribute lets the browser choose among w185/w342/w500/w780 before JavaScript runs; percentages are not allowed in `sizes` slot widths [46]. Suggested mapping (my proposal): grid cards 185/342, detail page 500/780, never `original` in the UI.
- Add `width` and `height` (2:3 for posters) to prevent layout shift, use `loading="lazy"` only below the fold, and keep the first visible row eager [47]. Browsers start lazy loads at roughly 1250 px (4G) or 2500 px (3G) from the viewport [47].
- Blur-up: TMDB provides no placeholder. ThumbHash encodes about 20 bytes, keeps aspect ratio and alpha, and is more colour-accurate than BlurHash at similar size [48]; BlurHash is 20-30 characters, MIT, and cheap if decoded at 20-32 px [49]. Both must be computed from the image, so they are a derivative of TMDB content; whether that is a "derivative" under the terms is unclear, so compute a dominant colour or hash on the client at first load, or do not persist it (open question).
- Offline/PWA: cross-origin `<img>` without `crossorigin` yields opaque responses, and Chrome inflates each to about 7 MB of quota, so a few hundred cached posters can exhaust storage [50]. Because the CDN sends CORS `*`, request images with `crossorigin="anonymous"` or `fetch(..., {mode: "cors"})` and the padding does not apply [50] (my inference from the two facts). Use a stale-while-revalidate or cache-first strategy with an expiry plugin, `maxEntries`, `purgeOnQuotaError`, and a `maxAgeSeconds` well below 6 months, say 90 days [50][51]. Safari deletes script-created data after 7 days without user interaction when tracking prevention is on, so offline posters are best-effort on iOS [52].
- Key hiding: the image path needs no key; keep the token out of the browser by (a) fetching metadata in CI, or (b) a Worker holding the token as a secret, with an allow-list of endpoints (`/movie/{id}`, `/movie/{id}/videos`, `/movie/{id}/watch/providers`) and a short cache TTL. The alternative of letting users paste their own key is explicitly encouraged by Fanart.tv [15]; TMDB's terms do not address it, so treat as unverified.
- In-house building blocks from the internal inventory (unlinked): `qh` for the Python service, `dol` for the response store, `zodal-store-http` to swap browser store for HTTP store, `acture` and `py2mcp` for assistant and MCP tools. None provides poster sourcing.

## 4. Trailers, backdrops and logos

- TMDB `/movie/{id}/videos` returns `site`, `key`, `type`, `official`, `size`, `published_at`, `iso_639_1` [5]. Sites are YouTube and Vimeo; types are Trailer, Teaser, Clip, Behind the Scenes, Bloopers, Featurette; sources must be official; fan videos are prohibited [53]. Pick `official: true`, `type: Trailer`, the user's language, highest `size`, latest `published_at`; fall back to Teaser.
- Embedding: the iframe must be at least 200x200 px (480x270 recommended for 16:9), must not be overlaid, and the client must send a `Referer` [54]. Error 153 is reported for pages that send no referrer; secondary sources fix it with `referrerpolicy="strict-origin-when-cross-origin"` or the `youtube-nocookie.com` domain [55]. YouTube's developer policies forbid downloading or caching video, separating audio from video, and modifying the player [6]; the 30-day retention limit applies to data from the Data API, which this design does not call [6].
- Performance: use a click-to-load facade (thumbnail plus play button; lite-youtube-embed, which uses `youtube-nocookie.com` and claims a large speed-up over a raw iframe) so no third-party JavaScript loads until play [56].
- Backdrops: TMDB backdrops (w780/w1280) are 16:9 hero images; logos are transparent PNG or SVG title treatments (PNG for sizes, SVG only at `original`) [2]. Request `include_image_language=en,null` so language-neutral art appears [8]. Fanart.tv adds `hdmovielogo` and `movie4kbackground` when TMDB's are missing [13]. Apply a scrim for text legibility.

## 5. Terminology and expert notes

- Poster art / key art / one-sheet: the theatrical marketing image (shown at 2:3 in TMDB's poster sizes [7]). Backdrop / fanart / hero image: 16:9 still or composite. Clearlogo / title treatment: transparent title artwork. Thumb, banner, disc, clearart: Fanart.tv types [13]. Still: a frame from the film, which TMDB lists separately.
- Hotlinking / inline linking / embedding versus hosting: the server test distinguishes them legally [39][40]. LQIP (low-quality image placeholder), blur-up, ThumbHash, BlurHash: placeholder techniques [48][49]. Art direction (`<picture>`) versus resolution switching (`srcset`) [46].
- Video vocabulary: trailer, teaser, clip, featurette, TV spot, behind the scenes, bloopers [53].
- Expert additions: keep a `PosterProvider` interface with `resolve(movie, size) -> URL | None` and treat "none" as a first-class outcome; store only ids and TMDB `poster_path` strings in your catalogue, never image bytes; put attribution text in one config value so it cannot drift; add a scheduled job that re-fetches or drops catalogue data older than about 5 months; surface a "report a broken or wrong poster" link that forwards to TMDB, since fixes belong upstream; and record the terms version and date (2023-10-20) in the repo so a later change is noticed.

## Open questions

1. Does TMDB permit an in-app AI assistant and an MCP connector that choose movies using TMDB metadata for a free, non-commercial, open-source project? The 2026 staff reply covers only similarity scoring [3]; the research-project thread had no reply [57]. Ask in writing and file the answer in the repo.
2. Is a client-computed placeholder (ThumbHash, dominant colour) a "derivative" under the TMDB terms [1]?
3. Would TMDB accept a bring-your-own-key model, where each user supplies their own key, as satisfying the terms?
4. Fanart.tv official terms and rate limits could not be read (bot challenge). Re-check with a browser before depending on it.
5. Letterboxd's access statement rests on a search snippet of its API page; confirm by email if Letterboxd data is ever wanted.
6. Status and licence of omdb.org and any current image policy remain unverified.
7. What fraction of a MovieLens-scale catalogue has a TMDB poster? Not measurable without a key; sample it in CI and log the miss rate.
8. Legal position outside the US Ninth Circuit and in the EU for hotlinking to copyrighted posters.

## REFERENCES
1. [TMDB, API Terms of Use (last updated 2023-10-20)](https://www.themoviedb.org/api-terms-of-use)
2. [TMDB Developer Docs, Image Basics](https://developer.themoviedb.org/docs/image-basics)
3. [TMDB Talk, "Clarification needed: training an AI/ML system" (staff reply 2026-07-21)](https://www.themoviedb.org/talk/6a5e284be6125cf4396873a6)
4. [TMDB Talk, "A legal right to use all the content" (staff reply 2016-08-26)](https://www.themoviedb.org/talk/57c03f4c92514149b60005c3)
5. [TMDB API Reference, Movie videos](https://developer.themoviedb.org/reference/movie-videos)
6. [YouTube API Services, Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
7. [TMDB API Reference, Configuration details (image size lists)](https://developer.themoviedb.org/reference/configuration-details)
8. [TMDB API Reference, Movie images](https://developer.themoviedb.org/reference/movie-images)
9. [TMDB Developer Docs, Authentication](https://developer.themoviedb.org/docs/authentication-application)
10. [OMDb API, home page (Poster API, CC BY-NC 4.0 statement)](https://www.omdbapi.com/)
11. [OMDb API, API key page (free key limit)](https://www.omdbapi.com/apikey.aspx)
12. [OMDb API, Terms of Use](https://www.omdbapi.com/legal.htm)
13. [fanart.tv, official API client README (key types, movie image types, MIT)](https://github.com/fanart-tv/fanart.tv-api)
14. [fanart.tv, home page (image counts via search snippet; date unverified)](https://fanart.tv/)
15. [fanart.tv blog, "What are fanart.tv Personal API keys?" (read through a search snippet; page returned 403)](https://medium.com/fanart-tv/what-are-fanart-tv-personal-api-keys-472f60222856)
16. [IMDb, Non-commercial datasets](https://data.imdb.com/non-commercial-datasets/)
17. [IMDb Data / API overview (AWS Data Exchange)](https://data.imdb.com/)
18. [IMDb, Conditions of Use](https://www.imdb.com/conditions)
19. [Wikimedia Commons, Licensing](https://commons.wikimedia.org/wiki/Commons:Licensing)
20. [Wikidata, Property P3383 "film poster"](https://www.wikidata.org/wiki/Property:P3383)
21. [Wikipedia, Non-free content criteria](https://en.wikipedia.org/wiki/Wikipedia:Non-free_content_criteria)
22. [Letterboxd, API beta page (read through a search snippet; page returned 403)](https://letterboxd.com/api-beta/)
23. [GroupLens, MovieLens latest README](https://files.grouplens.org/datasets/movielens/ml-latest-README.html)
24. [aptlin/posterlens (PosterLens dataset)](https://github.com/aptlin/posterlens)
25. [Kaggle, The Movies Dataset (licence per search snippet; page not readable)](https://www.kaggle.com/datasets/rounakbanik/the-movies-dataset)
26. [Hugging Face, skvarre/movie_posters-100k dataset card](https://hf.co/datasets/skvarre/movie_posters-100k)
27. [TheTVDB, API information and licensing](https://thetvdb.com/api-information)
28. [thetvdb/v4-api on GitHub](https://github.com/thetvdb/v4-api)
29. [Open Media Database, FAQ (captcha only; licence per search summary)](https://www.omdb.org/en/us/content/Help:Faq)
30. [Apple Services Performance Partners, iTunes Search API](https://performance-partners.apple.com/search-api)
31. [Trakt, Images documentation](https://docs.trakt.tv/docs/images)
32. [JustWatch, Terms of Use](https://support.justwatch.com/article/just-watchs-terms-of-use)
33. [TMDB API Reference, Movie watch providers (JustWatch attribution)](https://developer.themoviedb.org/reference/movie-watch-providers)
34. [TMDB Talk, "Documentation on Imagery Usage Rights" (staff reply 2014-02-20; older source)](https://www.themoviedb.org/talk/530525ae9251413488038dc4)
35. [TMDB, Terms of Use (user contributions, scraping)](https://www.themoviedb.org/terms-of-use)
36. [TMDB, DMCA Policy](https://www.themoviedb.org/dmca-policy)
37. [TMDB Developer Docs, FAQ](https://developer.themoviedb.org/docs/faq)
38. [TMDB, Logos and attribution](https://www.themoviedb.org/about/logos-attribution)
39. [Wikipedia, Perfect 10, Inc. v. Amazon.com, Inc. (9th Cir. 2007)](https://en.wikipedia.org/wiki/Perfect_10,_Inc._v._Amazon.com,_Inc.)
40. [Technology & Marketing Law Blog, Hunley v. Instagram (9th Cir. 2023)](https://blog.ericgoldman.org/archives/2023/08/ninth-circuit-reaffirms-the-server-test-for-direct-infringement-of-the-public-display-right-hunley-v-instagram-llc-guest-blog-post.htm)
41. [Balough Law Offices, "Frankly, My Dear, It Has No Copyright" (secondary source on pre-1989 notice rules for posters; verify per title)](https://www.balough.com/frankly-my-dear-it-has-no-copyright/)
42. [TMDB Bible, Image guidelines](https://www.themoviedb.org/bible/image)
43. [TMDB Developer Docs, Rate Limiting](https://developer.themoviedb.org/docs/rate-limiting)
44. [Cloudflare Workers, Limits](https://developers.cloudflare.com/workers/platform/limits/)
45. [Cloudflare Workers, Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
46. [MDN, Responsive images](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Responsive_images)
47. [web.dev, Browser-level image lazy loading](https://web.dev/articles/browser-level-image-lazy-loading)
48. [Evan Wallace, ThumbHash](https://evanw.github.io/thumbhash/)
49. [Wolt, BlurHash](https://github.com/woltapp/blurhash)
50. [Chrome for Developers, Workbox: Understanding storage quota](https://developer.chrome.com/docs/workbox/understanding-storage-quota)
51. [Chrome for Developers, Workbox caching strategies overview](https://developer.chrome.com/docs/workbox/caching-strategies-overview)
52. [MDN, Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
53. [TMDB Movie Bible, Videos](https://www.themoviedb.org/bible/movie/59f3b16d9251414f2000000a)
54. [YouTube API Services, Required minimum functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)
55. [University of Michigan TeamDynamix KB, Fixing YouTube Player Error 153 with referrer policy settings (secondary source)](https://teamdynamix.umich.edu/TDClient/30/Portal/KB/Article/14491/Fixing-YouTube-Player-Error-153-with-Referrer-Policy-Settings)
56. [paulirish/lite-youtube-embed](https://github.com/paulirish/lite-youtube-embed)
57. [TMDB Talk, "API Terms of Use: Research Project" (2024-02-13, no replies seen)](https://www.themoviedb.org/talk/65cb3f065be00e017cad0654)
