import { useEffect, useState } from "react";
import type { Feature } from "geojson";
import { loadEvents } from "../utils/dataLoader";
import type { DamageEvent } from "../types/damage";
import type { CountyFeatureProperties } from "../types/products";
import { useAppDispatch, useAppState, type CropHealthIndex } from "../state/AppStateContext";

// The three main event types this prototype covers (see the Objective 2 concept:
// heat/crop-stress, freeze, flood) - only heat_grape has real before/after Crop
// Health map imagery generated so far (16-18_*.py); the other two are wired up in
// the UI (event registry + dropdown) but show a "not generated yet" state in
// CropHealthPanel until their own satellite exports are run.
export const EVENT_LABELS: Record<string, string> = {
  "heat_grape_2026-06-20_week3": "Heat Stress - Crop Stress",
  "heat_corn_2026-06-20_week3": "Heat Stress - Corn",
  "storm_flood_2026-01-03_1300928": "Flood Damage - Napa",
};

const DEFAULT_EVENT_ID = "heat_grape_2026-06-20_week3";

const INDEX_OPTIONS: { id: CropHealthIndex; label: string }[] = [
  { id: "s2_ndvi", label: "NDVI (Sentinel-2)" },
  { id: "s2_ndmi", label: "NDMI (Sentinel-2)" },
  { id: "s1_backscatter", label: "VV Backscatter (Sentinel-1)" },
  { id: "modis_lst", label: "Land Surface Temp (MODIS)" },
  { id: "viirs_lst", label: "Land Surface Temp (VIIRS)" },
];

interface Props {
  counties: Feature[];
}

export function CropHealthControls({ counties }: Props) {
  const { selectedCropHealthEventId, selectedCropHealthGeoid, selectedCropHealthIndex } = useAppState();
  const dispatch = useAppDispatch();
  const [events, setEvents] = useState<DamageEvent[]>([]);

  useEffect(() => {
    loadEvents().then((evts) => {
      setEvents(evts);
      if (!selectedCropHealthEventId) {
        const first = evts.find((e) => e.event_id === DEFAULT_EVENT_ID) ?? evts[0];
        if (first) dispatch({ type: "SELECT_CROP_HEALTH_EVENT", eventId: first.event_id });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const event = events.find((e) => e.event_id === selectedCropHealthEventId);

  useEffect(() => {
    if (event && !selectedCropHealthGeoid && event.geoids.length > 0) {
      dispatch({ type: "SELECT_CROP_HEALTH_COUNTY", geoid: event.geoids[0] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  function countyLabel(geoid: string): string {
    const feature = counties.find((f) => (f.properties as CountyFeatureProperties).geoid === geoid);
    const props = feature?.properties as CountyFeatureProperties | undefined;
    return props ? `${props.county_name} County` : geoid;
  }

  return (
    <>
      <div className="control-group">
        <label className="control-label" htmlFor="crop-health-event">
          Event
        </label>
        <select
          id="crop-health-event"
          className="select"
          value={selectedCropHealthEventId ?? ""}
          onChange={(e) => dispatch({ type: "SELECT_CROP_HEALTH_EVENT", eventId: e.target.value })}
        >
          {events.map((e) => (
            <option key={e.event_id} value={e.event_id}>
              {EVENT_LABELS[e.event_id] ?? e.event_id}
            </option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <label className="control-label" htmlFor="crop-health-county">
          County
        </label>
        <select
          id="crop-health-county"
          className="select"
          value={selectedCropHealthGeoid ?? ""}
          onChange={(e) => dispatch({ type: "SELECT_CROP_HEALTH_COUNTY", geoid: e.target.value })}
        >
          {(event?.geoids ?? []).map((geoid) => (
            <option key={geoid} value={geoid}>
              {countyLabel(geoid)}
            </option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <label className="control-label" htmlFor="crop-health-index">
          Index
        </label>
        <select
          id="crop-health-index"
          className="select"
          value={selectedCropHealthIndex}
          onChange={(e) => dispatch({ type: "SET_CROP_HEALTH_INDEX", index: e.target.value as CropHealthIndex })}
        >
          {INDEX_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <p className="muted subtab-note">
        Click a field boundary on either map to select it. Observed crop health, before vs. after the event.
      </p>
    </>
  );
}
