// Live fetch layer against apps/damage-api (FastAPI, run separately - see
// apps/damage-api/README.md). Unlike apps/web-risk-viewer (static files
// baked by a data-prep script), this app talks to a real running service -
// no build-time data snapshot.

import type {
  CropHealthSummary,
  DamageEvent,
  DamageGeoJSON,
  DamageSummary,
  EventListResponse,
  FieldBeforeAfter,
  FieldListResponse,
  RealtimeCropLossGeoJSON,
  RealtimeCropLossSummary,
} from "../types/damage";

const API_BASE = "http://localhost:8000";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    if (res.status === 404) throw new NotFoundError(path);
    throw new Error(`API error ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}

export class NotFoundError extends Error {
  constructor(path: string) {
    super(`Not found: ${path}`);
    this.name = "NotFoundError";
  }
}

export interface EventFilters {
  hazardType?: string;
  crop?: string;
  status?: string;
  minConfirmedDate?: string;
  maxConfirmedDate?: string;
}

export function listEvents(filters: EventFilters = {}): Promise<EventListResponse> {
  const params = new URLSearchParams();
  if (filters.hazardType) params.set("hazard_type", filters.hazardType);
  if (filters.crop) params.set("crop", filters.crop);
  if (filters.status) params.set("status", filters.status);
  if (filters.minConfirmedDate) params.set("min_confirmed_date", filters.minConfirmedDate);
  if (filters.maxConfirmedDate) params.set("max_confirmed_date", filters.maxConfirmedDate);
  const qs = params.toString();
  return fetchJson<EventListResponse>(`/v1/events${qs ? `?${qs}` : ""}`);
}

export function getEvent(eventId: string): Promise<DamageEvent> {
  return fetchJson<DamageEvent>(`/v1/events/${encodeURIComponent(eventId)}`);
}

export function getDamageSummary(eventId: string): Promise<DamageSummary> {
  return fetchJson<DamageSummary>(`/v1/damage-assessment/${encodeURIComponent(eventId)}`);
}

export function getDamageGeoJSON(eventId: string): Promise<DamageGeoJSON> {
  return fetchJson<DamageGeoJSON>(`/v1/damage-assessment/${encodeURIComponent(eventId)}?format=geojson`);
}

export function checkApiHealth(): Promise<{ status: string }> {
  return fetchJson<{ status: string }>("/health");
}

export function getRealtimeCropLoss(crop: string): Promise<RealtimeCropLossSummary> {
  return fetchJson<RealtimeCropLossSummary>(`/v1/crop-loss-probability/${encodeURIComponent(crop)}`);
}

export function getRealtimeCropLossGeoJSON(crop: string): Promise<RealtimeCropLossGeoJSON> {
  return fetchJson<RealtimeCropLossGeoJSON>(`/v1/crop-loss-probability/${encodeURIComponent(crop)}?format=geojson`);
}

export function getCropHealthSummary(eventId: string): Promise<CropHealthSummary> {
  return fetchJson<CropHealthSummary>(`/v1/crop-health/${encodeURIComponent(eventId)}/summary`);
}

export function listFieldsForCounty(crop: string, geoid: string): Promise<FieldListResponse> {
  return fetchJson<FieldListResponse>(`/v1/crop-health/fields/${encodeURIComponent(crop)}/${encodeURIComponent(geoid)}`);
}

export function getFieldBeforeAfter(eventId: string, crop: string, geoid: string, csbId: string): Promise<FieldBeforeAfter> {
  return fetchJson<FieldBeforeAfter>(
    `/v1/crop-health/${encodeURIComponent(eventId)}/field/${encodeURIComponent(crop)}/${encodeURIComponent(geoid)}/${encodeURIComponent(csbId)}`,
  );
}
