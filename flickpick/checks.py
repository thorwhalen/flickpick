"""Argument checks shared by the cores, with the messages of ``js/src/checks.ts``.

A refusal here is a ``ValueError`` whose text is the same in both languages (core
contract), so the two CLIs print the same ``flickpick: <message>`` line.
"""

import numpy as np

#: the largest integer both languages hold exactly (``Number.MAX_SAFE_INTEGER``, 2^53 - 1)
MAX_COUNT = 2**53 - 1


def check_count(name: str, value, minimum: int) -> int:
    """``value`` as an ``int``, or a ``ValueError`` with the message of the TypeScript
    ``checkCount`` when it is not a whole number of at least ``minimum`` (a whole float
    such as ``2.0`` passes, as it must in JavaScript, where it is the number 2).

    Beyond :data:`MAX_COUNT` the refusal names no value: JavaScript cannot print such an
    integer exactly, and the message must be the same in both languages (#13).

    >>> check_count("folds", 1, 2)
    Traceback (most recent call last):
      ...
    ValueError: folds must be an integer of at least 2; got 1
    >>> check_count("k", 10**20, 1)
    Traceback (most recent call last):
      ...
    ValueError: k must be an integer of at most 9007199254740991 in absolute value
    """
    if isinstance(value, bool) or not isinstance(
        value, (int, float, np.integer, np.floating)
    ):
        whole = False
    else:  # an int is whole however large; float() of one past 1e308 would overflow
        whole = isinstance(value, (int, np.integer)) or float(value).is_integer()
    if whole and abs(value) > MAX_COUNT:
        raise ValueError(
            f"{name} must be an integer of at most {MAX_COUNT} in absolute value"
        )
    if not whole or value < minimum:
        raise ValueError(
            f"{name} must be an integer of at least {minimum}; got {_as_js(value)}"
        )
    return int(value)


def _as_js(value) -> str:
    """``value`` as JavaScript's ``String()`` prints it, for the numbers a count can be:
    ``2.0`` as ``2``, ``inf`` as ``Infinity``, ``nan`` as ``NaN``."""
    if isinstance(value, (float, np.floating)) and not isinstance(value, bool):
        if np.isnan(value):
            return "NaN"
        if np.isinf(value):
            return "Infinity" if value > 0 else "-Infinity"
        if float(value).is_integer():
            return str(int(value))
    return str(value)
