/**
 * Scatter of your score (y) against the population's mean rating (x), both 0-100, with the
 * least-squares line. One series of dots (blue) plus the fitted line (orange), so a two-entry
 * legend; hovering finds the nearest dot (a 24px reach, not pixel-hunting) and names the film.
 * The same data is available as a table below the chart.
 */
import { useState } from 'react';
import { defaults } from '@/defaults';
import { ChartSvg, chartBox, SvgTooltip, svgPoint, XAxis, YGrid } from './chart-frame';
import { linearScale, niceTicks } from './scale';

export interface AgreementPoint {
  x: number;
  y: number;
  label: string;
}

/** How close (SVG units) the pointer must be to a dot to show its tooltip. */
const HOVER_REACH = 24;

export function AgreementChart({ points, slope, intercept }: { points: AgreementPoint[]; slope: number; intercept: number }) {
  const { inner } = chartBox();
  const { min, max } = defaults.rating;
  const x = linearScale([min, max], [inner.x0, inner.x1]);
  const y = linearScale([min, max], [inner.y0, inner.y1]);
  const ticks = niceTicks(min, max, defaults.charts.tickCount);
  const [hover, setHover] = useState<AgreementPoint | null>(null);
  const r = defaults.charts.pointRadius;
  const hasLine = Number.isFinite(slope) && Number.isFinite(intercept);
  // Draw the fitted line over the range of the data only (extrapolating it would claim more than
  // the fit knows), and only where it stays inside the 0-100 box (cut, never bent).
  const xs = points.map((p) => p.x);
  const segment = (() => {
    if (!hasLine || !xs.length) return null;
    let [a, b] = [Math.min(...xs), Math.max(...xs)];
    if (slope !== 0) {
      const [atMin, atMax] = [(min - intercept) / slope, (max - intercept) / slope];
      a = Math.max(a, Math.min(atMin, atMax));
      b = Math.min(b, Math.max(atMin, atMax));
    }
    return a < b ? { a, b } : null;
  })();
  const lineAt = (v: number) => slope * v + intercept;

  return (
    <figure className="max-w-3xl space-y-2">
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <svg width="10" height="10">
            <circle cx="5" cy="5" r="4" fill="var(--viz-series-1)" />
          </svg>
          a film you rated
        </span>
        {hasLine && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="16" height="10">
              <line x1="0" x2="16" y1="5" y2="5" stroke="var(--viz-series-2)" strokeWidth="2" />
            </svg>
            least-squares line
          </span>
        )}
      </div>
      <ChartSvg
        label={`Scatter of ${points.length} of your scores against the population mean rating`}
        onPointerMove={(e) => {
          const p = svgPoint(e);
          let best: AgreementPoint | null = null;
          let bestD = HOVER_REACH;
          for (const pt of points) {
            const d = Math.hypot(x(pt.x) - p.x, y(pt.y) - p.y);
            if (d < bestD) [best, bestD] = [pt, d];
          }
          setHover(best);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <YGrid ticks={ticks} scale={y} label="Your score" />
        <XAxis ticks={ticks} scale={x} y={inner.y0} label="Population mean rating (MovieLens, 0-100)" />
        {points.map((pt, i) => (
          <circle
            key={i}
            cx={x(pt.x)}
            cy={y(pt.y)}
            r={hover === pt ? r + 2 : r}
            fill="var(--viz-series-1)"
            fillOpacity={0.75}
            stroke="var(--viz-surface)"
            strokeWidth={2}
          />
        ))}
        {segment && (
          <line x1={x(segment.a)} y1={y(lineAt(segment.a))} x2={x(segment.b)} y2={y(lineAt(segment.b))} stroke="var(--viz-series-2)" strokeWidth={2} />
        )}
        {hover && (
          <SvgTooltip x={x(hover.x)} y={y(hover.y)} lines={[hover.label, `you ${hover.y.toFixed(0)} · population ${hover.x.toFixed(0)}`]} />
        )}
      </ChartSvg>
      <details className="text-sm">
        <summary className="cursor-pointer text-primary">Show as a table</summary>
        <div className="mt-2 max-h-72 overflow-auto rounded border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="px-2 py-1">Film</th>
                <th className="px-2 py-1 text-right">You</th>
                <th className="px-2 py-1 text-right">Population</th>
              </tr>
            </thead>
            <tbody>
              {points.map((pt, i) => (
                <tr key={i} className="border-t">
                  <td className="px-2 py-1">{pt.label}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{pt.y.toFixed(0)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{pt.x.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
