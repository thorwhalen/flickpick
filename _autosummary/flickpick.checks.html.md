# flickpick.checks

Argument checks shared by the cores, with the messages of `js/src/checks.ts`.

A refusal here is a `ValueError` whose text is the same in both languages (core
contract), so the two CLIs print the same `flickpick: <message>` line.

### Functions

| [`check_count`](#flickpick.checks.check_count)(name, value, minimum)   | `value` as an `int`, or a `ValueError` with the message of the TypeScript `checkCount` when it is not a whole number of at least `minimum` (a whole float such as `2.0` passes, as it must in JavaScript, where it is the number 2).   |
|--------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

### flickpick.checks.check_count(name, value, minimum)

`value` as an `int`, or a `ValueError` with the message of the TypeScript
`checkCount` when it is not a whole number of at least `minimum` (a whole float
such as `2.0` passes, as it must in JavaScript, where it is the number 2).

```pycon
>>> check_count("folds", 1, 2)
Traceback (most recent call last):
  ...
ValueError: folds must be an integer of at least 2; got 1
```

* **Return type:**
  [`int`](https://docs.python.org/3/builtins/functions.html#int)
