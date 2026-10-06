/**
 * Shared chart pieces: the SVG frame (scales to its container), gridlines with tick labels, and a
 * hover tooltip. Colours come from the `--viz-*` CSS variables (light and dark in index.css).
 */
import type { ReactNode } from 'react';
import { defaults } from '@/defaults';

/** The chart frame: overall size, margins, and the plotting area's edges (y0 is the bottom). */
export const chartBox = (height: number = defaults.charts.height) => {
  const { width, margin } = defaults.charts;
  return { width, height, margin, inner: { x0: margin.left, x1: width - margin.right, y0: height - margin.bottom, y1: margin.top } };
};
export type ChartBox = ReturnType<typeof chartBox>;

export function ChartSvg({ label, children, onPointerMove, onPointerLeave, box = chartBox() }: {
  label: string;
  box?: ChartBox;
  children: ReactNode;
  onPointerMove?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerLeave?: () => void;
}) {
  const { width, height } = box;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full rounded-md"
      style={{ background: 'var(--viz-surface)', fontFamily: 'system-ui, sans-serif' }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </svg>
  );
}

/** Convert a pointer event to the SVG's own coordinates (the SVG is scaled by CSS). */
export function svgPoint(e: React.PointerEvent<SVGSVGElement>, box: ChartBox = chartBox()): { x: number; y: number } {
  const svg = e.currentTarget;
  const rect = svg.getBoundingClientRect();
  const { width, height } = box;
  return { x: ((e.clientX - rect.left) / rect.width) * width, y: ((e.clientY - rect.top) / rect.height) * height };
}

const tickText = { fontSize: 12, fill: 'var(--viz-muted)' } as const;
const titleText = { fontSize: 13, fill: 'var(--viz-ink-2)' } as const;

export function XAxis({ ticks, scale, y, label, format = String, box = chartBox() }: { ticks: number[]; scale: (v: number) => number; y: number; label: string; format?: (v: number) => string; box?: ChartBox }) {
  const { inner, height } = box;
  return (
    <g>
      <line x1={inner.x0} x2={inner.x1} y1={y} y2={y} stroke="var(--viz-axis)" />
      {ticks.map((t) => (
        <text key={t} x={scale(t)} y={y + 18} textAnchor="middle" style={tickText}>
          {format(t)}
        </text>
      ))}
      <text x={(inner.x0 + inner.x1) / 2} y={height - 8} textAnchor="middle" style={titleText}>
        {label}
      </text>
    </g>
  );
}

export function YGrid({ ticks, scale, label, format = String }: { ticks: number[]; scale: (v: number) => number; label: string; format?: (v: number) => string }) {
  const { inner } = chartBox();
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={inner.x0} x2={inner.x1} y1={scale(t)} y2={scale(t)} stroke="var(--viz-grid)" />
          <text x={inner.x0 - 8} y={scale(t) + 4} textAnchor="end" style={tickText}>
            {format(t)}
          </text>
        </g>
      ))}
      <text transform={`translate(14 ${(inner.y0 + inner.y1) / 2}) rotate(-90)`} textAnchor="middle" style={titleText}>
        {label}
      </text>
    </g>
  );
}

/** A tooltip box drawn inside the SVG near (x, y), kept within the frame. */
export function SvgTooltip({ x, y, lines }: { x: number; y: number; lines: string[] }) {
  const { width } = chartBox();
  const lineHeight = 16;
  const boxWidth = Math.max(...lines.map((l) => l.length)) * 7 + 16;
  const boxHeight = lines.length * lineHeight + 10;
  const left = Math.min(Math.max(4, x + 12), width - boxWidth - 4);
  const top = Math.max(4, y - boxHeight - 8);
  return (
    <g pointerEvents="none">
      <rect x={left} y={top} width={boxWidth} height={boxHeight} rx={6} fill="var(--viz-surface)" stroke="var(--viz-axis)" />
      {lines.map((l, i) => (
        <text key={i} x={left + 8} y={top + 18 + i * lineHeight} style={{ fontSize: 12, fill: i === 0 ? 'var(--viz-ink)' : 'var(--viz-ink-2)' }}>
          {l}
        </text>
      ))}
    </g>
  );
}
