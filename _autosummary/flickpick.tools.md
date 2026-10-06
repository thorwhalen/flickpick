# flickpick.tools

The command surface: plain functions returning JSON-able values (SSOT for the CLI).

`python -m flickpick <command> --help` lists each command’s options; the same list,
`CLI_FUNCS`, is what any later surface (MCP, HTTP) should project.

```pycon
>>> [f.__name__ for f in CLI_FUNCS]
['build', 'recommend', 'evaluate']
```

### Module Attributes

| [`CLI_CONFIG`](#flickpick.tools.CLI_CONFIG)   | per-parameter argparse settings (help texts; repeatable genre options; --embeddings/--no-embeddings)   |
|---------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|

### Functions

| [`build`](#flickpick.tools.build)([out, sample, topk, n_items, embeddings])   | Build an artifact set from MovieLens (ml-32m, or ml-latest-small with --sample).   |
|----------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------|
| [`cli_egress`](#flickpick.tools.cli_egress)(result, \*[, out, err])                | Print a list one item per line, a string as is, anything else as JSON.             |
| [`default_artifacts_dir`](#flickpick.tools.default_artifacts_dir)(\*[, sample])               | Where `build` writes by default: `<data home>/artifacts/<dataset>`.                |
| [`evaluate`](#flickpick.tools.evaluate)([artifacts, ratings, folds, k, seed])    | Personal benchmark: k-fold holdout metrics, agreement and a cross-validated fit.   |
| [`recommend`](#flickpick.tools.recommend)([artifacts, ratings, mood, ...])        | Recommend `k` unrated films for the ratings in a CSV (any supported export).       |

### flickpick.tools.CLI_CONFIG *= {'build': {'embeddings': {'action': <class 'argparse.BooleanOptionalAction'>, 'help': 'embed semantic_text (needs flickpick[embed])'}, 'n_items': {'help': 'number of most-rated films in the artifact set'}, 'out': {'help': 'output directory (default: <data home>/artifacts/<dataset>)'}, 'sample': {'help': 'build from ml-latest-small instead of ml-32m'}, 'topk': {'help': 'neighbours kept per item in the EASE matrix'}}, 'evaluate': {'artifacts': {'help': 'artifact set directory (default: the latest one built in the data home)'}, 'folds': {'help': 'number of holdout folds'}, 'k': {'help': 'cutoff for the ranking metrics'}, 'ratings': {'help': 'ratings CSV: Letterboxd, IMDb, MovieLens or flickpick export'}, 'seed': {'help': 'seed of the fold shuffle and the bootstrap (mulberry32)'}}, 'recommend': {'artifacts': {'help': 'artifact set directory (default: the latest one built in the data home)'}, 'exclude_genres': {'action': 'append', 'help': 'drop films with any of these genres (repeatable)', 'metavar': 'GENRE'}, 'include_genres': {'action': 'append', 'help': 'keep films with any of these genres (repeatable)', 'metavar': 'GENRE'}, 'json': {'help': 'print full records as JSON'}, 'k': {'help': 'number of recommendations'}, 'mood': {'help': 'free-text mood, matched against the embeddings'}, 'ratings': {'help': 'ratings CSV: Letterboxd, IMDb, MovieLens or flickpick export'}, 'year_max': {'help': 'latest release year'}, 'year_min': {'help': 'earliest release year'}}}*

per-parameter argparse settings (help texts; repeatable genre options;
–embeddings/–no-embeddings)

### flickpick.tools.build(out=None, , sample=False, topk=100, n_items=10000, embeddings=True)

Build an artifact set from MovieLens (ml-32m, or ml-latest-small with –sample).

Writes to `out` (default: the data home). Returns a summary of what was built.

* **Return type:**
  [`dict`](https://docs.python.org/3/builtins/stdtypes.html#dict)

### flickpick.tools.cli_egress(result, , out=None, err=None)

Print a list one item per line, a string as is, anything else as JSON.

* **Return type:**
  [`int`](https://docs.python.org/3/builtins/functions.html#int)

### flickpick.tools.default_artifacts_dir(, sample=False)

Where `build` writes by default: `<data home>/artifacts/<dataset>`.

* **Return type:**
  [`Path`](https://docs.python.org/3/library/pathlib.html#pathlib.Path)

### flickpick.tools.evaluate(artifacts=None, ratings=None, , folds=5, k=10, seed=0)

Personal benchmark: k-fold holdout metrics, agreement and a cross-validated fit.

* **Return type:**
  [`dict`](https://docs.python.org/3/builtins/stdtypes.html#dict)

### flickpick.tools.recommend(artifacts=None, ratings=None, , mood=None, include_genres=None, exclude_genres=None, year_min=None, year_max=None, k=10, json=False)

Recommend `k` unrated films for the ratings in a CSV (any supported export).

Returns one line per film (`rank. title (year)  score=...  because: ...`), or,
with `json`, a dict holding the full `Recommendation` records.
