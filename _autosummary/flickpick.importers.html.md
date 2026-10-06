# flickpick.importers

Parse ratings exports into `Rating` lists on the canonical 0-100 scale.

Formats (detected from the header by [`detect_format()`](#flickpick.importers.detect_format); header cells are trimmed
and matched case-insensitively, and the first format whose required columns are all
present wins, in this order – the rules of `docs/core-contract.md`, Importers):

- **imdb** – IMDb’s ratings export (requires `Const`, `Your Rating`; 1-10, x10).
- **flickpick** – `movie_id,imdb_id,tmdb_id,rating,average_rating,title` (requires
  `movie_id`, `imdb_id`, `rating`) with `rating` already 0-100 and `imdb_id`
  numeric or `tt`-prefixed.
- **letterboxd** – `ratings.csv` or `diary.csv` from Letterboxd’s data export
  (requires `Name`, `Year`, `Rating`; `Date` and `Letterboxd URI` optional;
  0.5-5 stars, x20). No IMDb id: the rating carries `"Name (Year)"` as its title and
  is matched by title.
- **movielens** – a MovieLens `ratings.csv` (requires `movieId`, `rating`;
  `userId` and `timestamp` optional; x20). Items are `ml:<movieId>`; a file
  holding several users needs `user_id=`.

```pycon
>>> parse_ratings("Const,Your Rating,Title,Year\ntt0114369,9,Se7en,1995\n")
[Rating(item_id='tt0114369', score=90.0, rated_at=None, title='Se7en (1995)')]
```

### Module Attributes

| [`SIGNATURES`](#flickpick.importers.SIGNATURES)   | format -> lower-cased columns whose presence identifies it (checked in this order; the same table as the TypeScript `SIGNATURES`)   |
|---------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------|

### Functions

| [`detect_format`](#flickpick.importers.detect_format)(csv_text)                    | The name of the export format of `csv_text` (a key of `SIGNATURES`).       |
|---------------------------------------------------------------------------------------------|----------------------------------------------------------------------------|
| [`parse_flickpick`](#flickpick.importers.parse_flickpick)(csv_text)                  | The flickpick CSV (the example file's columns) -> ratings (already 0-100). |
| [`parse_imdb`](#flickpick.importers.parse_imdb)(csv_text)                       | IMDb ratings export -> ratings.                                            |
| [`parse_letterboxd`](#flickpick.importers.parse_letterboxd)(csv_text)                 | Letterboxd `ratings.csv` -> ratings (unrated rows are skipped).            |
| [`parse_movielens`](#flickpick.importers.parse_movielens)(csv_text, \*[, user_id])   | MovieLens `ratings.csv` -> ratings of one user (`ml:<movieId>` ids).       |
| [`parse_ratings`](#flickpick.importers.parse_ratings)(csv_text, \*[, format])      | Parse `csv_text` with the parser for `format` (detected when None).        |
| [`read_ratings`](#flickpick.importers.read_ratings)(path, \*[, format, encoding]) | Read and parse a ratings CSV file.                                         |

### flickpick.importers.SIGNATURES *= {'flickpick': {'imdb_id', 'movie_id', 'rating'}, 'imdb': {'const', 'your rating'}, 'letterboxd': {'name', 'rating', 'year'}, 'movielens': {'movieid', 'rating'}}*

format -> lower-cased columns whose presence identifies it (checked in this order;
the same table as the TypeScript `SIGNATURES`)

### flickpick.importers.detect_format(csv_text)

The name of the export format of `csv_text` (a key of `SIGNATURES`).

* **Return type:**
  [`str`](https://docs.python.org/3/builtins/stdtypes.html#str)

### flickpick.importers.parse_flickpick(csv_text)

The flickpick CSV (the example file’s columns) -> ratings (already 0-100).

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`Rating`](flickpick.ratings.html.md#flickpick.ratings.Rating)]

### flickpick.importers.parse_imdb(csv_text)

IMDb ratings export -> ratings.

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`Rating`](flickpick.ratings.html.md#flickpick.ratings.Rating)]

### flickpick.importers.parse_letterboxd(csv_text)

Letterboxd `ratings.csv` -> ratings (unrated rows are skipped).

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`Rating`](flickpick.ratings.html.md#flickpick.ratings.Rating)]

### flickpick.importers.parse_movielens(csv_text, , user_id=None)

MovieLens `ratings.csv` -> ratings of one user (`ml:<movieId>` ids).

`userId` is optional; a file holding several users needs `user_id`.

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`Rating`](flickpick.ratings.html.md#flickpick.ratings.Rating)]

### flickpick.importers.parse_ratings(csv_text, , format=None)

Parse `csv_text` with the parser for `format` (detected when None).

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`Rating`](flickpick.ratings.html.md#flickpick.ratings.Rating)]

### flickpick.importers.read_ratings(path, , format=None, encoding='utf-8')

Read and parse a ratings CSV file.

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`Rating`](flickpick.ratings.html.md#flickpick.ratings.Rating)]
