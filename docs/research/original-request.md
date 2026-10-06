# Movie recommender — the user's request (verbatim, 2026-09-30)

I'd like to make a package for movie recommender systems. As much of it in browser, if possible, but if most of the models can't easily run in a browser, of course, we have python (+qh to make a web service for it...).

Here's a prelim report on movie recommender systems: $PP/_tmp/movie_recommender_systems_report.md

Complete the research if needed.

Also do some research for this:

Is there some kind of free feed/API that I can consume to see (1) what movies are on offer on Netflix, HBO Max, Disney+, Hulu... (2) getting rotten tomatoes scores (and other scores, like IMDB, etc.) Write a report about that. The point would be (a) to have more data to feed into the models (b) to be able to display these when I'm looking at a movie's description.

The app will have a "for scientists" side, that will have various stats and visualizations that do things like compare a user's ratings with other population ratings (rotten tomatoes, imdb, etc.), correlating them, seeing which one the user is most agreeing with, also making different formulas/models with those population ratings, and maybe other characteristics/features, showing how well they fit the user's ratings (also doing some actual train/test split estimates of their accuracy, etc.

The scientists page will also discuss the ins and outs of movie recommender systems.

Mention somewhere in the web site (perhaps the info/about page, where ever is standard for this) something about how I got into recommender systems around 2004, to understand musical tastes and trends, then soon after in the marketing context, sector in which I worked significantly in until 2016. 20+ years later, I'm still not satisfied with movie recommendations, so, given agentic coding allows me to be orders of magnitude faster in developing stuff, I thought "might as well make the one I'd want")

Find data that describes the movie semantically. The story line, the "feel", etc. My intent is to take those, embed them, and use them to filter according to semantic queries. I'd also like to have data on any features a user might want to filter by (such as age ranking, genre, etc.)

Finally, I need to know where I'll be sourcing my movie posters. Is there a free service for this?

Anything else I didn't think about that you should research?

I'm not yet sure of making an npm package or python package for it, but if you want constraints for your name finding, you can always choose accordingly, just in case. Constrain by availability in both.

The tool, like all my tools, will be AI-enabled. Mainly a tool for my agents to be able to choose movies for me. I'll probably make a connector for it, an AI assistant on the app, etc.

Make this in $PP/tt once we settle on a name.

## Addendum (2026-09-30, from the user)

Add `$PP/_tmp/movie_ratings_various.csv` to the repo: the user's own ratings of 100+ movies (columns movie_id, imdb_id, tmdb_id, rating, average_rating, title). It is NOT a proposed format — just example data to pluck from. Real user ratings will eventually live in a MutableMapping (Python) / zodal store (JS), defaulting to local storage. (Ignore the older `an older export` — the user chose the `_tmp` one.)
