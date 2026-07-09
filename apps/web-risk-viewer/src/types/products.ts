// Core domain types for the 45+45 risk viewer.
//
// The app is a *product viewer*: nothing here should ever hard-code a
// specific map. Every combination of crop / product type / week / reference
// mode is represented as a ProductConfig entry in the central registry
// (src/config/products.ts). Components read from that registry instead of
// branching on IDs.

export type CropId = "corn" | "grape";

export type ProductType =
  | "crop_stress"
  | "heatwave_probability"
  | "crop_loss_probability"
  | "expected_yield_reduction"
  | "risk_classification"
  | "climatology_baseline";

export type WeekId = "week3" | "week4" | "week5" | "week6" | "wk3_6";

export type ReferenceMode = "forecast" | "historical_climatology" | "forecast_anomaly";

export type LayerType = "raster" | "vector";

export interface LegendBreak {
  value: number;
  label: string;
  color: string;
}

/** A single entry in the central product registry. */
export interface ProductConfig {
  /** Stable id, e.g. "corn_crop_stress_week3". Unique per crop+productType+week+referenceMode. */
  id: string;
  displayName: string;
  crop: CropId;
  productType: ProductType;
  week: WeekId;
  referenceMode: ReferenceMode;
  layerType: LayerType;
  units: string;
  description: string;

  /** Color ramp (hex stops, light -> dark) used to build the legend / vector style. */
  colorRamp: string[];
  /** Optional discrete legend breaks (used for categorical products like risk classification). */
  legendBreaks: LegendBreak[] | null;
  vmin: number;
  vmax: number;

  // --- raster-only fields ---
  /** PNG used for actual on-map rendering (ImageOverlay). Relative to /public. */
  rasterUrl?: string;
  /**
   * Path to the source GeoTIFF/COG, NOT rendered directly in this static
   * prototype - kept here so a future iteration can point this at a
   * GCS-hosted COG/tile endpoint and swap the rendering strategy in
   * MapView.tsx without touching the registry shape.
   */
  cogUrl?: string;
  bounds?: [[number, number], [number, number]]; // [[southLat, westLon], [northLat, eastLon]]

  // --- vector-only fields ---
  /** Which joined metric field (see utils/leafletLayers.ts) this product reads per county. */
  vectorPropertyKey?: string;

  /**
   * False when no real generated data exists yet for this exact
   * crop/productType/week/referenceMode combination. The UI must show a
   * clear "not yet connected" state rather than pretend data exists -
   * see components/MapView.tsx's placeholder handling.
   */
  dataAvailable: boolean;
}

/** One row of the joined per-county-per-week forecast metrics (crop_loss_metrics.json). */
export interface CropLossMetric {
  geoid: string;
  crop: CropId;
  week_group: Exclude<WeekId, "wk3_6">;
  week_start_date: string;
  week_end_date: string;
  mean_stress_f: number;
  prob_below_normal_yield: number;
  expected_reduction_pct: number;
  expected_reduction_abs_t_ha: number;
  predicted_yield_t_ha: number;
  trend_yield_t_ha: number;
  confidence_score: number;
  dominant_driver: "heat_stress" | "drought" | "mixed";
  risk_score: number;
  risk_class: "Very Low" | "Low" | "Moderate" | "High" | "Extreme";
}

/** One row of the real 2015-2022 historical climatology (county_climatology.json). */
export interface CountyClimatology {
  geoid: string;
  crop: CropId;
  mean_stress_f: number;
  stress_days: number;
  gdd_cum_f: number;
  precip_cum_mm: number;
  spi90d_mean: number;
  pdsi_mean: number;
  n_years: number;
}

/** A trimmed entry from raster_catalog.json (older S2S risk-map pipeline output). */
export interface RasterCatalogLayer {
  layer_id: string;
  display_group: "corn" | "grapes" | "climatology_anomaly";
  week: string;
  map_type: string;
  threshold_F: number | null;
  png_path: string;
  color_scale: string;
  gradient_css: string;
  units: string;
  vmin: number;
  vmax: number;
  legend: { value: number; label: string }[] | null;
  description: string;
}

export interface RasterCatalog {
  forecast_init_date: string;
  conus_bounds: { lat_min: number; lat_max: number; lon_min: number; lon_max: number };
  layers: RasterCatalogLayer[];
}

export interface CountyFeatureProperties {
  geoid: string;
  county_name: string;
  state_fips: string;
}

/** Properties on a field-boundary GeoJSON feature (see 09_prepare_field_boundaries.py). */
export interface FieldFeatureProperties {
  csb_id: string;
  acres: number;
  geoid: string;
}
