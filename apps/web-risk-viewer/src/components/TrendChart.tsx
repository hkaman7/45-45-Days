// Small hand-rolled SVG line chart - the app has no charting dependency yet
// and a 4-point weekly series doesn't need one. See FieldTrendPanel.tsx for
// the only current caller.

interface TrendPoint {
  label: string;
  value: number | undefined;
}

interface Props {
  title: string;
  unit: string;
  points: TrendPoint[];
  color: string;
  formatValue: (v: number) => string;
}

const W = 280;
const H = 150;
const MARGIN = { top: 14, right: 14, bottom: 24, left: 40 };
const PLOT_W = W - MARGIN.left - MARGIN.right;
const PLOT_H = H - MARGIN.top - MARGIN.bottom;

export function TrendChart({ title, unit, points, color, formatValue }: Props) {
  const defined = points.filter((p): p is { label: string; value: number } => p.value !== undefined);

  if (defined.length === 0) {
    return (
      <div className="trend-chart">
        <div className="trend-chart-title">
          {title} <span className="trend-chart-unit">({unit})</span>
        </div>
        <p className="muted">No weekly data available.</p>
      </div>
    );
  }

  const rawMin = Math.min(...defined.map((p) => p.value));
  const rawMax = Math.max(...defined.map((p) => p.value));
  const pad = (rawMax - rawMin) * 0.2 || Math.abs(rawMax) * 0.1 || 1;
  const yMin = rawMin - pad;
  const yMax = rawMax + pad;

  const xFor = (i: number) => MARGIN.left + (points.length === 1 ? 0.5 : i / (points.length - 1)) * PLOT_W;
  const yFor = (v: number) => MARGIN.top + (1 - (v - yMin) / (yMax - yMin)) * PLOT_H;

  const polylinePoints = points
    .map((p, i) => (p.value === undefined ? null : `${xFor(i)},${yFor(p.value)}`))
    .filter((s): s is string => s !== null)
    .join(" ");

  const gridLines = [yMin + (yMax - yMin) * 0.25, yMin + (yMax - yMin) * 0.75];

  return (
    <div className="trend-chart">
      <div className="trend-chart-title">
        {title} <span className="trend-chart-unit">({unit})</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="trend-chart-svg">
        {gridLines.map((v) => (
          <line key={v} x1={MARGIN.left} x2={W - MARGIN.right} y1={yFor(v)} y2={yFor(v)} className="trend-chart-gridline" />
        ))}
        <line
          x1={MARGIN.left}
          x2={W - MARGIN.right}
          y1={MARGIN.top + PLOT_H}
          y2={MARGIN.top + PLOT_H}
          className="trend-chart-axis"
        />

        <polyline points={polylinePoints} fill="none" stroke={color} strokeWidth={2} />

        {points.map((p, i) => (
          <g key={p.label}>
            {p.value !== undefined && (
              <>
                <circle cx={xFor(i)} cy={yFor(p.value)} r={3.5} fill={color}>
                  <title>{`${p.label}: ${formatValue(p.value)}`}</title>
                </circle>
                <text x={xFor(i)} y={yFor(p.value) - 8} textAnchor="middle" className="trend-chart-value">
                  {formatValue(p.value)}
                </text>
              </>
            )}
            <text x={xFor(i)} y={H - 6} textAnchor="middle" className="trend-chart-tick">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
