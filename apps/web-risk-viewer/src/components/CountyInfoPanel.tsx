import { useMemo } from "react";
import type { Feature } from "geojson";
import { FORECAST_INIT_DATE, getProductTypeLabel } from "../config/products";
import { resolveMetricRow, type ClimatologyIndex, type MetricsIndex } from "../utils/leafletLayers";
import { CROP_LABELS, WEEK_LABELS, formatDate, formatNumber, formatPercent, formatPercentValue } from "../utils/formatters";
import { useAppState } from "../state/AppStateContext";
import type { CropLossMetric, ProductConfig } from "../types/products";

interface Props {
  counties: Feature[];
  metricsIndex: MetricsIndex;
  climatologyIndex: ClimatologyIndex;
  allMetrics: CropLossMetric[];
  product: ProductConfig | undefined;
}

function countyName(counties: Feature[], geoid: string): string {
  const f = counties.find((c) => (c.properties as { geoid: string }).geoid === geoid);
  return f ? (f.properties as { county_name: string }).county_name : geoid;
}

export function CountyInfoPanel({ counties, metricsIndex, climatologyIndex, allMetrics, product }: Props) {
  const { crop, week, selectedCountyGeoid } = useAppState();

  const weekRows = useMemo(() => {
    if (week !== "wk3_6") return allMetrics.filter((m) => m.crop === crop && m.week_group === week);
    // wk3_6: one row per county, its own peak-risk week (same rule as resolveMetricRow)
    const byGeoid = new Map<string, CropLossMetric>();
    for (const m of allMetrics.filter((r) => r.crop === crop)) {
      const existing = byGeoid.get(m.geoid);
      if (!existing || m.risk_score > existing.risk_score) byGeoid.set(m.geoid, m);
    }
    return Array.from(byGeoid.values());
  }, [allMetrics, crop, week]);

  const nationalStats = useMemo(() => {
    if (weekRows.length === 0) return null;
    const avgProb = weekRows.reduce((s, r) => s + r.prob_below_normal_yield, 0) / weekRows.length;
    const avgReduction = weekRows.reduce((s, r) => s + r.expected_reduction_pct, 0) / weekRows.length;
    const avgConfidence = weekRows.reduce((s, r) => s + r.confidence_score, 0) / weekRows.length;
    const byClass = new Map<string, number>();
    for (const r of weekRows) byClass.set(r.risk_class, (byClass.get(r.risk_class) ?? 0) + 1);
    return { avgProb, avgReduction, avgConfidence, byClass, n: weekRows.length };
  }, [weekRows]);

  const topRisk = useMemo(() => [...weekRows].sort((a, b) => b.risk_score - a.risk_score).slice(0, 8), [weekRows]);

  const selectedRow = selectedCountyGeoid
    ? resolveMetricRow(metricsIndex, selectedCountyGeoid, crop, week)
    : undefined;
  const selectedClimatology = selectedCountyGeoid ? climatologyIndex.get(`${selectedCountyGeoid}|${crop}`) : undefined;

  return (
    <aside className="info-panel">
      <div className="info-section">
        <h2>Forecast Summary</h2>
        <dl className="kv-list">
          <dt>Crop</dt>
          <dd>{CROP_LABELS[crop]}</dd>
          <dt>Product</dt>
          <dd>{product ? getProductTypeLabel(product.productType) : "—"}</dd>
          <dt>Forecast Init Date</dt>
          <dd>{formatDate(FORECAST_INIT_DATE)}</dd>
          <dt>Lead Window</dt>
          <dd>{WEEK_LABELS[week]}</dd>
        </dl>
        {product && !product.dataAvailable && (
          <p className="placeholder-note">
            No real data has been generated yet for this exact crop/product/week/reference combination — showing
            placeholder state. Re-run <code>08_prepare_webapp_data.py</code> once it's available.
          </p>
        )}
      </div>

      <div className="info-section">
        <h2>Selected County</h2>
        {!selectedCountyGeoid && <p className="muted">Click a county on the map to see details here.</p>}
        {selectedCountyGeoid && !selectedRow && !selectedClimatology && (
          <p className="muted">No forecast data available for {countyName(counties, selectedCountyGeoid)}.</p>
        )}
        {selectedCountyGeoid && selectedRow && (
          <dl className="kv-list">
            <dt>County</dt>
            <dd>{countyName(counties, selectedCountyGeoid)}</dd>
            <dt>Crop</dt>
            <dd>{CROP_LABELS[crop]}</dd>
            <dt>Crop Stress</dt>
            <dd>{formatNumber(selectedRow.mean_stress_f, 1, "°F excess")}</dd>
            <dt>Heatwave / Prob. Loss</dt>
            <dd>{formatPercent(selectedRow.prob_below_normal_yield)}</dd>
            <dt>Expected Yield Reduction</dt>
            <dd>{formatPercentValue(selectedRow.expected_reduction_pct)}</dd>
            <dt>Predicted Yield</dt>
            <dd>{formatNumber(selectedRow.predicted_yield_t_ha, 2, " t/ha")}</dd>
            <dt>Risk Class</dt>
            <dd>{selectedRow.risk_class}</dd>
            <dt>Confidence Score</dt>
            <dd>{formatNumber(selectedRow.confidence_score, 2)}</dd>
            <dt>Dominant Driver</dt>
            <dd>{selectedRow.dominant_driver}</dd>
          </dl>
        )}
        {selectedCountyGeoid && selectedClimatology && (
          <dl className="kv-list">
            <dt>2015-2022 Mean Stress</dt>
            <dd>{formatNumber(selectedClimatology.mean_stress_f, 1, "°F excess")}</dd>
            <dt>Years of Record</dt>
            <dd>{selectedClimatology.n_years}</dd>
          </dl>
        )}
      </div>

      {nationalStats && (
        <div className="info-section">
          <h2>National Summary ({nationalStats.n} counties)</h2>
          <dl className="kv-list">
            <dt>Avg. Probability of Loss</dt>
            <dd>{formatPercent(nationalStats.avgProb)}</dd>
            <dt>Avg. Expected Reduction</dt>
            <dd>{formatPercentValue(nationalStats.avgReduction)}</dd>
            <dt>Avg. Confidence</dt>
            <dd>{formatNumber(nationalStats.avgConfidence, 2)}</dd>
          </dl>
          <ul className="risk-class-breakdown">
            {Array.from(nationalStats.byClass.entries()).map(([cls, n]) => (
              <li key={cls}>
                {cls}: {n}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="info-section">
        <h2>Top High-Risk Counties</h2>
        {topRisk.length === 0 && <p className="muted">No data for this selection.</p>}
        <ol className="top-risk-list">
          {topRisk.map((r) => (
            <li key={r.geoid}>
              <span>{countyName(counties, r.geoid)}</span>
              <span className="muted">{r.risk_class}</span>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
