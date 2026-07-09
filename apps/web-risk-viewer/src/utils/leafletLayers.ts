// Helpers that turn a ProductConfig + the joined data (crop_loss_metrics.json
// / county_climatology.json) into things react-leaflet can render: a style
// function for <GeoJSON>, and a resolved value for a given county.
//
// Vector data model: counties_simplified.geojson holds ONLY geometry +
// geoid/name (no metric columns - keeps the file small and static across
// every product). crop_loss_metrics.json / county_climatology.json hold the
// metric columns, keyed by geoid (+crop, +week_group for the forecast
// metrics). Components join them here rather than the server/prep step
// duplicating geometry per row.

import type { PathOptions } from "leaflet";
import { RISK_CLASS_ORDER, interpolateColor } from "../config/legends";
import type { CountyClimatology, CropLossMetric, ProductConfig, WeekId } from "../types/products";

export type MetricsIndex = Map<string, CropLossMetric>;
export type ClimatologyIndex = Map<string, CountyClimatology>;

function metricKey(geoid: string, crop: string, week: string): string {
  return `${geoid}|${crop}|${week}`;
}

export function buildMetricsIndex(rows: CropLossMetric[]): MetricsIndex {
  const idx: MetricsIndex = new Map();
  for (const row of rows) idx.set(metricKey(row.geoid, row.crop, row.week_group), row);
  return idx;
}

export function buildClimatologyIndex(rows: CountyClimatology[]): ClimatologyIndex {
  const idx: ClimatologyIndex = new Map();
  for (const row of rows) idx.set(`${row.geoid}|${row.crop}`, row);
  return idx;
}

/**
 * Resolve the metric row for a county at the selected week. For the
 * "wk3_6" aggregate, combine week3-6 by taking the highest-risk week for
 * that county (mirrors the backend's own peak-risk-week aggregation in
 * 07_generate_products.py, computed here client-side since the per-week
 * rows are what's actually shipped to the browser).
 */
const FORECAST_WEEKS: WeekId[] = ["week3", "week4", "week5", "week6"];

export function resolveMetricRow(idx: MetricsIndex, geoid: string, crop: string, week: WeekId): CropLossMetric | undefined {
  if (week !== "wk3_6") return idx.get(metricKey(geoid, crop, week));

  const rows = FORECAST_WEEKS.map((w) => idx.get(metricKey(geoid, crop, w))).filter((r): r is CropLossMetric => !!r);
  if (rows.length === 0) return undefined;
  return rows.reduce((best, r) => (r.risk_score > best.risk_score ? r : best));
}

/** Metric row per forecast week (week3..week6, in order) - undefined slots preserved so charts can still show all 4 x-axis ticks. */
export function getWeeklySeries(idx: MetricsIndex, geoid: string, crop: string): (CropLossMetric | undefined)[] {
  return FORECAST_WEEKS.map((w) => idx.get(metricKey(geoid, crop, w)));
}

function riskClassValue(riskClass: string): number {
  const i = RISK_CLASS_ORDER.indexOf(riskClass as (typeof RISK_CLASS_ORDER)[number]);
  return i === -1 ? 0 : i;
}

/** Numeric value for a given product from a resolved metric/climatology row - used for both styling and the info panel. */
export function getCountyValue(
  product: ProductConfig,
  metricsIdx: MetricsIndex,
  climatologyIdx: ClimatologyIndex,
  geoid: string,
): number | undefined {
  if (product.productType === "climatology_baseline") {
    const row = climatologyIdx.get(`${geoid}|${product.crop}`);
    return row?.mean_stress_f;
  }

  const row = resolveMetricRow(metricsIdx, geoid, product.crop, product.week);
  if (!row) return undefined;

  switch (product.productType) {
    case "crop_loss_probability":
      return row.prob_below_normal_yield;
    case "expected_yield_reduction":
      return row.expected_reduction_pct;
    case "risk_classification":
      return riskClassValue(row.risk_class);
    default:
      return undefined;
  }
}

export function styleForValue(product: ProductConfig, value: number | undefined): PathOptions {
  if (value === undefined) {
    return { fillColor: "#e5e5e5", fillOpacity: 0.4, color: "#999", weight: 0.5 };
  }
  const color = interpolateColor(product.colorRamp, value, product.vmin, product.vmax);
  return { fillColor: color, fillOpacity: 0.75, color: "#4a4a4a", weight: 0.4 };
}
