// Mirrors apps/damage-api/app/models.py + the raw shapes 14_generate_damage_products.py
// writes (damage_summary.json / county_damage.geojson) - this app is a live
// consumer of the FastAPI service in apps/damage-api, not a static-file reader.

export type HazardType = "hail" | "flood" | "frost_freeze" | "heat";
export type EventStatus = "pending" | "fetched" | "assessed";

export interface DamageEvent {
  event_id: string;
  hazard_type: HazardType;
  confirmed_date: string;
  source: string;
  geoids: string[];
  crop: string | null;
  magnitude: number | null;
  status: EventStatus;
}

export interface EventListResponse {
  n_events: number;
  events: DamageEvent[];
}

export interface CountyDamageRow {
  geoid: string;
  county_name: string;
  state_fips: number | string;
  event_id: string;
  crop: string;
  sensor: string;
  damage_anomaly_mean: number;
  n_cells: number;
}

export interface DamageSummary {
  event_id: string;
  event_metadata: DamageEvent | null;
  n_counties_affected: number;
  mean_damage_anomaly: number | null;
  max_damage_anomaly: number | null;
  counties: CountyDamageRow[];
  note: string;
}

export interface DamageGeoJSON {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: CountyDamageRow;
    geometry: GeoJSON.Geometry;
  }>;
}

// --- Real-time crop-loss probability (15_predict_realtime_crop_loss.py) ---

export interface RealtimeCountyRow {
  geoid: string;
  county_name: string;
  state_fips: number | string;
  crop: string;
  window_start: string;
  window_end: string;
  mean_stress_f: number;
  max_stress_f: number;
  stress_days: number;
  cum_stress_f: number;
  predicted_residual: number;
  trend_yield_t_ha: number;
  predicted_yield_t_ha: number;
  expected_reduction_abs_t_ha: number;
  expected_reduction_pct: number;
  prob_below_normal_yield: number;
  pi_lower_90_t_ha: number;
  pi_upper_90_t_ha: number;
  confidence_score: number;
  model_type: string;
  n_cells: number;
  satellite_sensor: string | null;
  satellite_damage_anomaly: number | null;
}

export interface RealtimeCropLossSummary {
  crop: string;
  window_start: string | null;
  window_end: string | null;
  n_counties: number;
  mean_prob_below_normal_yield: number | null;
  max_prob_below_normal_yield: number | null;
  counties: RealtimeCountyRow[];
  note: string;
}

export interface RealtimeCropLossGeoJSON {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: RealtimeCountyRow;
    geometry: GeoJSON.Geometry;
  }>;
}

// --- Observed crop health, before/after (16/17_*.py, on-demand field endpoint) ---

export interface CountyAcresAffected {
  n_fields: number;
  total_acres: number;
  n_fields_affected: number;
  acres_affected: number;
  pct_acres_affected: number | null;
}

export interface ObservedProbability {
  mean_after_lst_f: number | null;
  stress_f_proxy: number | null;
  prob_below_normal_yield: number | null;
  expected_reduction_pct: number | null;
  confidence_score: number | null;
  model_type: string;
}

export interface ForecastProbability {
  week_group: string;
  prob_below_normal_yield: number;
  expected_reduction_pct: number;
  risk_class: string;
}

export interface CountyCropHealth {
  geoid: string;
  county_name: string;
  crop: string;
  acres: CountyAcresAffected;
  observed: ObservedProbability;
  forecast: ForecastProbability | null;
}

export interface CropHealthSummary {
  event_id: string;
  crop: string;
  threshold_f: number;
  note: string;
  counties: Record<string, CountyCropHealth>;
}

export interface FieldListItem {
  csb_id: string;
  acres: number;
}

export interface FieldListResponse {
  geoid: string;
  crop: string;
  n_fields: number;
  fields: FieldListItem[];
}

export interface FieldSensorValues {
  s2_ndvi: number | null;
  s2_ndmi: number | null;
  s1_backscatter: number | null;
  modis_lst: number | null;
  viirs_lst: number | null;
}

export interface FieldBeforeAfter {
  event_id: string;
  crop: string;
  geoid: string;
  csb_id: string;
  acres: number;
  windows: {
    before: { start: string; end: string };
    after: { start: string; end: string };
  };
  before: FieldSensorValues;
  after: FieldSensorValues;
  note: string;
}

// --- Crop health map manifest (18_generate_crop_health_maps.py's static output) ---

export interface CropHealthMapWindow {
  png: string;
  bounds: [[number, number], [number, number]];
  value_range: [number, number];
  valid_pixel_pct: number;
}

export interface CropHealthMapManifest {
  event_id: string;
  date_windows: {
    before: { start: string; end: string };
    after: { start: string; end: string };
  };
  sensors: Record<
    string,
    {
      label: string;
      windows: { before?: CropHealthMapWindow; after?: CropHealthMapWindow };
    }
  >;
}
