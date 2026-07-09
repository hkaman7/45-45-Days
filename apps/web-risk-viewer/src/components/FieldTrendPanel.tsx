import type { Feature } from "geojson";
import { getWeeklySeries, type MetricsIndex } from "../utils/leafletLayers";
import { TrendChart } from "./TrendChart";
import { CROP_LABELS, WEEK_LABELS, formatNumber, formatPercentValue } from "../utils/formatters";
import { useAppDispatch, useAppState } from "../state/AppStateContext";

interface Props {
  counties: Feature[];
  metricsIndex: MetricsIndex;
}

function countyName(counties: Feature[], geoid: string): string {
  const f = counties.find((c) => (c.properties as { geoid: string }).geoid === geoid);
  return f ? (f.properties as { county_name: string }).county_name : geoid;
}

const FORECAST_WEEK_LABELS = ["week3", "week4", "week5", "week6"].map((w) => WEEK_LABELS[w]);

export function FieldTrendPanel({ counties, metricsIndex }: Props) {
  const { crop, selectedCountyGeoid, selectedFieldId, selectedFieldAcres } = useAppState();
  const dispatch = useAppDispatch();

  if (!selectedFieldId || !selectedCountyGeoid) return null;

  const series = getWeeklySeries(metricsIndex, selectedCountyGeoid, crop);
  const stressPoints = series.map((row, i) => ({ label: FORECAST_WEEK_LABELS[i], value: row?.mean_stress_f }));
  const lossPoints = series.map((row, i) => ({ label: FORECAST_WEEK_LABELS[i], value: row?.prob_below_normal_yield }));

  return (
    <section className="field-trend-panel">
      <div className="field-trend-header">
        <div>
          <strong>Field {selectedFieldId}</strong>
          <span className="muted">
            {" "}
            — {countyName(counties, selectedCountyGeoid)} County · {CROP_LABELS[crop]}
            {selectedFieldAcres !== undefined && selectedFieldAcres !== null ? ` · ${formatNumber(selectedFieldAcres, 1, " ac")}` : ""}
          </span>
        </div>
        <button className="field-trend-close" onClick={() => dispatch({ type: "SELECT_FIELD", field: null })} aria-label="Close">
          ×
        </button>
      </div>
      <div className="field-trend-charts">
        <TrendChart
          title="Crop Stress"
          unit="°F excess"
          points={stressPoints}
          color="#dc2626"
          formatValue={(v) => formatNumber(v, 1)}
        />
        <TrendChart
          title="Crop Loss Probability"
          unit="%"
          points={lossPoints.map((p) => ({ label: p.label, value: p.value !== undefined ? p.value * 100 : undefined }))}
          color="#7c3aed"
          formatValue={(v) => formatPercentValue(v)}
        />
      </div>
    </section>
  );
}
