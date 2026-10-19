# flickpick.checks

Argument checks shared by the cores, with the messages of `js/src/checks.ts`.

A refusal here is a `ValueError` whose text is the same in both languages (core
contract), so the two CLIs print the same `flickpick: <message>` line.

### Module Attributes

| [`MAX_COUNT`](#flickpick.checks.MAX_COUNT)   | the largest integer both languages hold exactly (`Number.MAX_SAFE_INTEGER`, 2^53 - 1)   |
|--------------------------------------------------------------|-----------------------------------------------------------------------------------------|

### Functions

| [`check_count`](#flickpick.checks.check_count)(name, value, minimum)   | `value` as an `int`, or a `ValueError` with the message of the TypeScript `checkCount` when it is not a whole number of at least `minimum` (a whole float such as `2.0` passes, as it must in JavaScript, where it is the number 2).   |
|--------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

### flickpick.checks.MAX_COUNT *= 9007199254740991*

the largest integer both languages hold exactly (`Number.MAX_SAFE_INTEGER`, 2^53 - 1)

### flickpick.checks.check_count(name, value, minimum)

`value` as an `int`, or a `ValueError` with the message of the TypeScript
`checkCount` when it is not a whole number of at least `minimum` (a whole float
such as `2.0` passes, as it must in JavaScript, where it is the number 2).

Beyond [`MAX_COUNT`](#flickpick.checks.MAX_COUNT) the refusal names no value: JavaScript cannot print such an
integer exactly, and the message must be the same in both languages (#13).

```pycon
>>> check_count("folds", 1, 2)
Traceback (most recent call last):
  ...
ValueError: folds must be an integer of at least 2; got 1
>>> check_count("k", 10**20, 1)
Traceback (most recent call last):
  ...
ValueError: k must be an integer of at most 9007199254740991 in absolute value
```

* **Return type:**
  [`int`](https://docs.python.org/3/builtins/functions.html#int)
