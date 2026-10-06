# flickpick.data

Download (with a cache) and parse the MovieLens datasets the build uses.

Zips are cached under `<data home>/raw/` – `~/.local/share/flickpick/raw/` unless
the `FLICKPICK_DATA_HOME` environment variable says otherwise – through the `graze`
URL cache when it is installed, else plain `urllib`. CSVs are streamed out of the
zip with `zipfile`, so the 900 MB `ratings.csv` of ml-32m is never held as bytes.

MovieLens licence: research and non-commercial use, and redistributed transformations
carry the same conditions ([https://grouplens.org/datasets/movielens/](https://grouplens.org/datasets/movielens/)).

### Functions

| [`data_home`](#flickpick.data.data_home)()                          | The package's data folder (`$FLICKPICK_DATA_HOME` or `~/.local/share/flickpick`).   |
|---------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------|
| [`fetch_dataset`](#flickpick.data.fetch_dataset)([name, cache_dir])     | Path to the cached zip of MovieLens dataset `name`, downloading it if needed.       |
| [`load_movielens`](#flickpick.data.load_movielens)([name, cache_dir])    | Fetch (cached) and parse MovieLens dataset `name`.                                  |
| [`movielens_source`](#flickpick.data.movielens_source)(name)               | The manifest `sources` entry for a MovieLens dataset.                               |
| [`raw_dir`](#flickpick.data.raw_dir)()                            | Where downloaded source archives are cached.                                        |
| [`read_movielens`](#flickpick.data.read_movielens)(zip_path, \*[, name]) | Parse ratings, movies, links and tags out of a MovieLens zip.                       |

### Classes

| [`MovieLens`](#flickpick.data.MovieLens)(name, ratings, movies, links, tags)   | The four MovieLens tables used by the build, as DataFrames.   |
|--------------------------------------------------------------------------------------------------|---------------------------------------------------------------|

### *class* flickpick.data.MovieLens(name, ratings, movies, links, tags)

Bases: [`object`](https://docs.python.org/3/builtins/functions.html#object)

The four MovieLens tables used by the build, as DataFrames.

### flickpick.data.data_home()

The package’s data folder (`$FLICKPICK_DATA_HOME` or `~/.local/share/flickpick`).

* **Return type:**
  [`Path`](https://docs.python.org/3/library/pathlib.html#pathlib.Path)

### flickpick.data.fetch_dataset(name='ml-latest-small', , cache_dir=None)

Path to the cached zip of MovieLens dataset `name`, downloading it if needed.

* **Return type:**
  [`Path`](https://docs.python.org/3/library/pathlib.html#pathlib.Path)

### flickpick.data.load_movielens(name='ml-latest-small', , cache_dir=None)

Fetch (cached) and parse MovieLens dataset `name`.

* **Return type:**
  [`MovieLens`](#flickpick.data.MovieLens)

### flickpick.data.movielens_source(name)

The manifest `sources` entry for a MovieLens dataset.

* **Return type:**
  [`dict`](https://docs.python.org/3/builtins/stdtypes.html#dict)

### flickpick.data.raw_dir()

Where downloaded source archives are cached.

* **Return type:**
  [`Path`](https://docs.python.org/3/library/pathlib.html#pathlib.Path)

### flickpick.data.read_movielens(zip_path, , name=None)

Parse ratings, movies, links and tags out of a MovieLens zip.

* **Return type:**
  [`MovieLens`](#flickpick.data.MovieLens)
