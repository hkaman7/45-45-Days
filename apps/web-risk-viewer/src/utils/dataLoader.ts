// Fetches the JSON/GeoJSON files produced by
// data_pipelines/pipelines/08_prepare_webapp_data.py (see that script for
// exactly how each file is built from the pipeline's real outputs).
//
// To connect a NEW data source later: add a loader function here that
// fetches from wherever it lives (local /data, or eventually a GCS bucket
// URL), keeping the same return shape so components don't need to change.

import type { CountyClimatology, CropId, CropLossMetric, RasterCatalog } from "../types/products";
import type { CropHealthMapManifest, CropHealthSummary, DamageEvent, EventListResponse } from "../types/damage";
import type { FeatureCollection } from "geojson";
import { withBase } from "./basePath";

async function fetchJson<T>(path: string): Promise<T> {
  const url = withBase(path);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

export function loadCounties(): Promise<FeatureCollection> {
  return fetchJson<FeatureCollection>("/data/counties_simplified.geojson");
}

export function loadCropLossMetrics(): Promise<CropLossMetric[]> {
  return fetchJson<CropLossMetric[]>("/data/crop_loss_metrics.json");
}

export function loadCountyClimatology(): Promise<CountyClimatology[]> {
  return fetchJson<CountyClimatology[]>("/data/county_climatology.json");
}

export function loadRasterCatalog(): Promise<RasterCatalog> {
  return fetchJson<RasterCatalog>("/data/raster_catalog.json");
}

/**
 * Field-level boundaries for one county (from 09_prepare_field_boundaries.py,
 * built from USDA's Crop Sequence Boundaries). Only produced for grape/CA so
 * far - returns null (not a thrown error) for any county/crop combination
 * that doesn't have a file yet, so callers can render a "no field-level data
 * yet" state instead of treating it as a fetch failure.
 */
export async function loadCountyFields(crop: CropId, geoid: string): Promise<FeatureCollection | null> {
  const res = await fetch(withBase(`/data/fields/${crop}/${geoid}.geojson`));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch fields for ${crop}/${geoid}: ${res.status}`);
  return res.json() as Promise<FeatureCollection>;
}

/** Before/after PNG map manifest (18_generate_crop_health_maps.py's static output). */
export function loadCropHealthManifest(eventId: string): Promise<CropHealthMapManifest> {
  return fetchJson<CropHealthMapManifest>(`/data/crop_health/${eventId}/manifest.json`);
}

/** Event registry (10_detect_events.py's publish_events_for_webapp() output) - the
 * Crop Health tab's Event/County dropdowns read this directly instead of going through
 * apps/damage-api, same as every other Crop Health asset (see loadCropHealthManifest,
 * loadCropHealthSummary): none of this data is actually live, so it doesn't need a
 * running backend just to be read back. The live API (utils/api.ts) still exists and
 * still serves the same data for external consumers - this is just the path the
 * deployed static site itself uses. */
export async function loadEvents(): Promise<DamageEvent[]> {
  const res = await fetchJson<EventListResponse>("/data/events.json");
  return res.events;
}

/** County acres-affected + observed/forecast crop-loss probability
 * (17_compute_county_crop_health_summary.py's static output). Returns null (not a
 * thrown error) if this event's summary hasn't been generated yet, so callers can show
 * a "not generated yet" state instead of an unhandled rejection. */
export async function loadCropHealthSummary(eventId: string): Promise<CropHealthSummary | null> {
  const res = await fetch(withBase(`/data/crop_health/${eventId}/summary.json`));
  if (!res.ok) return null;
  try {
    return (await res.json()) as CropHealthSummary;
  } catch {
    return null; // Vite's dev-server SPA fallback returns 200+HTML for missing static paths
  }
}
