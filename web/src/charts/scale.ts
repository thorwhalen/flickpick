/**
 * Linear scales and "nice" ticks for the hand-drawn SVG charts (no chart library: the two charts
 * here need axes, points, a line and intervals, which is a few dozen lines of SVG).
 */
export type Scale = (value: number) => number;

/** Map `[d0, d1]` onto `[r0, r1]` linearly. */
export function linearScale([d0, d1]: readonly [number, number], [r0, r1]: readonly [number, number]): Scale {
  const span = d1 - d0 || 1;
  return (v) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** About `count` round tick values covering `[min, max]` (steps of 1, 2 or 5 times a power of 10). */
export function niceTicks(min: number, max: number, count: number): number[] {
  const raw = (max - min) / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? power * 10;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + step / 1e6; t += step) ticks.push(Number(t.toFixed(10)));
  return ticks;
}
