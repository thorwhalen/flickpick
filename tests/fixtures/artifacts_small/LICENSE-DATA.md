# Data licence for this fixture

The files in this directory (`manifest.json`, `catalog.json`, `cf_*.i32`, `cf_values.f32`, `embeddings.f32`) are a transformation of the MovieLens `ml-latest-small` dataset by GroupLens Research, University of Minnesota: the 600 most-rated films, their titles, genres, user tags and rating statistics, a top-50 sparsified EASE item-item matrix trained on those ratings, and `BAAI/bge-small-en-v1.5` embeddings of the derived text.

They are distributed under the same terms as the source dataset: use for research and non-commercial purposes only, with these same conditions applying to any further redistribution or transformation, and with acknowledgement of the source. The terms and the dataset are at https://grouplens.org/datasets/movielens/ (citation: F. Maxwell Harper and Joseph A. Konstan. 2015. The MovieLens Datasets: History and Context. ACM Transactions on Interactive Intelligent Systems 5, 4: 19:1-19:19. https://doi.org/10.1145/2827872).

This licence covers the data files only; the flickpick code is MIT-licensed (see the repository's LICENSE). The fixture is rebuilt by `tests/fixtures/make_fixtures.py`.
