import { useEffect, useMemo, useState } from "react";
import type { Feature, FeatureCollection } from "geojson";
import { loadCountyFields, loadCropHealthManifest, loadCropHealthSummary, loadEvents } from "../utils/dataLoader";
import type { CropHealthMapManifest, CropHealthSummary, DamageEvent } from "../types/damage";
import type { CountyFeatureProperties } from "../types/products";
import { formatNumber, formatPercent } from "../utils/formatters";
import { useAppDispatch, useAppState } from "../state/AppStateContext";
import { CropHealthMapColumn } from "./CropHealthMapColumn";
import { EVENT_LABELS } from "./CropHealthControls";
import { generateCropHealthReportPdf } from "../utils/pdfReport";

interface Props {
  counties: FeatureCollection;
}

export function CropHealthPanel({ counties }: Props) {
  const { selectedCropHealthEventId, selectedCropHealthGeoid, selectedCropHealthFieldId, selectedCropHealthIndex } = useAppState();
  const dispatch = useAppDispatch();

  const [event, setEvent] = useState<DamageEvent | null>(null);
  const [summary, setSummary] = useState<CropHealthSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<CropHealthMapManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [fields, setFields] = useState<FeatureCollection | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Same national counties_simplified.geojson Risk Viewer's MapView renders - just
  // scoped down to this event's own counties so the Crop Health maps show the same
  // outline context instead of only field boundaries.
  const eventCounties = useMemo<FeatureCollection>(() => {
    const geoids = new Set(event?.geoids ?? []);
    return {
      type: "FeatureCollection",
      features: counties.features.filter((f: Feature) => geoids.has((f.properties as CountyFeatureProperties).geoid)),
    };
  }, [counties, event]);

  useEffect(() => {
    if (!selectedCropHealthEventId) return;
    setEvent(null);
    setSummary(null);
    setManifest(null);
    loadEvents().then((evts) => {
      setEvent(evts.find((e) => e.event_id === selectedCropHealthEventId) ?? null);
    });
    loadCropHealthSummary(selectedCropHealthEventId).then((s) => {
      setSummary(s);
      setSummaryError(s ? null : "Acreage/crop-loss summary not generated yet for this event.");
    });
    loadCropHealthManifest(selectedCropHealthEventId)
      .then((m) => {
        setManifest(m);
        setManifestError(null);
      })
      .catch(() => {
        setManifest(null);
        setManifestError("Before/after imagery not generated yet for this event — the satellite export pipeline may still be running.");
      });
  }, [selectedCropHealthEventId]);

  useEffect(() => {
    const crop = event?.crop;
    if (!selectedCropHealthGeoid || (crop !== "corn" && crop !== "grape")) {
      setFields(null);
      return;
    }
    setFields(null);
    loadCountyFields(crop, selectedCropHealthGeoid).then(setFields);
  }, [selectedCropHealthGeoid, event]);

  const county = selectedCropHealthGeoid ? summary?.counties[selectedCropHealthGeoid] : undefined;
  const sensor = manifest?.sensors[selectedCropHealthIndex];
  const beforeWindow = sensor?.windows.before;
  const afterWindow = sensor?.windows.after;

  const countyProps = eventCounties.features.find(
    (f) => (f.properties as CountyFeatureProperties).geoid === selectedCropHealthGeoid,
  )?.properties as CountyFeatureProperties | undefined;

  function onSelectField(csbId: string) {
    dispatch({ type: "SELECT_CROP_HEALTH_FIELD", fieldId: csbId });
  }

  async function onGenerateReport() {
    if (!event || !summary || !county || !countyProps) return;
    setGeneratingPdf(true);
    try {
      await generateCropHealthReportPdf({
        event,
        eventLabel: EVENT_LABELS[event.event_id] ?? event.event_id,
        countyName: countyProps.county_name,
        county,
        threshold_f: summary.threshold_f,
        manifest,
        selectedIndex: selectedCropHealthIndex,
        selectedIndexLabel: sensor?.label ?? selectedCropHealthIndex,
        selectedFieldId: selectedCropHealthFieldId,
      });
    } finally {
      setGeneratingPdf(false);
    }
  }

  return (
    <main className="damage-report crop-health-panel">
      <div className="topbar">
        <span>
          <span className="label">Event</span>
          <b>{selectedCropHealthEventId ? EVENT_LABELS[selectedCropHealthEventId] ?? selectedCropHealthEventId : "—"}</b>
        </span>
        <span>
          <span className="label">County</span>
          <b>{countyProps ? `${countyProps.county_name} County` : "—"}</b>
        </span>
        <span>
          <span className="label">Selected Field</span>
          <b>{selectedCropHealthFieldId ? `…${selectedCropHealthFieldId.slice(-6)}` : "none — click a field on the map"}</b>
        </span>
        <button className="pdf-report-button" onClick={onGenerateReport} disabled={!county || !countyProps || generatingPdf}>
          {generatingPdf ? "Generating…" : "📄 Generate PDF Report"}
        </button>
      </div>

      {summaryError && <div className="map-placeholder-banner">{summaryError}</div>}

      {county && (
        <div className="county-health-strip">
          <div className="health-stat">
            <div className="health-stat-label">Acres Affected</div>
            <div className="health-stat-value">
              {formatNumber(county.acres.acres_affected, 0)} <span className="muted">/ {formatNumber(county.acres.total_acres, 0)} ac</span>
            </div>
            <div className="health-stat-sub">
              {county.acres.n_fields_affected} / {county.acres.n_fields} fields ({formatNumber(county.acres.pct_acres_affected, 0)}%)
            </div>
          </div>
          <div className="health-stat">
            <div className="health-stat-label">Crop Loss Probability — Observed</div>
            <div className="health-stat-value">{formatPercent(county.observed.prob_below_normal_yield)}</div>
            <div className="health-stat-sub">from post-event satellite LST, not a forecast</div>
          </div>
          <div className="health-stat">
            <div className="health-stat-label">Crop Loss Probability — Forecast (Risk Viewer)</div>
            <div className="health-stat-value">{county.forecast ? formatPercent(county.forecast.prob_below_normal_yield) : "—"}</div>
            <div className="health-stat-sub">{county.forecast ? `${county.forecast.week_group}, S2S routine forecast` : "no forecast data"}</div>
          </div>
        </div>
      )}

      {manifestError && <div className="map-placeholder-banner">{manifestError}</div>}

      <div className="crop-health-columns">
        <CropHealthMapColumn
          title="Before"
          dateRange={manifest ? `${manifest.date_windows.before.start} → ${manifest.date_windows.before.end}` : ""}
          indexLabel={sensor?.label ?? selectedCropHealthIndex}
          mapWindow={beforeWindow}
          counties={eventCounties}
          selectedGeoid={selectedCropHealthGeoid}
          fields={fields}
          selectedFieldId={selectedCropHealthFieldId}
          onSelectField={onSelectField}
        />
        <CropHealthMapColumn
          title="After"
          dateRange={manifest ? `${manifest.date_windows.after.start} → ${manifest.date_windows.after.end}` : ""}
          indexLabel={sensor?.label ?? selectedCropHealthIndex}
          mapWindow={afterWindow}
          counties={eventCounties}
          selectedGeoid={selectedCropHealthGeoid}
          fields={fields}
          selectedFieldId={selectedCropHealthFieldId}
          onSelectField={onSelectField}
        />
      </div>
    </main>
  );
}
