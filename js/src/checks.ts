/**
 * Argument checks shared by the core, with the messages of the Python `flickpick/checks.py`, so
 * a refusal reads the same in both CLIs (core contract).
 */

/** The largest integer both languages hold exactly (2^53 - 1; Python `MAX_COUNT`). */
export const MAX_COUNT = Number.MAX_SAFE_INTEGER;

/**
 * Refuse a count that is not an integer of at least `minimum`, with the Python `check_count`
 * message. Beyond `MAX_COUNT` the message names no value, which JS cannot print exactly (#13).
 */
export function checkCount(name: string, value: number, minimum: number): void {
  if (Number.isInteger(value) && Math.abs(value) > MAX_COUNT) {
    throw new RangeError(`${name} must be an integer of at most ${MAX_COUNT} in absolute value`);
  }
  if (!Number.isInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be an integer of at least ${minimum}; got ${value}`);
  }
}
