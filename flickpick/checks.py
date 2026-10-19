"""Argument checks shared by the cores, with the messages of ``js/src/checks.ts``.

A refusal here is a ``ValueError`` whose text is the same in both languages (core
contract), so the two CLIs print the same ``flickpick: <message>`` line.
"""

import numpy as np


def check_count(name: str, value, minimum: int) -> int:
    """``value`` as an ``int``, or a ``ValueError`` with the message of the TypeScript
    ``checkCount`` when it is not a whole number of at least ``minimum`` (a whole float
    such as ``2.0`` passes, as it must in JavaScript, where it is the number 2).

    >>> check_count("folds", 1, 2)
    Traceback (most recent call last):
      ...
    ValueError: folds must be an integer of at least 2; got 1
    """
    ok = (
        isinstance(value, (int, float, np.integer, np.floating))
        and not isinstance(value, bool)
        and float(value).is_integer()  # False for nan and inf
        and value >= minimum
    )
    if not ok:
        shown = int(value) if isinstance(value, float) and value.is_integer() else value
        raise ValueError(
            f"{name} must be an integer of at least {minimum}; got {shown}"
        )
    return int(value)
