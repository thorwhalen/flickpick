/**
 * Mean and 95% bootstrap interval per ranking metric (all on a 0-1 scale): one row per metric,
 * a dot at the mean and a whisker across the interval (none when the interval is not reported,
 * i.e. `low`/`high` are NaN). One series, so no legend; each row is
 * labelled, hovering a row shows its numbers, and a table repeats them.
 */
import { useState } from 'react';
import { defaults } from '@/defaults';
import { ChartSvg, chartBox, SvgTooltip, XAxis } from './chart-frame';
import { linearScale, niceTicks } from './scale';

export interface IntervalRow {
  label: string;
  mean: number;
  low: number;
  high: number;
}

const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(defaults.format.metricDigits) : 'n/a');
const WHISKER_CAP = 6;
/** Height of one metric's row (SVG units). */
const ROW_HEIGHT = 44;

export function IntervalChart({ rows, label }: { rows: IntervalRow[]; label: string }) {
  const box = chartBox(defaults.charts.margin.top + defaults.charts.margin.bottom + rows.length * ROW_HEIGHT);
  const { inner } = box;
  const x = linearScale([0, 1], [inner.x0, inner.x1]);
  const band = (inner.y0 - inner.y1) / rows.length;
  const rowY = (i: number) => inner.y1 + band * (i + 0.5);
  const [hover, setHover] = useState<number | null>(null);
  const r = defaults.charts.pointRadius;

  return (
    <figure className="max-w-3xl space-y-2">
      <ChartSvg label={label} box={box} onPointerLeave={() => setHover(null)}>
        {niceTicks(0, 1, defaults.charts.tickCount).map((t) => (
          <line key={t} x1={x(t)} x2={x(t)} y1={inner.y1} y2={inner.y0} stroke="var(--viz-grid)" />
        ))}
        <XAxis ticks={niceTicks(0, 1, defaults.charts.tickCount)} scale={x} y={inner.y0} label="Value (0 to 1)" box={box} />
        {rows.map((row, i) => {
          const cy = rowY(i);
          const finite = Number.isFinite(row.low) && Number.isFinite(row.high);
          return (
            // A full-width transparent band per row is the hover target (much larger than the dot).
            <g key={row.label} onPointerEnter={() => setHover(i)}>
              <rect x={0} y={cy - band / 2} width={inner.x1} height={band} fill="transparent" />
              <text x={inner.x0 - 8} y={cy + 4} textAnchor="end" style={{ fontSize: 12, fill: 'var(--viz-ink-2)' }}>
                {row.label}
              </text>
              {finite && (
                <>
                  <line x1={x(row.low)} x2={x(row.high)} y1={cy} y2={cy} stroke="var(--viz-series-1)" strokeWidth={2} />
                  <line x1={x(row.low)} x2={x(row.low)} y1={cy - WHISKER_CAP} y2={cy + WHISKER_CAP} stroke="var(--viz-series-1)" strokeWidth={2} />
                  <line x1={x(row.high)} x2={x(row.high)} y1={cy - WHISKER_CAP} y2={cy + WHISKER_CAP} stroke="var(--viz-series-1)" strokeWidth={2} />
                </>
              )}
              {Number.isFinite(row.mean) && (
                <circle cx={x(row.mean)} cy={cy} r={hover === i ? r + 2 : r + 1} fill="var(--viz-series-1)" stroke="var(--viz-surface)" strokeWidth={2} />
              )}
            </g>
          );
        })}
        {hover !== null && rows[hover] && (
          <SvgTooltip
            x={x(Number.isFinite(rows[hover].mean) ? rows[hover].mean : 0)}
            y={rowY(hover)}
            lines={[
              rows[hover].label,
              `mean ${fmt(rows[hover].mean)}`,
              Number.isFinite(rows[hover].low) ? `95% interval ${fmt(rows[hover].low)} to ${fmt(rows[hover].high)}` : 'no interval',
            ]}
          />
        )}
      </ChartSvg>
      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-1 font-normal">Metric</th>
            <th className="py-1 text-right font-normal">Mean</th>
            <th className="py-1 text-right font-normal">95% interval</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t">
              <td className="py-1">{row.label}</td>
              <td className="py-1 text-right tabular-nums">{fmt(row.mean)}</td>
              <td className="py-1 text-right tabular-nums">
                {Number.isFinite(row.low) && Number.isFinite(row.high) ? `${fmt(row.low)} to ${fmt(row.high)}` : 'not reported'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
