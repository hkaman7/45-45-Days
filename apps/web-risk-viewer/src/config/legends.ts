// Color ramps and legend break generators, one per product type, matching
// the exact ramps requested for the 45+45 viewer:
//   crop stress            -> yellow -> orange -> red
//   heatwave probability   -> light yellow -> dark red
//   crop-loss probability  -> light orange -> dark purple/red
//   expected yield reduction -> light red -> dark red
//   risk classification    -> green / yellow / orange / red / dark red (categorical)
//   climatology baseline   -> diverging blue - white - red
//
// Components should never inline colors - they read from here via
// getColorRamp(productType) / getLegendBreaks(product).

import type { LegendBreak, ProductConfig, ProductType } from "../types/products";
import { interpolateColor } from "../utils/colorScales";

export const COLOR_RAMPS: Record<ProductType, string[]> = {
  crop_stress: ["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"],
  heatwave_probability: ["#ffffcc", "#fed976", "#fd8d3c", "#e31a1c", "#800026"],
  crop_loss_probability: ["#feedde", "#fdbe85", "#fd8d3c", "#d94701", "#7a0177"],
  expected_yield_reduction: ["#fee5d9", "#fcae91", "#fb6a4a", "#de2d26", "#a50f15"],
  risk_classification: ["#1a9850", "#a6d96a", "#fee08b", "#fc8d59", "#8b0000"],
  climatology_baseline: ["#2166ac", "#67a9cf", "#f7f7f7", "#ef8a62", "#b2182b"],
};

export const RISK_CLASS_ORDER = ["Very Low", "Low", "Moderate", "High", "Extreme"] as const;

export function getColorRamp(productType: ProductType): string[] {
  return COLOR_RAMPS[productType];
}

export { interpolateColor };

/** Build 5 evenly-spaced legend breaks across [vmin, vmax] for a continuous product. */
export function buildContinuousLegend(productType: ProductType, vmin: number, vmax: number, units: string): LegendBreak[] {
  const ramp = getColorRamp(productType);
  const steps = 5;
  return Array.from({ length: steps }, (_, i) => {
    const value = vmin + ((vmax - vmin) * i) / (steps - 1);
    return {
      value,
      label: `${formatLegendValue(value, units)}`,
      color: interpolateColor(ramp, value, vmin, vmax),
    };
  });
}

function formatLegendValue(value: number, units: string): string {
  if (units.includes("probability") || units === "%") return `${Math.round(value * (units === "%" ? 1 : 100))}%`;
  return `${Math.round(value * 10) / 10}${units ? ` ${units}` : ""}`;
}

export const RISK_CLASS_LEGEND: LegendBreak[] = RISK_CLASS_ORDER.map((label, i) => ({
  value: i,
  label,
  color: COLOR_RAMPS.risk_classification[i],
}));

export function getLegendBreaks(product: ProductConfig): LegendBreak[] {
  if (product.legendBreaks) return product.legendBreaks;
  if (product.productType === "risk_classification") return RISK_CLASS_LEGEND;
  return buildContinuousLegend(product.productType, product.vmin, product.vmax, product.units);
}
