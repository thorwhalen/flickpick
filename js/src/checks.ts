/**
 * Argument checks shared by the core, with the messages of the Python `flickpick/checks.py`, so
 * a refusal reads the same in both CLIs (core contract).
 */

/** Refuse a count that is not an integer of at least `minimum`, with the Python `check_count` message. */
export function checkCount(name: string, value: number, minimum: number): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be an integer of at least ${minimum}; got ${value}`);
  }
}
