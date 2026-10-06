# flickpick.ratings

The canonical `Rating` type, and how ratings are joined to a catalogue.

A rating’s `item_id` is an IMDb id (`tt0114369`) whenever the source knows it. Sources
that do not (Letterboxd, MovieLens) emit a prefixed reference instead – `ml:<movieId>`,
`tmdb:<id>`, or no id at all with a `"Title (Year)"` title – and
[`resolve_ratings()`](#flickpick.ratings.resolve_ratings) maps each to a catalogue row index.

### Functions

| [`as_rating`](#flickpick.ratings.as_rating)(x)                                  | Coerce a `Rating` or a mapping with the same keys into a `Rating`.            |
|------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------|
| [`catalog_lookup`](#flickpick.ratings.catalog_lookup)(catalog)                       | Map every way a rating can name an item to its catalogue `idx`.               |
| [`imdb_id`](#flickpick.ratings.imdb_id)(value)                                | Normalise an IMDb id given as `114369`, `'114369'` or `'tt0114369'`.          |
| [`like_threshold`](#flickpick.ratings.like_threshold)(scores, \*[, min_n, fallback]) | The user's median score, or `fallback` when they have fewer than `min_n`.     |
| [`resolve_ratings`](#flickpick.ratings.resolve_ratings)(catalog, ratings)             | Pair each rating with its catalogue `idx`, dropping the ones not found.       |
| [`split_title_year`](#flickpick.ratings.split_title_year)(text)                        | Split `"Toy Story (1995)"` into `("Toy Story", 1995)`.                        |
| [`title_keys`](#flickpick.ratings.title_keys)(title, year)                       | Matching keys `"normalised title|year"` for a title and its alternates.       |
| [`title_variants`](#flickpick.ratings.title_variants)(title)                         | The primary title plus any parenthesised alternates, normalised for matching. |

### Classes

| [`Rating`](#flickpick.ratings.Rating)(item_id, score[, rated_at, title])   | One user rating on the canonical 0-100 scale.   |
|----------------------------------------------------------------------------------------------|-------------------------------------------------|

### *class* flickpick.ratings.Rating(item_id, score, rated_at=None, title=None)

Bases: [`object`](https://docs.python.org/3/builtins/functions.html#object)

One user rating on the canonical 0-100 scale.

### flickpick.ratings.as_rating(x)

Coerce a `Rating` or a mapping with the same keys into a `Rating`.

* **Return type:**
  [`Rating`](#flickpick.ratings.Rating)

### flickpick.ratings.catalog_lookup(catalog)

Map every way a rating can name an item to its catalogue `idx`.

Keys: the IMDb id, `ml:<id>`, `tmdb:<id>` and title keys. An earlier (more
popular) row wins a title-key collision.

* **Return type:**
  [`dict`](https://docs.python.org/3/builtins/stdtypes.html#dict)[[`str`](https://docs.python.org/3/builtins/stdtypes.html#str), [`int`](https://docs.python.org/3/builtins/functions.html#int)]

### flickpick.ratings.imdb_id(value)

Normalise an IMDb id given as `114369`, `'114369'` or `'tt0114369'`.

* **Return type:**
  [`str`](https://docs.python.org/3/builtins/stdtypes.html#str) | [`None`](https://docs.python.org/3/builtins/constants.html#None)

```pycon
>>> imdb_id(114369), imdb_id('tt0114369'), imdb_id(''), imdb_id(12345678)
('tt0114369', 'tt0114369', None, 'tt12345678')
```

### flickpick.ratings.like_threshold(scores, , min_n=5, fallback=70.0)

The user’s median score, or `fallback` when they have fewer than `min_n`.

* **Return type:**
  [`float`](https://docs.python.org/3/builtins/functions.html#float)

```pycon
>>> like_threshold([90, 50, 70, 80, 60])
70
>>> like_threshold([90, 50])
70.0
```

### flickpick.ratings.resolve_ratings(catalog, ratings)

Pair each rating with its catalogue `idx`, dropping the ones not found.

A later rating of the same item replaces an earlier one.

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`tuple`](https://docs.python.org/3/builtins/stdtypes.html#tuple)[[`int`](https://docs.python.org/3/builtins/functions.html#int), [`Rating`](#flickpick.ratings.Rating)]]

### flickpick.ratings.split_title_year(text)

Split `"Toy Story (1995)"` into `("Toy Story", 1995)`.

* **Return type:**
  [`tuple`](https://docs.python.org/3/builtins/stdtypes.html#tuple)[[`str`](https://docs.python.org/3/builtins/stdtypes.html#str), [`int`](https://docs.python.org/3/builtins/functions.html#int) | [`None`](https://docs.python.org/3/builtins/constants.html#None)]

```pycon
>>> split_title_year('Toy Story (1995) ')
('Toy Story', 1995)
>>> split_title_year('Babylon 5')
('Babylon 5', None)
```

### flickpick.ratings.title_keys(title, year)

Matching keys `"normalised title|year"` for a title and its alternates.

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`str`](https://docs.python.org/3/builtins/stdtypes.html#str)]

### flickpick.ratings.title_variants(title)

The primary title plus any parenthesised alternates, normalised for matching.

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`str`](https://docs.python.org/3/builtins/stdtypes.html#str)]

```pycon
>>> title_variants('Seven (a.k.a. Se7en)')
['seven', 'se7en']
```
