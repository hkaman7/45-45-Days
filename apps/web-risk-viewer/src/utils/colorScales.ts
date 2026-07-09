// Low-level color interpolation helpers. No product/domain knowledge here -
// config/legends.ts is where color ramps get assigned to product types.

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

export function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bch = Math.round(ab + (bb - ab) * t);
  return `#${[r, g, bch].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Interpolate a value in [vmin, vmax] to a color along a multi-stop ramp. */
export function interpolateColor(ramp: string[], value: number, vmin: number, vmax: number): string {
  if (Number.isNaN(value)) return "#cccccc";
  const t = Math.max(0, Math.min(1, (value - vmin) / (vmax - vmin || 1)));
  const scaled = t * (ramp.length - 1);
  const idx = Math.floor(scaled);
  if (idx >= ramp.length - 1) return ramp[ramp.length - 1];
  return lerpHex(ramp[idx], ramp[idx + 1], scaled - idx);
}

/** Diverging ramp for a signed damage anomaly, centered at 0 - negative -> cold,
 * positive -> hot. Used only by the Rapid Response viewer (components/DamageReportPanel.tsx). */
export function colorForAnomaly(value: number, absMax: number): string {
  if (Number.isNaN(value) || absMax === 0) return "#5b6172";
  const t = Math.max(-1, Math.min(1, value / absMax));
  if (t <= 0) return lerpHex("#3a4258", "#2f7fc4", -t);
  return lerpHex("#3a4258", "#e0472b", t);
}
