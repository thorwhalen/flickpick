# flickpick.embedding

Sentence embeddings of catalogue text and of mood queries.

The model is fixed per artifact set (`manifest["embedding"]["model"]`, by default
`BAAI/bge-small-en-v1.5`, 384-d). Encoding goes through the in-house `ef` package’s
sentence-transformers adapter when `ef` is importable, else through
`sentence-transformers` directly; either way it needs the optional `[embed]` extra
(`pip install 'flickpick[embed]'`). Vectors are always returned L2-normalised float32.

### Functions

| [`embed_texts`](#flickpick.embedding.embed_texts)(texts, \*[, model, prefix])        | L2-normalised float32 embeddings of `prefix + text` for each text.    |
|-------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------|
| [`embedding_spec`](#flickpick.embedding.embedding_spec)(\*[, model, dim, query_prefix]) | The manifest `embedding` entry for vectors of `semantic_text`.        |
| [`get_encoder`](#flickpick.embedding.get_encoder)([model, batch_size])               | A batch text encoder `texts -> array(n, dim)` for `model` (cached).   |
| [`l2_normalise`](#flickpick.embedding.l2_normalise)(x)                                | Rows of `x` scaled to unit L2 norm (zero rows stay zero), as float32. |

### flickpick.embedding.embed_texts(texts, , model='BAAI/bge-small-en-v1.5', prefix='')

L2-normalised float32 embeddings of `prefix + text` for each text.

* **Return type:**
  `ndarray`

### flickpick.embedding.embedding_spec(, model='BAAI/bge-small-en-v1.5', dim=384, query_prefix='')

The manifest `embedding` entry for vectors of `semantic_text`.

* **Return type:**
  [`dict`](https://docs.python.org/3/builtins/stdtypes.html#dict)

### flickpick.embedding.get_encoder(model='BAAI/bge-small-en-v1.5', , batch_size=64)

A batch text encoder `texts -> array(n, dim)` for `model` (cached).

* **Return type:**
  [`Callable`](https://docs.python.org/3/library/collections.abc.html#collections.abc.Callable)[[[`Sequence`](https://docs.python.org/3/library/collections.abc.html#collections.abc.Sequence)[[`str`](https://docs.python.org/3/builtins/stdtypes.html#str)]], `ndarray`]

### flickpick.embedding.l2_normalise(x)

Rows of `x` scaled to unit L2 norm (zero rows stay zero), as float32.

* **Return type:**
  `ndarray`
