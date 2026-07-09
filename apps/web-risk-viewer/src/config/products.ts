// ---------------------------------------------------------------------------
// CENTRAL PRODUCT REGISTRY
//
// This is the single source of truth for every layer the app can show.
// Components (ProductSelector, MapView, Legend, CountyInfoPanel, ...) must
// read product metadata from here - never hard-code a product id, file
// path, color, or threshold inline in a component.
//
// HOW TO CONNECT REAL DATA / ADD A NEW PRODUCT:
//   1. Run `python data_pipelines/pipelines/08_prepare_webapp_data.py` to
//      (re)generate apps/web-risk-viewer/public/data/*. That script is the
//      bridge between the Python pipeline's real outputs and this app.
//   2. If you're adding a genuinely new product type/crop/week that the
//      pipeline doesn't produce yet, add a resolver branch below (or a new
//      RASTER_ASSET_TEMPLATES / vectorPropertyKey mapping) rather than
//      hard-coding a one-off entry - the goal is that every future product
//      slots into this same generation loop.
//   3. Entries with dataAvailable=false render a clear "not yet connected"
//      state in MapView.tsx/Legend.tsx instead of silently showing nothing.
// ---------------------------------------------------------------------------

import type { CropId, ProductConfig, ProductType, ReferenceMode, WeekId } from "../types/products";
import { getColorRamp } from "./legends";

export const CROPS: { id: CropId; label: string }[] = [
  { id: "corn", label: "Corn" },
  { id: "grape", label: "Grapes" },
];

export const PRODUCT_TYPES: { id: ProductType; label: string; defaultLayerType: "raster" | "vector" }[] = [
  { id: "crop_stress", label: "Crop Stress", defaultLayerType: "raster" },
  { id: "heatwave_probability", label: "Heatwave Probability", defaultLayerType: "raster" },
  { id: "crop_loss_probability", label: "Crop Loss Probability", defaultLayerType: "vector" },
  { id: "expected_yield_reduction", label: "Expected Yield Reduction", defaultLayerType: "vector" },
  { id: "risk_classification", label: "Risk Classification", defaultLayerType: "vector" },
  { id: "climatology_baseline", label: "Climatology Baseline", defaultLayerType: "vector" },
];

export const WEEKS: { id: WeekId; label: string }[] = [
  { id: "week3", label: "Week 3" },
  { id: "week4", label: "Week 4" },
  { id: "week5", label: "Week 5" },
  { id: "week6", label: "Week 6" },
  { id: "wk3_6", label: "Weeks 3–6 Aggregate" },
];

export const REFERENCE_MODES: { id: ReferenceMode; label: string }[] = [
  { id: "forecast", label: "Forecast" },
  { id: "historical_climatology", label: "Historical Climatology" },
  { id: "forecast_anomaly", label: "Forecast Anomaly vs Climatology" },
];

export const FORECAST_INIT_DATE = "2026-06-20";
export const FORECAST_DATE_DIR = "20260620";

// Full-CONUS extent shared by every raster in this prototype (see
// 08_prepare_webapp_data.py / raster_catalog.json's conus_bounds). If a
// future product is cropped to a smaller bbox, give that ProductConfig
// entry its own `bounds` instead of this constant.
export const CONUS_BOUNDS: [[number, number], [number, number]] = [
  [25.066666666666666, -124.76666663333334],
  [49.400000000000006, -67.05833330000002],
];

const OLD_CATALOG_GROUP: Record<CropId, "corn" | "grapes"> = { corn: "corn", grape: "grapes" };
// Highest available exceedance threshold per crop = the "heatwave probability" default.
const HEATWAVE_THRESHOLD_F: Record<CropId, number> = { corn: 100, grape: 110 };

const VECTOR_PROPERTY_KEY: Partial<Record<ProductType, string>> = {
  crop_loss_probability: "prob_below_normal_yield",
  expected_yield_reduction: "expected_reduction_pct",
  risk_classification: "risk_class",
  climatology_baseline: "mean_stress_f",
};

const VMIN_VMAX: Record<ProductType, [number, number]> = {
  crop_stress: [0, 15],
  heatwave_probability: [0, 1],
  crop_loss_probability: [0, 1],
  expected_yield_reduction: [0, 25],
  risk_classification: [0, 4],
  climatology_baseline: [0, 15],
};

const UNITS: Record<ProductType, string> = {
  crop_stress: "°F excess",
  heatwave_probability: "probability (0-1)",
  crop_loss_probability: "probability (0-1)",
  expected_yield_reduction: "%",
  risk_classification: "class",
  climatology_baseline: "°F excess",
};

function displayName(crop: CropId, productType: ProductType, week: WeekId): string {
  const cropLabel = CROPS.find((c) => c.id === crop)!.label;
  const typeLabel = PRODUCT_TYPES.find((p) => p.id === productType)!.label;
  const weekLabel = WEEKS.find((w) => w.id === week)!.label;
  return `${cropLabel} — ${typeLabel} — ${weekLabel}`;
}

/**
 * Just the product-type label ("Crop Stress"), no crop/week suffix - used
 * wherever crop/week are already shown elsewhere on screen (the legend
 * title and the info panel's "Product" field), so we don't repeat
 * "Corn — Crop Stress — Weeks 3–6 Aggregate" next to the crop/week
 * selectors that already say the same thing.
 */
export function getProductTypeLabel(productType: ProductType): string {
  return PRODUCT_TYPES.find((p) => p.id === productType)?.label ?? productType;
}

/** week3/4/5/6 -> the old catalog's matching week key ("any_week" stands in for wk3_6). */
function oldCatalogWeek(week: WeekId): string {
  return week === "wk3_6" ? "any_week" : week;
}

function rasterEntry(
  crop: CropId,
  productType: ProductType,
  week: WeekId,
  referenceMode: ReferenceMode,
): Pick<ProductConfig, "rasterUrl" | "cogUrl" | "dataAvailable" | "description"> {
  const group = OLD_CATALOG_GROUP[crop];
  const catWeek = oldCatalogWeek(week);

  if (productType === "crop_stress" && referenceMode === "forecast") {
    // Phase 2's own crop-fraction-masked stress product (the authoritative source for this product).
    const url = `/data/rasters/${crop}_crop_stress_${week}.png`;
    return {
      rasterUrl: url,
      cogUrl: `data_pipelines/products/crop_stress/forecast/${FORECAST_DATE_DIR}/${crop}/${week === "wk3_6" ? "week3" : week}/mean_stress_F.tif`,
      dataAvailable: true,
      description: `Crop-fraction-masked forecast heat stress (excess °F above the crop's base threshold), ${crop === "corn" ? "corn" : "grape"} CDL mask, ensemble mean.`,
    };
  }

  if (productType === "heatwave_probability" && referenceMode === "forecast") {
    // Crop-fraction-masked (04_generate_forecast_crop_stress.py), NOT the older
    // generate_s2s_ui_map_products.py catalog - that pipeline never applied a CDL
    // mask, so its "grapes" heatwave layer showed probability over the whole
    // CONUS grid rather than just grape-growing cells.
    const url = `/data/rasters/${crop}_heatwave_prob_gt_${HEATWAVE_THRESHOLD_F[crop]}F_${week}.png`;
    return {
      rasterUrl: url,
      cogUrl: `data_pipelines/products/crop_stress/forecast/${FORECAST_DATE_DIR}/${crop}/${week === "wk3_6" ? "week3" : week}/heatwave_prob_gt_${HEATWAVE_THRESHOLD_F[crop]}F.tif`,
      dataAvailable: true,
      description: `Crop-fraction-masked probability the 50-member S2S ensemble exceeds ${HEATWAVE_THRESHOLD_F[crop]}°F (fraction of members), ${crop === "corn" ? "corn" : "grape"} CDL mask.`,
    };
  }

  if (productType === "heatwave_probability" && referenceMode === "forecast_anomaly") {
    // No crop-masked anomaly product exists yet - falls back to the older,
    // unmasked catalog's Tmax-anomaly layer as the closest real proxy.
    const url = `/data/rasters/climatology_anomaly_${catWeek}_tmax_anomaly_F.png`;
    return {
      rasterUrl: url,
      dataAvailable: true,
      description: `Forecast Tmax anomaly vs 2015-2025 climatology (not crop-masked) — closest real proxy for a heatwave-probability anomaly; no crop-masked probability-anomaly product has been generated yet.`,
    };
  }

  if (productType === "climatology_baseline" && referenceMode === "forecast") {
    const url = `/data/rasters/${group}_${catWeek}_climatological_percentile.png`;
    return {
      rasterUrl: url,
      dataAvailable: true,
      description: `Where this forecast's Tmax falls within the 2015-2025 climatology distribution (percentile, not a raw baseline value — no standalone historical-mean raster has been generated yet).`,
    };
  }

  return { dataAvailable: false, description: "No raster product has been generated yet for this combination." };
}

function vectorEntry(productType: ProductType, referenceMode: ReferenceMode): Pick<ProductConfig, "dataAvailable" | "description"> {
  if (productType === "climatology_baseline") {
    return {
      dataAvailable: referenceMode === "forecast",
      description: "Real 2015-2022 per-county historical mean crop heat stress (season-level; does not vary by week).",
    };
  }
  if (referenceMode === "forecast") {
    return { dataAvailable: true, description: "" };
  }
  return { dataAvailable: false, description: "No historical/anomaly version of this crop-loss product has been generated yet." };
}

function buildRegistry(): ProductConfig[] {
  const entries: ProductConfig[] = [];

  for (const { id: crop } of CROPS) {
    for (const { id: productType, defaultLayerType } of PRODUCT_TYPES) {
      for (const { id: week } of WEEKS) {
        for (const { id: referenceMode } of REFERENCE_MODES) {
          const [vmin, vmax] = VMIN_VMAX[productType];
          const base: ProductConfig = {
            id: `${crop}_${productType}_${week}_${referenceMode}`,
            displayName: displayName(crop, productType, week),
            crop,
            productType,
            week,
            referenceMode,
            layerType: defaultLayerType,
            units: UNITS[productType],
            description: "",
            colorRamp: getColorRamp(productType),
            legendBreaks: null,
            vmin,
            vmax,
            dataAvailable: false,
          };

          if (defaultLayerType === "raster") {
            Object.assign(base, rasterEntry(crop, productType, week, referenceMode), { bounds: CONUS_BOUNDS });
          } else {
            Object.assign(base, vectorEntry(productType, referenceMode), {
              vectorPropertyKey: VECTOR_PROPERTY_KEY[productType],
            });
          }

          entries.push(base);
        }
      }
    }
  }

  return entries;
}

export const PRODUCT_REGISTRY: ProductConfig[] = buildRegistry();

export function getProduct(
  crop: CropId,
  productType: ProductType,
  week: WeekId,
  referenceMode: ReferenceMode,
): ProductConfig | undefined {
  return PRODUCT_REGISTRY.find(
    (p) => p.crop === crop && p.productType === productType && p.week === week && p.referenceMode === referenceMode,
  );
}

/**
 * Convenience ids matching the exact examples in the spec, e.g.
 * "corn_crop_stress_week3" -> resolves to the forecast-reference entry.
 * Kept for readability/back-compat with the spec's example naming; internal
 * lookups should prefer getProduct() with explicit reference mode.
 */
export function getProductBySimpleId(simpleId: string): ProductConfig | undefined {
  return PRODUCT_REGISTRY.find((p) => `${p.crop}_${p.productType}_${p.week}` === simpleId && p.referenceMode === "forecast");
}
