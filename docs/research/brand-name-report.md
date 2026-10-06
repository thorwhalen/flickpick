# Brand Name Deep Dive: 14 Candidates for an AI-Enabled Personal Movie Recommender

Date: 2026-09-30. Context: an open-source, hobby/indie project. A browser-first web app plus a Python/TypeScript package that AI agents call to choose movies for the user, with a 'for scientists' side offering statistics. Weighting: memorability, how well the name says 'it picks movies for me', domain fit, pronounceability in English and French, and absence of confusion with existing movie services (JustWatch, Reelgood, Letterboxd, Trakt, MoviePilot, Flixster, Criticker, MovieLens, taste.io, Plex). Grant appeal and investor appeal are deliberately not scored.

Method: local scorers from the `brand` package, live availability checks with curl, and one parallel AI deep-dive per name (no web access for the agents, so their remarks on other products come from model knowledge and are unverified). Cross-linguistic languages: en, fr.

## 1. Availability Re-verification (2026-09-30)

Method: `curl -s -o /dev/null -w '%{http_code}'` against `https://pypi.org/pypi/<name>/json`, `https://pypi.org/simple/<name>/` and `https://registry.npmjs.org/<name>` (404 = free). GitHub search was not queried. Second half of the table checks the hyphenated spelling of each name on PyPI and npm.

| Name | PyPI json | PyPI simple | npm | Hyphenated variant | Variant PyPI | Variant npm | `import` in current env |
|---|---|---|---|---|---|---|---|
| reelpick | 404 | 404 | 404 | reel-pick | 404 | 404 | not found |
| flickpick | 404 | 404 | 404 | flick-pick | 404 | 404 | not found |
| cinepick | 404 | 404 | 404 | cine-pick | 404 | 404 | not found |
| watchnext | 404 | 404 | 404 | watch-next | 404 | 404 | not found |
| nextflick | 404 | 404 | 404 | next-flick | 404 | 404 | not found |
| reelsense | 404 | 404 | 404 | reel-sense | 404 | 404 | not found |
| cinesense | 404 | 404 | 404 | cine-sense | 404 | 404 | not found |
| reelwise | 404 | 404 | 404 | reel-wise | 404 | 404 | not found |
| reelscout | 404 | 404 | 404 | reel-scout | **200** | 404 | not found |
| cinescout | 404 | 404 | 404 | cine-scout | 404 | 404 | not found |
| moodreel | 404 | 404 | 404 | mood-reel | 404 | 404 | not found |
| kinome | 404 | 404 | 404 | - | - | - | not found |
| whichflick | 404 | 404 | 404 | which-flick | 404 | 404 | not found |
| cinesift | 404 | 404 | 404 | cine-sift | 404 | 404 | not found |

Result: all 14 exact strings return 404 on PyPI (both endpoints) and npm, so all 14 are confirmed free today.

PyPI normalization (PEP 503) lowercases and collapses runs of `-`, `_` and `.` into a single `-`, but it does not delete separators. So `reel-pick`, `reel_pick` and `Reel.Pick` are one project, and `reelpick` is a different project. There is no hard collision for any candidate. The practical risks are typos and installing the wrong package. npm's registry policy additionally rejects new names that differ from an existing name only by punctuation, so claiming the un-hyphenated form also blocks the hyphenated form there (from general knowledge, not tested here).

**One real near-collision: `reel-scout` exists on PyPI (v1.4.2, a short-form video analysis tool for YouTube Shorts, Instagram Reels and TikTok).** `reelscout` is technically free, but `pip install reel-scout` and `pip install reelscout` are one hyphen apart, search engines will conflate them, and an AI agent guessing the install command can pick the wrong one. This costs `reelscout` in the ranking below. The other hyphenated variants are all free.

Shadowing check: none of the 14 imports in the current Python environment, none is a standard-library module, and none matches a popular PyPI or npm package that I know of. Notes from knowledge: `kinome` is an established biology term (the set of protein kinases in a genome) with no package clash but heavy search competition; `sift` (half of `cinesift`) is a real package name and the SIFT computer-vision algorithm; `watchnext` and `nextflick` are generic phrases that may exist as small GitHub repos or extensions (GitHub was not searched); no candidate shadows a stdlib or popular module.

## 2. Comparative Metrics Table

Metrics identical across all 14 candidates, omitted from the table: novelty 1.0 (none is an English word), existing_word false (none), substring hazards none, harsh clusters 0, repeating pattern none, stress pattern 'unknown' (the pronouncing dictionary has none of them), and cross-linguistic word frequency empty (none is a known word in English or French; the check covers en and fr only, and Japanese was excluded as MeCab is not installed). Only 'reelsense' and 'cinesense' contain a catalogued positive morpheme ('sen').

Caveat on entropy: the pronunciation-entropy scorer does not model the silent final 'e', so every 'cine-' name and 'kinome' is inflated. `cinesense` (8.95 / 10.02 bits) is the extreme case. Compare entropy across the 'cine-' family, or across the non-'cine-' family, rather than between them.

| Name | Syl | Len | Brand | Spell | H-en | H-en/fr | V/C | Uniq | Kbd | Sound |
|---|---|---|---|---|---|---|---|---|---|---|
| reelpick | 2 | 8 | 0.7825 | 0.94 | 2.046 | 2.484 | 0.375 | 0.875 | 3.0 | modern/sharp |
| flickpick | 2 | 9 | 0.7338 | 0.89 | 3.809 | 4.686 | 0.222 | 0.667 | 3.95 | modern/sharp |
| cinepick | 3 | 8 | 0.8087 | 0.88 | 5.782 | 6.959 | 0.375 | 0.75 | 4.47 | modern/sharp |
| watchnext | 2 | 9 | 0.7533 | 0.78 | 5.265 | 6.338 | 0.222 | 0.889 | 2.75 | balanced/modern |
| nextflick | 2 | 9 | 0.7038 | 0.89 | 4.375 | 5.206 | 0.222 | **1.0** | 3.47 | modern/sharp |
| reelsense | 2 | 9 | 0.8247 | **1.0** | 4.522 | 4.856 | 0.444 | 0.556 | 3.08 | balanced/modern |
| cinesense | 3 | 9 | 0.8213 | 0.94 | 8.951 | 10.024 | 0.444 | 0.556 | 2.97 | modern/sharp |
| reelwise | 2 | 8 | 0.8237 | **1.0** | 4.681 | 4.977 | 0.5 | 0.75 | 3.95 | balanced/modern |
| reelscout | 2 | 9 | 0.8233 | 0.83 | 3.334 | 3.466 | 0.444 | 0.889 | 3.23 | balanced/modern |
| cinescout | 3 | 9 | 0.82 | 0.78 | 6.767 | 7.645 | 0.444 | 0.889 | 3.12 | balanced/modern |
| moodreel | 2 | 8 | **0.8762** | 0.94 | **1.283** | **1.283** | 0.5 | 0.75 | **2.49** | balanced/warm |
| kinome | 2 | **6** | 0.8612 | **1.0** | 4.943 | 5.969 | 0.5 | **1.0** | 2.95 | balanced/modern |
| whichflick | 2 | 10 | 0.7018 | 0.8 | 4.414 | 5.388 | 0.2 | 0.7 | 3.76 | modern/sharp |
| cinesift | 3 | 8 | 0.7825 | 0.94 | 6.269 | 7.446 | 0.375 | 0.875 | 3.55 | modern/sharp |

**Metric explanations:**

- Syl: syllable count from the scorer (it counts `kinome` as 2; a human reader may say 2 or 3).
- Len: letters in the name (shorter is easier to type and remember).
- Brand: composite brandability score, 0 to 1 (higher is better; it blends length, letter variety, vowel/consonant balance and morphemes).
- Spell: spelling transparency, 0 to 1 (how reliably the letters map to one pronunciation).
- H-en: pronunciation entropy in bits for English only (lower means less ambiguity in how it is said).
- H-en/fr: pronunciation entropy when English and French readings are pooled (lower means more stable across both languages).
- V/C: vowel-to-consonant ratio (very low values, under 0.25, read as consonant-heavy).
- Uniq: share of distinct letters (higher means less repetition).
- Kbd: mean keyboard travel distance between successive letters (lower is faster to type).
- Sound: sound-symbolism profile from front/back vowel and voiced/voiceless ratios.

### Visual Balance

| Name | Ascenders | Descenders | Neutral | Character |
|---|---|---|---|---|
| reelpick | 0.25 | 0.12 | 0.62 | balanced, some vertical rhythm, has a descender (k/p) |
| flickpick | 0.44 | 0.11 | 0.44 | tall and dense, ascender-heavy, has a descender (k/p) |
| cinepick | 0.12 | 0.12 | 0.75 | balanced, some vertical rhythm, has a descender (k/p) |
| watchnext | 0.33 | 0.0 | 0.67 | balanced, some vertical rhythm |
| nextflick | 0.44 | 0.0 | 0.56 | tall and dense, ascender-heavy |
| reelsense | 0.11 | 0.0 | 0.89 | even and calm, almost no ascenders |
| cinesense | 0.0 | 0.0 | 1.0 | even and calm, almost no ascenders |
| reelwise | 0.12 | 0.0 | 0.88 | even and calm, almost no ascenders |
| reelscout | 0.22 | 0.0 | 0.78 | balanced, some vertical rhythm |
| cinescout | 0.11 | 0.0 | 0.89 | even and calm, almost no ascenders |
| moodreel | 0.25 | 0.0 | 0.75 | balanced, some vertical rhythm |
| kinome | 0.17 | 0.0 | 0.83 | balanced, some vertical rhythm |
| whichflick | 0.5 | 0.0 | 0.5 | tall and dense, ascender-heavy |
| cinesift | 0.25 | 0.0 | 0.75 | balanced, some vertical rhythm |

### Key Phonetic Neighbors

| Name | Notable neighbors (Datamuse) | Flag |
|---|---|---|
| reelpick | relique, relic, rollback, repack, rollick, roll back, rule book, relik | relic, rollback |
| flickpick | philippic, flicka, flyspeck, flicking, flicky, fake book, flatpack, flat pack | flick-family, flip book |
| cinepick | synoptic, sinitic, cynic, sinic, syndic, synodic, snowpack, salopek | cynic, cynique |
| watchnext | what next, wannest, onex, watch night, the next, witnessed, watchlist, watch list | watchlist, what next |
| nextflick | nextly, netflix, next life, mixtec, westlake, west lake, systolic, sextile | netflix (trademark-confusion flag: one syllable-shape away from Netflix) |
| reelsense | reliance, recense, real ones, reasons, resigns, rhesus, resis, recency | reliance, recency |
| cinesense | sentience, senescence, sentence, seasons, sentance, cynism, simians, sanious | sentience, sentence |
| reelwise | relies, railways, relays, real ones, relieves, railway, rallies, rallys | railways, relays |
| reelscout | relocate, girl scout, rollerskate, roller skate, relict, risk it, roller-skate, ruleset | girl scout, roller skate |
| cinescout | sinusoid, synesthete, sonicate, sunny skies, sneak out, sea scout, soonest, sinuses | sea scout |
| moodreel | madril, mood ring, moodle, mitral, morrill, meriel, madill, madri | moodle (learning platform), mood ring |
| kinome | keenum, keenan, keening, keeno, keen on, canam, canem, came home | keenan, came home |
| whichflick | chick flick, wifelike, waiflike, wirklich, chick flicks, nikolic, willock, one click | chick flick (gendered genre echo) |
| cinesift | sunset, sensify, sun set, sniffed, sensate, snift, snuffed, sehnsucht | sunset, sniffed |

The 'oh, it sounds like X' test: the only neighbor that touches the movie space is `netflix` for `nextflick`, and it matters because the goods are identical (choosing what to watch). `chick flick` for `whichflick` is a tone risk rather than a trademark risk. No candidate's neighbors include JustWatch, Reelgood, Letterboxd, Trakt, MoviePilot, Flixster, Criticker, MovieLens, taste.io or Plex. The lexical relatives to keep in mind are Reelgood (shares 'reel' with reelpick, reelsense, reelwise, reelscout, moodreel) and Flixster (a mild 'flick/flix' echo for the -flick names).

### AI Scores per Name (1-10, from the deep-dives)

Weighted total uses weights memorability 2, says-movie-picking 2, domain fit 1.5, EN/FR pronounceability 1.5, low-confusion 2, agent-friendliness 1. The scores are one model's judgment per name and are useful for ordering, not as measurements; ties within about 0.3 are noise.

| Rank | Name | Memo | Says-picks | Domain | EN/FR | Low-confusion | Agent | Weighted |
|---|---|---|---|---|---|---|---|---|
| 1 | cinepick | 7 | 9 | 8 | 7 | 8 | 9 | 7.95 |
| 2 | flickpick | 8 | 9 | 7 | 8 | 6 | 9 | 7.75 |
| 3 | reelpick | 7 | 9 | 8 | 8 | 6 | 9 | 7.7 |
| 4 | cinescout | 7 | 8 | 8 | 7 | 6 | 9 | 7.35 |
| 5 | cinesift | 7 | 7 | 8 | 6 | 7 | 9 | 7.2 |
| 6 | watchnext | 7 | 9 | 8 | 6 | 5 | 8 | 7.1 |
| 7 | moodreel | 8 | 6 | 6 | 9 | 6 | 8 | 7.05 |
| 8 | whichflick | 7 | 9 | 8 | 5 | 6 | 7 | 7.05 |
| 9 | reelsense | 7 | 6 | 7 | 7 | 7 | 9 | 7.0 |
| 10 | nextflick | 7 | 9 | 7 | 7 | 4 | 8 | 6.9 |
| 11 | cinesense | 7 | 5 | 8 | 7 | 7 | 8 | 6.85 |
| 12 | reelscout | 7 | 7 | 7 | 8 | 5 | 6 | 6.65 |
| 13 | reelwise | 7 | 6 | 7 | 7 | 5 | 8 | 6.5 |
| 14 | kinome | 8 | 4 | 6 | 7 | 6 | 8 | 6.35 |

---

## 3. Individual Deep-Dive Analyses

### 1. reelpick

"reelpick" is a plain compound of two English words, "reel" (a film reel, so cinema by metonymy) and "pick" (to choose). There are no obscure morphemes, and the scorer finds none because both parts are whole words. The name reads as "pick a reel", or "pick from the reels". That is close to a one-line spec of the product: it picks movies for you. The compound is transparent and needs no explanation. The cost is that it isn't a coined word. Its novelty score of 1.0 means no existing dictionary word, and it does not mean the parts are unusual. "Reel" also carries a small secondary meaning (short-form video, as in Instagram Reels), which slightly muddies the cinema signal for younger readers.

Pronunciation in English is easy: /riːl.pɪk/, two syllables, stress on the first. The spelling-transparency score (0.94) and the moderate entropy (2.05 bits in English) agree that few people will hesitate. The one soft spot is the "l" to "p" join, which is a little clipped, and it can be misheard as "real pick" (the phonetic neighbors show "relic", "relik" and "rollick", but those are distant). Saying it aloud to an AI voice agent or a friend is unambiguous enough, though "real pick" is a plausible mishearing. In French the entropy rises to 2.48 bits, and the difficulty is real but small. A French speaker will likely say /ʁil.pik/ or /ʁil.pik/ with a tense, short "i" (the English long "ee" in "reel" becomes a French "i"), a uvular r, and no aspirated "p". That is perfectly comprehensible and even pleasant, but it will sound a bit like "rile-pick" only to speakers who read "ee" oddly, which is rare. The "ee" digraph is well known in French from English loans ("week-end", "speed", "reel" in dance), so the risk is low. "Pick" is also familiar via "pick-up" and "pickpocket".

Sound feel is modern, brisk and slightly sharp (front vowels 1.0, voiceless share 0.6). The long "ee" is followed by a hard "k" stop, so the name feels crisp and decisive, which suits a tool whose job is to decide. Visually it is eight lowercase letters with a nice rhythm: "reel" and "pick" have equal length and both end in a tall-ish letter cluster, and "ll" next to "pk" gives a balanced, typeable shape. There are no diacritics, no hyphen and no awkward capitalization. In lowercase, `reelpick`, `reelpick recommend` and `import reelpick` all look natural. The keyboard distance score of 3.0 is comfortable, with alternating hands.

Domain fit is strong. It says movies (reel) and choosing (pick), and it says nothing about being social, a database, or streaming. That matches an app whose core act is "choose a film for this person", and it leaves room for the scientist side (statistics on picks, calibration of recommendations) because "pick" is also a statistical word (a pick, a sample). It suits an agent-facing tool well: an AI can call `reelpick.pick(user)` or `reelpick pick --tonight`, and the verb in the package name matches the verb in the call, which is a real ergonomic gain. It reads as a hobby or indie project rather than a startup brand, since it is descriptive and modest rather than aspirational.

Confusion risk is low but not zero. Among the listed services, the closest is Reelgood, which shares the "reel" stem and is a well-known streaming guide and tracker, so people may assume a relation or a typo of "reelgood". Letterboxd, Trakt, JustWatch, MoviePilot, Flixster, Criticker, MovieLens, taste.io and Plex have no lexical overlap. "Pick" is also used by "Movie Picker" style apps and various "pick a movie" randomizers, and "reel"-prefixed names are very common in film tech (Reelgood, ReelSpeed, Reel Rebel and similar), so the space is crowded even if the exact string is free. Being free on PyPI and npm is a real advantage, but it does not guarantee that a domain, a GitHub org name or an app-store name is free, and that should be checked before committing.

**Arguments for**
- Transparent and self-explanatory: "reel" plus "pick" says "picks movies" with no explanation.
- Verb in the name matches the API verb, so it is natural in code, CLI and agent tool calls.
- Easy to type, spell and say in English, and acceptable in French.
- Modest, hobby-appropriate tone, with room for the statistics side.
- Free on PyPI and npm today.

**Arguments against**
- Generic compound: weak distinctiveness and hard to trademark, and search results will be noisy ("reel picks", "movie picks").
- Shares the "reel" stem with Reelgood, which is the one real confusion risk.
- "Reel" now also means short-form video, which dilutes the cinema meaning for some readers.
- Possible mishearing as "real pick", and a French speaker may waver on the "ee".
- Says nothing about AI, personalization or science, so the differentiators are absent from the name.

Scores (1-10): memorability 7, says-movie-picking 9, domain fit 8, EN/FR pronounceability 8, low-confusion 6, agent-friendliness 9

### 2. flickpick

**Etymology and structure.** "Flickpick" is a plain compound of two English words. "Flick" is casual slang for a movie, and it comes from the flickering of early projected film. "Pick" is the verb and noun for choosing. The name reads as "the movie pick", "pick a flick", or "a flick picker", so the parse is nearly instant. Neither morpheme is obscure, and the metrics find no hidden roots. The compound is unregistered in English and French, which explains the novelty score of 1.0. The phonetic neighbours (flyspeck, flicking, flip book, philippic) are all distant. None of them belongs to the movie or software world, so they are unlikely to cause real confusion.

**Pronunciation.** English speakers will say /ˈflɪk.pɪk/ without hesitation. Spelling transparency is high at 0.89, and the only soft spot is the "i" grapheme. A French speaker will also get there, but with accent-shaped drift. The initial "fl" cluster is easy for French speakers. The short /ɪ/ tends to become a tenser /i/, giving roughly "flik-pik". The final /k/ will be clearly released, so it will not sound like an English coda. Some French speakers will fall back on "flick" as an anglicism. French already borrows "flic", which means cop, and "flick" is close enough to raise a smile, though the spelling differs. The name will not confuse anyone. The main cost is that the "-ick pick" jingle is a tongue-twister when repeated quickly, and the entropy figures (3.8 bits for English, 4.7 for English plus French) are moderate.

**Sound and look.** The sound is sharp and modern, with front vowels and voiceless stops. That gives a crisp, playful, slightly retro feel that suits a hobby project. The repeated "ick" is the name's hook and also its main flaw. It rhymes internally, so it sticks in the head, but it is also a little cutesy and a little gross ("ick"). Visually it is nine letters with two "ck" endings. It looks a bit dense in lowercase. In one word it reads clearly, and in camel case ("FlickPick") the compound structure is obvious.

**Domain fit and agent use.** It says "movies" and "choosing" outright, and few candidate names describe the product this directly. It is also typeable and lowercase-safe: `pip install flickpick`, `flickpick recommend`, `import flickpick`. Agents and LLMs will handle it well because it is two ordinary tokens and it self-describes in a tool listing. The weaker fit is the scientist side. The name suggests a fun consumer app, not statistics or a methodology package. A name that hints at rigour would serve that audience better, though a hobbyist tone fits the indie positioning. Some readers may also take the name for a simple random picker, less than the AI-driven personal recommender it is.

**Confusion risk.** None of the listed services (JustWatch, Reelgood, Letterboxd, Trakt, MoviePilot, Flixster, Criticker, MovieLens, taste.io, Plex) is close. The nearest share is the "Flick"/"Flix" family: Flixster and the many "flix" names, plus generic "Flick" apps and the older "Flickr" (a photo site, and a typo trap: "flickpick" versus "flickr"). "Pick a flick" is also a common phrase and a plausible slogan or name for other apps, so trademark and app-store clashes are likely even though PyPI and npm are free. Be honest that a "clear on PyPI/npm" result says nothing about the App Store, domains, or social handles.

**For.** The name is instantly understood, easy to say and spell, playful, and fits an indie project. It is agent-friendly and has good SEO potential ("pick a flick"). It is fully available in both registries and unique as a token.

**Against.** The compound is generic and descriptive, so it is hard to trademark and easy to duplicate. The repeated "ick" is cutesy, a mild tongue-twister, and slightly unserious for the scientific side. "Flick" is dated slang, and it may carry a "cheap movie app" tone. The name also fits a random picker better than an AI recommender with statistics.

Scores (1-10): memorability 8, says-movie-picking 9, domain fit 7, EN/FR pronounceability 8, low-confusion 6, agent-friendliness 9

### 3. cinepick

**Etymology and structure.** "cinepick" is a plain compound of two morphemes: "cine" (from Greek *kinema*, via French *ciné* and Italian/Spanish *cine*, meaning motion or film) and "pick" (English, to choose or select). The two parts are easy to see, so the name reads at once as "film pick", and that is what the project does. It isn't a dictionary word in English or French, so nobody has a prior meaning for it and the name is free to be coined. The scorer reports no morphemes, but that is a tooling gap, because a human sees both halves immediately. The name is also grammatically useful. "Pick" works as a verb, so `cinepick recommend` and "let cinepick pick" read naturally as commands. It also works as a noun: "tonight's cinepick".

**Pronunciation.** In English the natural reading is "SIN-ih-pick" (/ˈsɪnɪpɪk/), with a soft c and a short i in the middle. There is a real ambiguity in the middle syllable. Some speakers will say "SIN-ee-pick", and some will say "SIN-ay-pick", as in "cine" from "cinephile" or "cinema". The final e is silent, which the entropy scorer doesn't model, so the ent_en=5.78 figure is probably inflated. Real spelling-to-sound uncertainty is lower than the number suggests. A French speaker would parse "ciné" first and say something like "see-nay-PEEK" (/sine.pik/), with stress on the last syllable and an ordinary French /i/ in "pick". The French reading is closer to the intended etymology than the English one, and it is easy to say. The remaining wrinkle is that a French speaker may want to drop the final "e" of "cine" as if it were a spelled accent, and may say "ciné-pique". "Pick" has no French word to collide with, so the mistake would be harmless. The phonetic neighbors (synoptic, cynic, cynique, canopic) are not an issue. They are rare or unrelated words, and "cynique" is only vaguely similar.

**Sound feel and visual impression.** The sound profile is modern and sharp: front vowels, voiceless consonants (c, p, k), and a crisp "-ick" ending. The name has three syllables, eight letters, a low vowel-to-consonant ratio of 0.375, and a hard stop at the end, so it feels quick and decisive, more like a tool than a boutique brand. It is all lowercase and looks clean in a terminal, in a URL, and in a `pip install` line. The "ne" and "pi" pairs give it a light rhythm. The one visual weakness is that "cinepick" can be misread as "cine-pick" or "cinep-ick". A capital P (CinePick) fixes that in prose, but the package name will always be lowercase. The 8-letter length, the lack of hyphens, and the lack of punctuation make it easy to type. The keyboard distance score (4.47) is unremarkable.

**Domain fit and confusion risk.** The name says "movie" more directly than most of the listed services. JustWatch, Reelgood, Trakt, Criticker, and Plex use metaphors or generic words, and Letterboxd and MovieLens name a thing. "cinepick" says both the domain and the action. None of the named competitors are close: no shared roots, no near-homophones, and no overlap in the "cine" plus "pick" combination. The nearest look-alikes are the many small "cine-" names in the film world (Cinemark, Cinepolis, Cinephile, Cinemap, Cinebench) and generic "-pick" names, but nothing in that group is a recommender that I know of. I cannot rule out unrelated small products or repos with similar names, and this analysis did not search for them. The novelty score of 1.0 and the free PyPI and npm names are consistent with this, but they only show the exact string is unclaimed, not that trademark or search-result confusion is impossible.

**Fit for an indie, agent-called project.** The name works well for the intended use. It is one lowercase token with no hyphens, so it is valid as a PyPI package, npm package, CLI command, import name (`import cinepick`), and MCP tool prefix without any translation between ecosystems. Agents can spell it from the description alone, and "pick" signals what the tool returns: a choice, not a list. This matters for AI agents, which need to know whether a tool gives options or a decision. It is also a friendly, hobbyist-scale name, not a startup one. The "for scientists" statistics side is where it fits less well. "cinepick" sounds consumer-facing and casual, and a paper reporting recommender evaluation would read more naturally as citing a name like "MovieLens". That is a mild issue, since a sub-namespace (`cinepick.stats`) can carry the science branch under the same brand.

**International considerations.** The "cine" root is understood in French, Spanish, Italian, Portuguese, and Romanian, so the name has an unusually wide comprehension base in Europe and Latin America. English speakers know it through "cinema" and "cinephile". "Pick" is the only English-only part, and it is a very basic word. In Spanish or Italian the "-ick" ending is unusual, but it is still pronounceable. One caution: "cine" is a standard word for "cinema" in Spanish, so the name reads as slightly generic there, like "film-pick". I see no offensive or awkward meaning in the major languages, but I have not checked non-European ones.

**Arguments for.** The name is self-explanatory and says what the tool does, and a verb-and-noun structure makes it read well in commands and sentences. It is short, typeable, and consistent across PyPI, npm, and the CLI. It works in English and French, and the French reading is natural. It is free on both registries and doesn't resemble any of the listed services. It sounds sharp and modern, and it suits a personal, indie project with no corporate feel.

**Arguments against.** The name is descriptive, so it is easy to remember but hard to protect and not very distinctive. "cine-" plus a verb is a common naming pattern, so it may blend in with unrelated small projects in search results. The English pronunciation is ambiguous (SIN-ih vs SIN-ee vs SIN-ay), so spoken mentions and voice-agent use may produce a wrong spelling. It says "movie" but not "AI", "personal", or "statistics", so it doesn't signal the differentiators. It leans casual for the scientific side. It is also limited to film: if the project grows to TV, series, or other media, the name will start to feel narrow.

Scores (1-10): memorability 7, says-movie-picking 9, domain fit 8, EN/FR pronounceability 7, low-confusion 8, agent-friendliness 9

### 4. watchnext

**Etymology and structure.** "watchnext" is a compound of two plain English words, the verb "watch" and the adverb or adjective "next", with no invented morphemes and no coinage. It reads as an imperative or a queue label: "watch next". That phrase is already ordinary vocabulary on streaming platforms ("Up next", "Watch next", the watchlist). This makes the name instantly decodable to any English speaker. It also means the name isn't distinctive as a coinage. The metrics agree. Novelty scores 1.0 only because the string is unregistered as one token. The phonetic neighbors are "what next", "watch night", "watchlist" and "the next", which shows how close it sits to everyday phrases.

**Pronunciation.** In English it is /ˈwɒtʃ nɛkst/ or /ˈwɑtʃ nɛkst/, two clear syllables with a stress on "watch". The "tch" and "x" are unambiguous. The word boundary is visible to a reader, though the "chn" junction is slightly awkward to say quickly, and "-xt" can get clipped to "nex" in casual speech. Entropy of 5.27 bits in English is moderate. The French entropy of 6.34 bits is higher, and that is realistic. A French speaker will probably say "ouatch-nexte" or "ouatch-nèkst". The initial "w" is fine (French knows "watt", "wagon", "week-end"), but "tch" is rendered as "tch" or sometimes softened to "ch". The final "kst" cluster is heavy for French phonotactics, so "nexte" with an added schwa is likely. It is usable, and a French speaker who knows English would get it right. One who doesn't would still recognise the written form as "watch" because of the loanword "watch" in fashion and sport contexts. It is not elegant in French, but it is not a barrier.

**Sound and visual feel.** The sound profile is balanced and modern (front-vowel 0.5, voiceless 0.75). That means crisp, slightly clipped, and unsentimental. Visually, nine letters in lowercase read cleanly as one token. The "tch" plus "nx" middle is a little dense, and camelCase or a hyphen ("watch-next", "WatchNext") is often needed to help the eye find the boundary. In a terminal it looks like a command. In a logo the "x" is a nice terminal glyph, but the name doesn't have an obvious mark. The "watch" opening also evokes a wristwatch or "watch mode" (as in file watchers).

**Domain fit and "picks movies for me".** This is the name's strongest quality. "Watch next" states the exact outcome the user wants, which is the answer to "what should I watch next?". It works as both a question and an answer, and an AI agent can call it literally: `watchnext pick`, `watchnext recommend`. It also covers TV, so it doesn't lock the project to film. The weaker point is that it says nothing about AI, personalisation or statistics. It doesn't hint at the "for scientists" side, and it sounds like a consumer queue feature more than a research-grade recommender. It suggests one recommendation, not a ranked model with uncertainty.

**Confusion risk.** None of the named services (JustWatch, Reelgood, Letterboxd, Trakt, MoviePilot, Flixster, Criticker, MovieLens, taste.io, Plex) use the name, and it is lexically distinct from all of them. The partial overlap is with "JustWatch" (shared "watch"). The larger risk is generic. "Watch Next" is a feature label in YouTube, Netflix-style UIs and Google's "Watch next" surface, and likely the name of many small apps, browser extensions and GitHub repos. Search results will be noisy, and it will be hard to own the term. Trademark protection is weak for a descriptive phrase, though a hobby project is unlikely to care. Only PyPI and npm availability was checked. I'd also check GitHub org/repo names, domains and app-store listings.

**Arguments for.** It is instantly understood, says what the tool does, and is easy to type and spell. It works as a CLI verb and is friendly to agents, since the tool name reads like the task ("watchnext" answers "what to watch next"). It is free on PyPI and npm. It is neutral, with no cultural baggage, and it fits a hobby project without startup pretension. It is also easy to remember because it is a phrase people already say.

**Arguments against.** It is generic, so search discoverability and brand ownership are poor. It is a phrase rather than a brand, which makes it feel like a feature and not a project. It doesn't signal AI, taste modelling or the statistical side. Pronunciation in French is workable but clunky, with the "tch" and the "kst" cluster. The compound needs a visible boundary (a capital N or a hyphen) to be read comfortably. "Watch" collides with the file-watcher and wristwatch senses in developer contexts, e.g. `--watch` flags, which could confuse agents choosing tools by name. Finally, it's crowded semantically, since every streaming app has a "watch next" row.

Scores (1-10): memorability 7, says-movie-picking 9, domain fit 8, EN/FR pronounceability 6, low-confusion 5, agent-friendliness 8

### 5. nextflick

**nextflick** is a compound of two ordinary English words, "next" and "flick." "Next" carries the promise of the answer: what should I watch next? "Flick" is casual English slang for a movie, and it survives from "the flicks" (cinema) and the flicker of early projection. There are no hidden morphemes. It is a transparent, self-explanatory compound. The whole name reads as a question the user is already asking, "what's my next flick?", and the tool answers it. That is close to a perfect verbal match for a recommender whose job is to choose the next movie.

Pronunciation is easy in English: /nɛkst flɪk/, two syllables with a clean stress on each word. The one hazard is the consonant cluster at the join. "Xtfl" is three consonants in a row, and speakers may drop the "t" and say "nex-flick." That is harmless, and it makes the name sound even more like "Netflix" (see below). For a French speaker, "next" is well known from "next" and "le prochain," and "flick" is understandable to anyone who has met anglophone film slang. A French speaker would probably say /nɛkst flik/ with a lighter, less aspirated "k." They may pronounce the "-ick" with a tense French "i" ("fleek"), and the cluster may get a schwa inserted ("nex-teuh-flik"). Neither is a real barrier. The entropy figures (4.375 bits in English, 5.206 with French) mark it as fairly predictable in English and less so across both languages, which matches that picture. Spelling is transparent (0.89), and the only slightly odd grapheme is the "ck" in "flick," which is very common.

On sound and look, the metrics say "modern/sharp": front vowels, a mostly voiceless consonant profile, and an ascending neutral profile. It looks like a tech-product name, with hard "x" and "k" letters bracketing a tidy nine-character word. Lowercase "nextflick" is easy to read in a terminal and would look good as a logo or CLI command. As a web domain it is clear and typeable, though "flick" gives it a slightly playful, consumer-app feel rather than a scientific one. That matters for the "for scientists" side: nobody will guess that the statistics module lives here, though nothing about the name works against it either.

For AI agents, the name is good. It is one lowercase token with no hyphens or underscores, and it has an obvious verb reading: "nextflick pick," "nextflick recommend," and "nextflick rate" all make sense. An agent asked to "get the next movie" will find the name easy to associate with the task. Both package registries are free, and it is an unambiguous import name (`import nextflick`). The length is fine, though nine characters is a little long for a frequently typed CLI, so an alias such as `nf` or `flick` might be wanted.

The serious problem is confusion. Phonetically it sits very close to "Netflix," which is confirmed by the phonetic-neighbor list. "Next" plus "flick" is structurally a Netflix pun: both start with "Net/Nex," both have a "fli/fl" syllable and end in a hard "k/x." A hasty listener or a voice assistant may hear "Netflix," and search results, autocomplete and speech recognition may all confuse them. Netflix's trademark is large and aggressively defended, so a movie-related name that is one letter-and-consonant away is the most likely to draw an inquiry, even though it is a hobby project. Trademark law weighs sound, appearance and the relatedness of goods, and here the goods are the same (movie choice). The other listed services (JustWatch, Reelgood, Letterboxd, Trakt, MoviePilot, Flixster, Criticker, MovieLens, taste.io, Plex) are not close in sound. "Flixster" is the only real neighbor through "flick/flix," and it is a mild one. I cannot verify other products called "NextFlick" and did not search, and generic names like this often exist as small apps or sites, so a manual search before committing is sensible.

**Arguments for.** It explains itself immediately. It is memorable, playful and easy to say. It works in a CLI, in an import statement and in an agent's tool list. It has a clear verb-like reading, and the registries are free. "Flick" is friendly and non-corporate, which suits a hobby project.

**Arguments against.** The Netflix resemblance is a real risk, both legally and in search and voice. The "next" prefix is generic and used by many products, which weakens distinctiveness (novelty scored 1.0, but that measures the string, not the concept). "Flick" is dated slang and is more common in British and Commonwealth English, so it may read as odd to some Americans and French speakers. The name says nothing about AI, statistics or science, and it commits the project to "movies only" if it later covers series. The consonant cluster is a little awkward when spoken quickly.

Overall it is a good descriptive name with one significant flaw. I would use it if the project stays small and accept the Netflix risk knowingly. If any commercial or wider use is planned, I would pick a name that does not echo Netflix.

Scores (1-10): memorability 7, says-movie-picking 9, domain fit 7, EN/FR pronounceability 7, low-confusion 4, agent-friendliness 8

### 6. reelsense

"Reelsense" is a compound of two plain English words: "reel" (film reel, so cinema and the act of watching) and "sense" (taste, judgment, intuition, also "sense-making" and "to sense"). The metrics show only "sen" as a morpheme root, but a reader will parse it as "reel" + "sense" at once. The reading is "a sense for films", or "movie sense", as in a good sense of taste. That maps well onto a personal recommender, because a recommender is a taste model. It also fits the "for scientists" side. "Sense" carries measurement connotations (sensor, sensing, sense-making), so it works for statistics and taste-estimation work without sounding like a consumer streaming brand.

Pronunciation in English is easy: "REEL-sense", two clean syllables, stress on the first, spelling fully transparent (spelling_transp 1.0). The one wrinkle is the "-ls-" join. Fast speech tends to blur it toward "REEL-sense" versus "reel-since", but both are fine. The phonetic neighbors (reliance, recency, reasons) are loose and not confusable in practice. A French speaker will say something like "ril-SANSS", with a stressed final syllable, a French "r", and probably a slightly long "i". The vowel in "sense" is not nasalized in English, but a French reader may reach for the nasal "sens" [sɑ̃] from the word "sens", giving "ril-sɑ̃s". That is not a problem, and it accidentally reinforces the meaning, since "sens" in French also means "meaning" or "direction". Two caveats. The "ee" is unfamiliar as a "reel" spelling for many French speakers, who know "reel" mostly from social media (Instagram Reels). And "reel" is a common English loanword with a slightly different sound. The entropy scores (4.52 EN, 4.86 EN+FR) are moderate, driven by the two "e" graphemes, so a French reader may hesitate on "ee" and on the "se/ce" ambiguity, but the name will be recovered on the second try.

The sound feel is balanced and modern: front vowels, soft sibilants, no harsh consonants. Visually it is a compact nine-letter lowercase word with a repeated "s"/"e" rhythm ("reel" / "sense") that reads as clean and friendly. It sits well as a lowercase package name and a logo wordmark. The camel-case "ReelSense" split makes the compound obvious.

Domain fit is strong: "reel" anchors it in film. But "reel" has moved a lot in the last few years toward short vertical video (Instagram Reels, YouTube Shorts, TikTok clips). A new reader could half-expect a short-video tool, a reel-editing app or a social-video analytics product. It says "movies" less crisply than "film" or "cine" would, and "reel" hints at footage rather than feature films to watch. Still, for a hobby recommender that is a small cost.

Confusion risk with the listed services is low. Reelgood is the closest, since it shares "reel", and a casual listener could conflate "Reelgood" and "Reelsense" as similar-sounding cousins in the same aisle. The differences are enough that a package, CLI or repo will not be mistaken for it, but it is worth knowing that any search for "reel" plus a recommender will surface Reelgood first. Beyond the list, the "-sense" suffix is heavily used across tech (Sensei, Pulsense, many "-sense" SaaS names, and sensor and health-tech brands), and "reelsense" as a string may well already exist as a small company, domain or social handle in video or AI-video tooling. I can't check that here, so treat it as unverified. Availability on PyPI and npm is confirmed free, which is what matters for the package. A .com or GitHub org may be a separate question.

For agents, the name is a good fit. It is all lowercase, one token, ASCII, with no hyphen, digit or underscore, so it works cleanly as `pip install reelsense`, `npx reelsense`, a `reelsense` CLI and an MCP tool namespace. It is easy to type (a few same-hand letter runs but no awkward stretches) and easy for an LLM to spell back correctly. A weakness is that an agent seeing the bare name "reelsense" learns nothing about what it does unless the description says so. It does not contain "rec", "pick" or "watch", so the "it chooses for me" function has to come from the tagline.

**For:** memorable, friendly, easy compound; fine tone for a hobby project; "sense" is bilingual and covers both taste and measurement, so it bridges the consumer and scientist sides; transparent spelling and typing; free on PyPI and npm; low confusion with the listed services; and it works well as a CLI or tool name for agents.

**Against:** "reel" now leans toward short-form social video; the name says "film sense" but not clearly "picks a movie for me"; the "-sense" suffix is crowded in tech, so a search-engine footprint may be hard to win; Reelgood is a near neighbor in sound and concept; and a French speaker may stumble on "reel" (and on "-ee-").

Scores (1-10): memorability 7, says-movie-picking 6, domain fit 7, EN/FR pronounceability 7, low-confusion 7, agent-friendliness 9

### 7. cinesense

**Etymology and structure.** "cinesense" is a clean compound of *cine* (from Greek *kinema*, "movement", by way of French *ciné* and Romance *cinéma*) and *sense* (a real English and French word). It reads two ways: "a sense for cinema", meaning taste or a good nose for film, and "making sense of cinema", meaning sorting a huge catalogue into something legible. Both readings suit a recommender. The second also suits the "for scientists" side, since "sense-making" is the language of data analysis. The compound is transparent, so almost no explanation is needed. It is also not a dictionary word in either language, which helps distinctiveness (novelty 1.0).

**Pronunciation.** In English it is SIN-ih-sens, or SIH-neh-sens, depending on whether "cine" is heard as in "cinema" (SIN-) or as in "cine-club". Most English speakers will say /ˈsɪn.ɪ.sɛns/ and be understood, but there is some drift. The metrics flag c/i/e/s ambiguity, and the silent-e artifact inflates the entropy numbers, so the real spelling risk is lower than 8.95 bits suggests. A French speaker will read "ciné" as /si.ne/ and "sense" as /sɑ̃s/ ("sance"), giving something like "si-ne-sɑ̃s". That is fully pronounceable and even pleasant, and it rhymes with the French word *sens* ("meaning, direction"). So the name has a small bonus in French: *ciné* plus *sens* reads as "movie sense" or "movie meaning". The cost is that the two languages split on the final syllable (/sɛns/ vs /sɑ̃s/), so people will not say it the same way. That does not hurt written or agent use.

**Sound feel and look.** The name is sibilant and front-vowel heavy ("modern/sharp", 1.0 front vowels, mostly voiceless), so it sounds light and clean, closer to a tech or media product than a cinephile institution. The repeated s/n/s/e pattern gives it a soft rhythm, and it is easy to say three times fast. Visually it is nine lowercase letters with no ascenders or descenders, so it looks even and calm in a wordmark. The "ine...ense" echo also makes a natural symmetry. There is nothing to type wrong except the c/s choice (someone might type "sinesense" or "cinesence"), and "sence" is a classic misspelling that autocomplete and search will absorb.

**Domain fit and confusion.** "cine" places it firmly in film, and "sense" implies judgment, taste and perception, which is what a recommender does. It does not say "picks movies for me" outright. A stranger would guess "something about film insight", not "a tool that chooses tonight's movie". Compared with the listed services, it does not collide. JustWatch, Reelgood, Letterboxd, Trakt, Flixster, Criticker, MovieLens, taste.io and Plex are all distinct, and only taste.io shares the "taste" idea, which is a conceptual overlap and not a naming one. MoviePilot's "pilot" connotation of steering is closer to "picks for me" than cinesense is. The one real risk is the generic "Cine-" prefix crowd: many cinema apps, festivals and film clubs use Cine-something, and "sense" is a common suffix in tech (Sensor, Cinesense-style names in analytics or camera products). I cannot check the web here, so a trademark and search-engine check for existing "Cinesense" or "CineSense" products, especially in imaging or film-tech, is worth doing even though PyPI and npm are free. Phonetically it is near "sentience" and "senescence", which is a small semantic bonus (sentient recommender) and a small risk of jokes.

**For.** The name is memorable, compound-transparent and easy to spell once seen. It says film and taste in one glance and lands on "sense-making", which fits the scientist/statistics side as well as the consumer side. It works in French and English without embarrassment, has no direct collision with the named services, and suits an indie, hobby-scale project: friendly, not corporate. It is all lowercase-safe, so it is fine as a PyPI name, an npm name, a CLI command (`cinesense`) and an MCP tool prefix. It is short enough to type, and 9 characters is fine.

**Against.** It does not say "picks movies for me", which is the core promise. "Sense" is vague and could describe analytics, sensors or reviews. The "cine-" space is crowded with generic names, so search discoverability and trademark headroom may be weaker than the free registry status suggests. The c/s ambiguity means people may misspell it ("sinesense", "cinesence") and pronunciation splits between English and French. For agents, `cinesense` is nine characters and typeable, but a CLI verb such as `cinesense pick` would carry the "picks for me" idea the name lacks. It is also slightly long for a daily command.

**Scores (1-10): memorability 7, says-movie-picking 5, domain fit 8, EN/FR pronounceability 7, low-confusion 7, agent-friendliness 8**

### 8. reelwise

**Etymology and morphemes.** The name is a compound of "reel" and "wise". "Reel" is the film reel, the oldest and most universal cinema metonym. "Wise" carries two meanings at once. It suggests wisdom and good judgement, so "picks wisely" and "knows films". It also echoes the adverbial suffix in "clockwise" and "otherwise", which reads as "in terms of reels". The morpheme scorer finds no roots, but the parse is obvious to any English reader. It is not a dictionary word in English or French, so there is no dictionary ambiguity. The novelty score of 1.0 fits that.

**Pronunciation.** In English it is /ˈriːl.waɪz/, two clear syllables with stress on the first. The main risk is spelling from memory: "realwise", "reelwize" and "reel-wise" are all plausible slips. The scorer rates spelling transparency at 1.0, but that measures reading, not writing. A French speaker will probably say "ril-ouaïze". "Wise" is easy enough for them, since /w/ and /aɪ/ both exist in loanwords. Read naively, "reel" tends toward "réel", French for "real", so some will hear "réel-wise", roughly "truly wise". That is a harmless, even pleasant accident. The phonetic neighbours ("railways", "relies", "relays") are a mild concern for spoken recommendation, but nobody will mistake them in context.

**Sound and visual feel.** The scorer gives it a balanced, modern profile, with front vowels and few voiceless consonants. That makes it soft and friendly, not harsh. Visually, the double-e and the w-i-s-e run are clean and symmetrical, and an eight-letter lowercase logotype works well. "reel|wise" can be split into two colours or weights easily. It looks like a calm, competent tool, not a flashy consumer app.

**Domain fit and the indie-OSS use case.** "Reel" says movies immediately. "Wise" says judgement, and it suits the "for scientists" side, since statistics is the discipline of wise inference. For AI agents the name works well. It is one token-ish word with no hyphen or underscore, and it is easy to type and to embed in a command such as `reelwise pick` or an MCP tool name. It also avoids the "Movie-something-AI" genericness that would drown it in search results. What the name does not say is "personal" or "recommender". It suggests wisdom about film in general and not choosing for you specifically. That is fixable with a tagline.

**Confusion risk.** This is the weak point. "Reelgood" is a live competitor with the same shape, a "reel" prefix plus an evaluative adjective, and in the same job (a streaming guide with recommendations). People who half-remember either name will conflate them, and a trademark-minded reader could see it as a knock-off. There is no structural overlap with JustWatch, Letterboxd, Trakt, MoviePilot, Flixster, Criticker, MovieLens, taste.io or Plex. Beyond film, "Wise" is a well-known fintech brand and "Reels" is a social-video format, so search results will be noisy. I did not search the web, so I cannot rule out small existing products called Reelwise. PyPI and npm being free is the only availability fact I can rely on here.

**For.**
- The name is short and friendly.
- It is instantly film-related.
- It has a positive, competent connotation that also suits the statistics audience.
- It is pronounceable in both languages and easy for agents to type.
- Package and CLI ergonomics are excellent.
- It feels like a hobbyist project's name, not a startup's.

**Against.**
- It sits very close to Reelgood in structure and meaning, which is the one collision that matters.
- The "reel" spelling invites "real" typos.
- "Wise" is generic, and the "-wise" suffix reading ("in terms of reels") slightly dilutes it.
- It says "movies" more than "picks for me".
- Search visibility against Wise, Reels and Reelgood will be poor at first.

Scores (1-10): memorability 7, says-movie-picking 6, domain fit 7, EN/FR pronounceability 7, low-confusion 5, agent-friendliness 8

### 9. reelscout

**Etymology and morphemes.** "reelscout" is a compound of two plain English words. "Reel" is the film reel, and by extension cinema itself (also "reel" as in Instagram Reels, which matters below). "Scout" is someone sent ahead to find things for you: a talent scout, a location scout, a scout who finds the good ground. The metaphor is apt for a recommender. A scout goes out, looks, and comes back with a shortlist. It is a nicely agentic word, since an AI agent scouting movies on your behalf is literally the product. The compound is not an English or French dictionary word, so it is ownable as a coinage, but both halves are transparent, so nobody needs to have the name explained.

**Pronunciation.** In English it is unambiguous: /ˈriːl.skaʊt/, "reel-scout", two stressed beats, easy to say aloud and easy to spell after hearing it. The one wobble is the "ou" digraph. That is where your entropy scorer flags the highest uncertainty (2.035 bits), because "ou" can be read as "oo", "uh" or "ow". Real English speakers will rarely stumble, since "scout" is a very common word. A French speaker will say something like "ril-skoot" or "ril-scoute", with a slightly softer, often unaspirated initial r and a pure "ou" as in "scoute". French readers already know "scout" and "scoutisme" as loanwords, and they pronounce them /skut/, so the French reading is arguably friendlier than a mis-hearing of "ou" would suggest. The "ee" in "reel" is fine for French speakers ("ril"). The consonant cluster "-lsc-" is a small hurdle, though not a serious one. Overall pronounceability is good in both languages, and the phonetic neighbours (relocate, girl scout, roller skate) are only loosely similar, so audio confusion is low.

**Sound feel and visual impression.** The sound is balanced and modern, with a smooth long "ee" opening and a crisp "sk...t" close. It feels friendly, active and slightly outdoorsy, more "helpful companion" than "cold algorithm". Visually, nine lowercase letters read cleanly as "reelscout" or "ReelScout" in CamelCase. There are no awkward ascenders, and the "ee" and "ou" pairs give it a pleasant rhythm. It looks good as a lowercase CLI command and as a wordmark. A small visual snag is that "lsc" in the middle makes the word-break slightly less obvious in all-lowercase, so the wordmark may want a capital S or a subtle separator.

**Domain fit and "says movie picking".** The film half is clear, and the scouting half implies finding and selecting on your behalf. Together they say "something that finds movies for you" fairly well, though it can also read as "scouting the film industry" (a talent or location scout) or "scouting video reels", and the second reading is exactly what the existing PyPI project does. For a hobby, indie tool with an AI-agent core and a statistics side, the name has a nice duality. "Scout" suits an agent that goes and looks, and it doesn't box the project into either the consumer or the scientific side. It also doesn't say anything about taste, personalization or statistics. Nothing in it points to "for scientists".

**Confusion risk.** Against the listed services it is clearly distinct from JustWatch, Letterboxd, Trakt, MoviePilot, Flixster, Criticker, MovieLens, taste.io and Plex. The nearest is Reelgood, since both begin with "Reel", and that is the real brand-level resemblance. Both are "reel + word" compounds in the same category, so a casual listener could blur "Reelgood" and "Reelscout". They are still different enough in the second element to avoid direct confusion. "Scout" is one of the most overused words in software (Scout APM, Scout24, Scoutapp, Scout Suite, the Scouts movement), so the word carries no distinctiveness on its own, and searches for "scout" will be noisy. The bigger issue is the existing PyPI project `reel-scout`, v1.4.2, a short-form video analysis tool for YouTube Shorts, Instagram Reels and TikTok. PyPI normalizes `reel-scout`, `reel_scout` and `Reel.Scout` to the same name, but `reelscout` (no separator) is a technically distinct project, and it is free. In practice that means a pip typo, a search result, or an agent guessing the hyphenated form could install the wrong package. It also means a Google or PyPI search for "reel scout" will surface the video-analysis tool first. It also carries a semantic risk, because "Reels" as a term now points at short-form social video, which is the wrong association for a movie recommender.

**Arguments for.** It is memorable, plain, and easy to say and spell in English and French. The metaphor of an agent that scouts films for you fits the AI-agent design directly. It has a warm, indie, non-corporate tone that suits a hobby project. The exact string is free on PyPI and npm, it is short enough to type as a CLI command, and it works as one token for agents (`reelscout search`, `pip install reelscout`, `npx reelscout`). Brandability (0.82) and novelty as a string (1.0) are strong.

**Arguments against.** The PyPI `reel-scout` collision is real. It brings typo and install-the-wrong-package risk, and it contaminates search results with an unrelated video-analysis tool. The word "Reel" now leans toward short-form social video, which muddies the meaning. "Scout" is generic and crowded, so the name gives you little distinctiveness or SEO. The Reelgood resemblance is mild, but it exists. The name does not signal personal taste, statistics or the scientific side, and it may read as "finding movies" in general rather than "choosing for me". An agent that must choose between `reelscout` and `reel-scout` when writing an install command can easily get it wrong, so you would want to document the exact name prominently and possibly add a warning line in the README.

Scores (1-10): memorability 7, says-movie-picking 7, domain fit 7, EN/FR pronounceability 8, low-confusion 5, agent-friendliness 6

### 10. cinescout

**Etymology and structure.** The name is a straight compound of "cine" (from Greek kinema via French "ciné", "cinema") and "scout" (someone sent ahead to find things). Both halves are transparent, and together they read as "the one who scouts films for you." That matches the product: a scout that goes through the catalogue and comes back with a shortlist. The metaphor also fits the AI-agent angle, because an agent is literally sent out to find things on your behalf. The metrics file it as a clean, non-word coinage with no morphemes flagged by the scorer. That is misleading, since the two morphemes are obvious to any human reader.

**Pronunciation.** In English it is "SIN-uh-skout" (/ˈsɪnɪskaʊt/). Everyone will say it that way, and the spelling is transparent once you see the two parts. The entropy figures (6.8 bits English, 7.6 with French) are moderate, and the high-entropy graphemes (the "i", the "e" and the "ou") are just the compound seams and the "ou" digraph, not real ambiguity. In French the "ciné" half is native: "see-nay". A French speaker would probably say "see-nay-SKOOT" or "see-nay-skoot". The English "ou" in "scout" would tend to become French "ou" /u/, so "scout" sounds like "skoot". They may also hear the word "scout" (the youth movement) and recognise it, since "scout" is a familiar loan word in French. Some English speakers will say "SIN-ee-skout" versus "SIN-uh-skout", but the variation is harmless. The Anglo-French split is the only real ambiguity: the "cine" vowel (English "sin", French "see"). Both are plausible and neither is embarrassing.

**Sound and look.** It has three even syllables, voiceless and crisp (the s, c, k and t sounds give it a light, quick, slightly detective feel). The metrics call it balanced and modern, and I agree. Written in lowercase it looks tidy: "cinescout" is 9 letters, the two halves are visible at a glance, and there are no awkward letter clusters. The "-scout" ending gives it a friendly, outdoorsy, trail-finder feel that softens the "cinema" prestige. That is a good tone for a hobby project.

**Domain fit and agent-friendliness.** It says "movies" immediately, and "scout" says "finding for you", so it hits the brief better than most invented names. It is easy to type (no hyphen, no odd characters, and the keyboard distance is low at 3.1). It works as a package name, a CLI command (`cinescout recommend`), an import (`import cinescout`) and an MCP tool prefix (`cinescout_pick`). It is a single lowercase token, which is exactly what agents and shell users want. The "for scientists" side is less served: the name says nothing about statistics, but nothing in it contradicts that side either.

**Confusion risk.** Against the listed services (JustWatch, Reelgood, Letterboxd, Trakt, MoviePilot, Flixster, Criticker, MovieLens, taste.io, Plex) there is no overlap in spelling or sound. The nearest conceptual neighbour is MoviePilot ("pilot" and "scout" are both guide metaphors), but that is a family resemblance, not a clash. The wider risk is that "cine" plus a noun is a crowded pattern. "Cinescout"-like names (CineScout, Cinescope, Cinemascout and similar) are the sort of thing that has probably been used for small apps, sites or scouting-style film tools somewhere. Since PyPI and npm are free, that is fine for the package, but you should still check GitHub, app stores and domain names, and the obvious "cinescout.com" is a likely sore point. The phonetic neighbour "sea scout" is mostly a curiosity, since nobody will mistake the two in context, though a spoken "sea scout" or "sin a scout" could cause a brief mishearing.

**For.** It is transparent, memorable after one hearing, and instantly says "movies plus finding." It is friendly and not corporate, which suits an indie project. It is agent-friendly: one lowercase token, easy to type and spell after hearing it. The French half is native, so French speakers get the "ciné" meaning for free. It leaves room for a family of names (`cinescout-stats`, `cinescout-agent`).

**Against.** It is descriptive rather than distinctive, so it is easy to forget which "cine-something" it was, and the compound pattern is common enough that a search may return unrelated products. The scouting metaphor implies a talent-scout or outdoors flavour that is a little generic. Nothing in it signals AI, taste modelling or the statistics side. The "cine" pronunciation splits between English and French speakers. Finally, the risk of an existing small "CineScout" product or trademark elsewhere is real, and I have not verified it.

Scores (1-10): memorability 7, says-movie-picking 8, domain fit 8, EN/FR pronounceability 7, low-confusion 6, agent-friendliness 9

### 11. moodreel

**moodreel** is a compound of two ordinary English words, *mood* and *reel*. Neither is a movie word on its own, but together they read as a film-feeling pairing. "Mood" is the emotional state or taste of the moment. "Reel" is the film reel, and so film in general. There are no hidden morphemes and it is not a word in English or French. That gives it a clean trademark-like novelty (1.0) while still being instantly parseable. The two halves have a nice symmetry too, since both are single syllables built on a long vowel spelled with a doubled letter (oo, ee), which is likely why it scores as the most brandable of the set and the most predictable to pronounce.

In English it is /ˈmuːd.riːl/, with two even beats and no ambiguity. The only wobble is the "oo" digraph, the highest-entropy grapheme (1.14), because a reader might briefly hear the "oo" of *blood*. In practice "mood" is so common that nobody does. A French speaker will say roughly "mou-d-RIL": "oo" becomes "ou" (/u/), "ee" becomes a short "i", and the "r" becomes uvular. The result is /mud.ʁil/, or with a light final stress, which is natural in French. It survives the crossing well, and both syllables map to sounds French already has. The low, near-identical EN and EN+FR entropy (1.283 for both) supports this. The sound feel is warm and rounded: voiced consonants throughout, a back vowel followed by a front vowel, with no harsh stops. That suits a personal, cosy, "movie night" product better than a statistics library, and the fit is deliberate for the first audience but a little soft for the second.

Visually it is a tidy eight lowercase letters with a good CamelCase form (MoodReel), a natural logo split, and a typing distance of 2.49, the easiest of the candidates. As a package, CLI and tool name it is very agent-friendly: no hyphens, no underscores, no digits. It should split into two familiar tokens, so a language model can spell it and recall it reliably. `moodreel pick --tonight` and `pip install moodreel` read naturally.

On domain fit, "reel" clearly signals film, and "mood" signals taste and choice. Still, the name says "movies that match your mood" more than "an agent picks a movie for me." It names a noun, not the act of picking. It also narrows the promise to mood-based recommendation, which is a poor description of a project with a "for scientists" side about statistics, taste models and evaluation. A user may expect a mood quiz and be surprised by a Bayesian taste model. The name can grow into the science side because it is not a literal descriptor, but it will not announce it.

Confusion risk is moderate and mostly sonic or conceptual, not exact. Against the listed services, the closest is Reelgood, which shares the "reel" stem, so casual mentions such as "moodreel, like Reelgood?" are plausible. Letterboxd, Trakt, JustWatch, MovieLens, Criticker, taste.io, Plex, MoviePilot and Flixster are all far enough away. Outside the movie space, "Moodle" (the learning platform) is a phonetic neighbor, though the "-reel" ending keeps it distinct. "Mood ring" is a mild echo. Instagram Reels and "showreel" add a short-video association that may nudge people toward clips rather than feature films. Other small mood-based recommenders probably exist, since "mood" is a crowded prefix in this niche. Availability on PyPI and npm was re-verified today. I did not check trademarks, domains or other registries, so treat this as a package-level check only.

**Arguments for.**
- It is warm and memorable, with a high brandability score.
- Both syllables are common English words, which makes it easy to spell, say and type.
- It is easy for French speakers.
- It has almost no exact-name collisions.
- It is a strong fit for the browser-first, personal, hobby feel.
- It is tokenizer-friendly and clean as a CLI or tool name for agents.
- It leaves room for the scientific side because it is not a literal descriptor.

**Arguments against.**
- It describes the mood angle only, and undersells the statistics and agent-choice aspects.
- It shares the "reel" stem with Reelgood.
- "Mood" is a saturated word in recommender products, and "Moodle" sits nearby in sound.
- "Reel" now also connotes Instagram-style short video.
- It is a noun-noun compound with no verb, so it does not say "picks for me". It is pleasant but not distinctive enough to feel ownable.

Scores (1-10): memorability 8, says-movie-picking 6, domain fit 6, EN/FR pronounceability 9, low-confusion 6, agent-friendliness 8

### 12. kinome

**Etymology and meaning.** "Kinome" is an established biology term. It means the complete set of protein kinases in a genome, and it was coined on the pattern of genome and proteome. Read cold, it also splits into `kin` + `o` + `me`. That gives the Greek *kine-* (movement, root of cinema, kinetic and kinematics) and the suffix *-ome* ("the complete collection of"), so a loose gloss is "the whole collection of moving pictures". The scorer found no morphemes, but people will hear more than it does. "Kino" means cinema in German, Russian, Czech, Polish and other languages, and "me" adds a personal reading ("cinema for me"). Someone who has seen "kinome" once will find it easy to decode afterwards. Nobody will decode it on first sight without a hint.

**Pronunciation.** I'd count two syllables, not three. In English it is KY-nohm, like "genome". A scientist would say it that way, with the same vowel as "kinase". Non-specialists may say KEE-nohm, because "kino" primes them that way, and a few will say "kih-NOH-mee" as in "anemone". That ambiguity is real but harmless. Both variants are easy to type and to recognise once heard. In French it is "ki-NOM" /kinɔm/, exactly parallel to *génome*, *biome* and *protéome*. French speakers already own the pattern, so this is arguably easier in French than in English. The scorer's high-entropy flags on i, o and e reflect the KY/KEE and final-e uncertainty. They are not a serious barrier.

**Sound and look.** Six letters, all lowercase-friendly, with a front-vowel, modern, balanced sound (voiceless share 0.33, no harsh consonants). It reads as clean and slightly scientific, closer to a lab or data tool than to a consumer entertainment brand. The visual impression is compact and calm, with no awkward letter shapes. The biological "kinome tree" is an iconic radial dendrogram of coloured dots. That happens to be a very good visual metaphor for a movie taste map, which is a strong asset for the "for scientists" side.

**Domain fit.** Weak on the surface and clever underneath. The name does not say "movie" or "pick", and to most people it will read as invented or biological. For the scientist audience the fit is better: "the complete taste/film genome you can run statistics on" is a coherent story, and the tree/map imagery supports it. It suits a hobby or indie project well and would be a poor fit for a mass-market consumer brand.

**Confusion risk.** Against the listed services (JustWatch, Reelgood, Letterboxd, Trakt, MoviePilot, Flixster, Criticker, MovieLens, taste.io, Plex) it is highly distinct. The nearest neighbours are "kino"-family names such as the Russian sites Kinopoisk and Kinorium and generic "Kino" apps, but none is a direct clash. The real collision is with biology. The term dominates search results, and bioinformatics tooling uses the word (kinome trees, kinome-wide profiling assays, kinase-mapping tools). Package-name space is free, but SEO and "what is this?" confusion are not. Someone searching "kinome recommender" or "kinome python" will mostly land on kinase research.

**Arguments for.**
- It is short, memorable and distinctive, and it is free on PyPI and npm.
- It works as one lowercase token that types cleanly and is unlikely to be confused with other tools or commands.
- It has the "kino" cinema echo, the "-ome" completeness idea and a personal "me".
- The "for scientists" angle gets a natural story, with statistics and the tree visual.
- It sounds natural in French.

**Arguments against.**
- It does not say "movie" or "picks for me" to anyone who is not a biologist. Every new user needs the tagline.
- The established meaning is very strong. Search engines and biologists will treat it as theirs, so discoverability will suffer.
- The English pronunciation is ambiguous (KY vs KEE), and the name may read as a gimmick to people who know the biology.
- Some may find borrowing a bioinformatics word slightly appropriative or off-topic.

Scores (1-10): memorability 8, says-movie-picking 4, domain fit 6, EN/FR pronounceability 7, low-confusion 6, agent-friendliness 8

### 13. whichflick

**Etymology and structure.** "whichflick" is a compound of two ordinary English words, "which" (interrogative determiner) and "flick" (slang for a film, from the flicker of early projection, as in "flicks" and "chick flick"). It has no formal morphemes in the linguistic sense, but both halves are transparent to an English speaker. The name reads as the question a user is actually asking: which film should I watch? That semantic logic is its strongest asset. The spelling "flick" (rather than "flik") is standard, and the pairing is unmistakably English-language idiom.

**Pronunciation.** In English it is /wɪtʃ flɪk/, two clean syllables with a stop-fricative-stop rhythm. The trouble is that "which" is a homophone of "witch" for most speakers, so the name may be heard as "witch flick", and the spoken form needs a spelling clarification ("W-H-I-C-H"). The metrics agree that spelling is a weak point: entropy is 4.4 bits in English and 5.4 in English plus French, and both "i" graphemes and the "ch" are flagged. A French speaker would probably say something like /witʃ flik/ or /ouitch flik/. The "wh-" versus "w-" distinction does not exist in French, and "wh" is not a native French grapheme. "ch" will be produced as /ʃ/ ("sh") by instinct, which is wrong for "which" but sounds close. "Flick" is easy for French speakers because "flic" is already a familiar French word (slang for a cop), which brings a comic connotation that is likely harmless and even endearing. The name is therefore pronounceable in both languages, but it will not be pronounced identically.

**Sound feel and visual impression.** It is sharp, modern and consonant-heavy (V/C 0.2, the most consonant-dense of the 14 candidates), with front vowels and voiceless consonants giving a crisp, quick, slightly playful feel. Written in one word, "whichflick" is long at 10 characters and the ch-f-l-ck run of consonants looks dense. The "hf" join in the middle is the least natural part to type and to read, and camelCase ("WhichFlick") helps in a logo but not in a lowercase package name. The brandability score of 0.70 is the lowest of the 14 candidates, which fits: it is more a descriptive phrase than an invented brand.

**Domain fit and agent-friendliness.** For a movie recommender it is well matched on both meaning and register. "Flick" is casual and hobbyist rather than corporate, which suits an indie project. It says "picks a movie for me" directly through the "which?" question. For AI agents, a package named `whichflick`, a CLI command `whichflick`, or a tool called `whichflick.pick()` reads naturally: the name is itself a verb phrase asking for a decision. It is typeable, lowercase, has no hyphens or underscores, and is free on PyPI and npm. Longer names cost a little in typing, and the "hf" join and "wh" spelling are the likeliest typo sources. The "for scientists" statistics side is not signalled at all, but that is true of nearly any movie name and is better handled by a subtitle.

**Confusion risk.** Against the listed services (JustWatch, Reelgood, Letterboxd, Trakt, MoviePilot, Flixster, Criticker, MovieLens, taste.io, Plex) there is no direct collision. "Flix-" and "Flick-" names are crowded in the wider space, and Flixster is the closest in feel, but "whichflick" is distinct in structure. The real echo is phonetic: "chick flick", a gendered genre term. Said quickly, "whichflick" and "chick flick" are near neighbours, which can prompt an unwanted joke or a mis-hearing, and it may make the tool sound as if it targets one audience. There is also "one click" and "quick look" in the phonetic-neighbour list, but these are benign. The "which/witch" homophony creates minor searchability noise ("witch flick") that is manageable.

**Arguments for.**
- It says what it does in the user's own words, is instantly understood by English speakers, and is memorable once heard.
- It is casual, playful and indie in tone, and it reads as a question that an agent can answer.
- It is free on both registries, has no clash with the listed services, and is easy to type in lowercase.
- "Flick" is easy for French speakers, and the name is not offensive in either language.

**Arguments against.**
- The "chick flick" echo is the biggest problem: gendered, a bit dated, and likely to shape how the tool is perceived or joked about.
- It is the lowest-scoring candidate on computed brandability, the longest at 10 characters, and the most consonant-heavy.
- Pronunciation and spelling are ambiguous ("which" versus "witch", the missing "wh-" sound for French speakers), so word-of-mouth is error-prone.
- It is descriptive rather than distinctive, and "flick" names are common in the film space, so trademark and search distinctiveness are modest.
- It does not signal the statistics or scientific side, and "flick" sounds slightly dated compared with "film" or "cine".

**Verdict.** A charming, self-explanatory name that is well suited to a hobby project, held back mainly by the "chick flick" association and its spelling and pronunciation quirks. It works well as a friendly CLI verb and package name, less well as a brand that must travel across languages.

Scores (1-10): memorability 7, says-movie-picking 9, domain fit 8, EN/FR pronounceability 5, low-confusion 6, agent-friendliness 7

### 14. cinesift

**Etymology and meaning.** "cinesift" is a clean two-morpheme compound. *Cine* is the Romance-language root for film (French *ciné*, also Spanish, Italian and Portuguese, and the English "cinema", "cinephile", "cine-club"). *Sift* is an everyday English verb meaning to pass a large mass through a sieve and keep what matters. Together they mean "sifting through films", which is close to a literal description of a recommender. The metaphor also suits the "for scientists" side, since sifting suggests filtering, sampling and separating signal from noise. It works for casual users and for statisticians. Two things the brief didn't flag: the sieve image implies subtraction (discarding films) more than discovery, and the compound is not a dictionary word in English or French.

**Pronunciation.** English speakers will most likely say /ˈsɪn-ɪ-sɪft/ ("SIN-ih-sift"), but the silent-e pattern invites a second reading, "SINE-sift", as in the math term. The stress and vowel of *cine* are the fuzziest part. French speakers will say /si-ne-sift/ ("ci-né-sift") and hear *ciné* immediately, which is a plus. They will pronounce *sift* fine, because /ft/ is easy for them and there is no "th" or "h" trap. Without the accent on the written *cine*, they may occasionally read it as /sin/. The three sibilants (c, s, s) make the name a little hissy, though it is not a real tongue-twister. The phonetic neighbors (sunset, sniffed) are harmless when heard in context. The high entropy figures partly reflect the silent-e blind spot, so I would treat them as inflated.

**Sound and visual feel.** It sounds sharp, modern and light, with front vowels and voiceless consonants. It looks tidy and lowercase-friendly: eight letters, no hyphens, no doubled letters, and spelling transparency is high (0.94). The "-sift" ending reads as slightly technical and "tooling", which suits an indie project more than a consumer brand. It is not warm or personal, though.

**Confusion risk.** Against the listed services (JustWatch, Reelgood, Letterboxd, Trakt, MoviePilot, Flixster, Criticker, MovieLens, taste.io, Plex) the name is distinct, and none of them shares a root or a rhythm. The real overlaps are with the *sift* half. SIFT is the well-known computer-vision algorithm, so a scientist may briefly expect image features. There are existing packages called `sift`, and I also recall commercial products named "Sift" in unrelated fields such as fraud detection. This is from memory, and I did not check trademarks or the web. The *cine-* prefix is also crowded across film tools and apps, so search visibility for the bare prefix is weak. The compound itself is more findable than either half.

**For.** It is highly typeable, and `pip install cinesift`, `import cinesift` and a `cinesift` CLI all read naturally. It is available on PyPI and npm. It says "film" and "select from many" in one glance, and it is bilingual by construction, which suits a project with a French-speaking maintainer. It is neutral between the consumer and scientist audiences, and it is easy for an agent to spell correctly from a spoken or written description. It has no negative connotations in English or French.

**Against.** The name says "filter" more than "recommend for me", so the personal, taste-driven promise is implicit at best. The *cine/movie* register is slightly arthouse or European, which is fine for a hobby project but less descriptive for a casual movie-night user. The *cine* vowel is ambiguous, with three possible readings. The SIFT and `sift` collisions could cost some search clarity, and they add a small trademark question if the project grows.

Scores (1-10): memorability 7, says-movie-picking 7, domain fit 8, EN/FR pronounceability 6, low-confusion 7, agent-friendliness 9

---

## 4. Summary Ranking by Key Differentiators

| Dimension | Top picks |
|---|---|
| Says 'it picks movies for me' | cinepick, reelpick, flickpick, watchnext, nextflick, whichflick (all 9/10; the verb 'pick' or the question 'which/next' does the work) |
| Least confusable with the listed services | cinepick (8/10); then reelsense, cinesense, cinesift (7/10). Worst: nextflick (Netflix echo), then watchnext, reelscout, reelwise |
| French-friendly | moodreel (H-en/fr 1.28, lowest of all), reelpick (2.48), reelscout (3.47); 'cine-' names read natively as 'ciné' but the entropy scorer over-penalizes them |
| English pronounceability and spelling | moodreel, reelpick (lowest H-en); reelsense, reelwise, kinome (spelling transparency 1.0) |
| Highest computed brandability | moodreel (0.876), kinome (0.861), reelsense (0.825), reelwise (0.824), reelscout (0.823) |
| Best fit for the 'for scientists' side | kinome (statistics/taste-tree story), reelsense ('sense' as measurement), cinesift ('sift' as filtering), reelwise |
| Easiest to type | moodreel (keyboard distance 2.49), watchnext (2.75), kinome (2.95) |
| Agent-friendliness (one token, self-describing verb) | cinepick, flickpick, reelpick, cinescout, cinesift, reelsense (9/10) |
| Highest risk | nextflick (Netflix), whichflick ('chick flick', which/witch), reelscout (existing `reel-scout` on PyPI), kinome (biology owns the word) |

## Appendix: Pronunciation Entropy Detail (graphemes above 0.3 bits, en+fr pooled)

| Name | Ambiguous graphemes (bits) |
|---|---|
| reelpick | i 1.595, c 0.748 |
| flickpick | i 1.595, c 0.748, i 1.595, c 0.748 |
| cinepick | c 0.61, i 1.839, e 2.166, i 1.595, c 0.748 |
| watchnext | a 2.025, ch 1.449, e 1.871, x 0.992 |
| nextflick | e 1.871, x 0.992, i 1.595, c 0.748 |
| reelsense | s 0.541, e 1.871, s 0.541, e 1.761 |
| cinesense | c 0.61, i 1.839, e 2.166, s 1.234, e 1.871, s 0.541, e 1.761 |
| reelwise | i 1.839, s 1.234, e 1.761 |
| reelscout | s 0.541, c 0.748, ou 2.035 |
| cinescout | c 0.61, i 1.839, e 1.871, s 0.541, c 0.748, ou 2.035 |
| moodreel | oo 1.141 |
| kinome | i 1.839, o 2.368, e 1.761 |
| whichflick | i 1.595, ch 1.449, i 1.595, c 0.748 |
| cinesift | c 0.61, i 1.839, e 2.166, s 1.234, i 1.595 |

## Recommendation

Top 5, in order:

1. **cinepick**: the clearest 'ciné' plus 'pick' reading (film plus choose), native in French, the least confusable with the listed services, one lowercase token that works as `pip install`, `import`, CLI verb and agent tool prefix; its only soft spot is the SIN-ih vs SIN-ee vowel in English.
2. **reelpick**: the same 'pick' logic with the simplest English pronunciation (H-en 2.05) and a natural `reelpick.pick()` API; it loses to cinepick only because 'reel' is close to Reelgood and now also means short-form video.
3. **flickpick**: the most playful and memorable of the 'pick' names and instantly understood, but the repeated 'ick', the dated slang 'flick', and a slightly unserious tone for the statistics side keep it third.
4. **cinescout**: a good agent metaphor (a scout sent to find films for you) and native 'ciné', but 'scout' is a crowded software word and the name does not say 'picks one for me' as directly as the '-pick' names.
5. **cinesift**: 'sift' suits both the consumer story and the statistics story, and it is agent-friendly, but it says 'filter' more than 'recommend', and SIFT/`sift` adds some search noise.

The rest: watchnext and moodreel are pleasant runners-up (watchnext is generic and hard to own; moodreel narrows the promise to mood), reelsense and cinesense are safe but do not say 'picks for me', and I would avoid nextflick (Netflix echo), whichflick ('chick flick', which/witch), reelscout (existing `reel-scout` on PyPI), reelwise (too close to Reelgood's shape) and kinome (biology owns the word, and it does not say 'movie'). Before committing to any name, check GitHub, domains and trademarks, which this report did not cover.
