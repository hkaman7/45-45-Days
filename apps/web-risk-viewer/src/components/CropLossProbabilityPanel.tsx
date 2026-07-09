import { useEffect, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import type { Feature } from "geojson";
import type { Layer, Path, PathOptions } from "leaflet";
import { getRealtimeCropLoss, getRealtimeCropLossGeoJSON, NotFoundError } from "../utils/api";
import type { RealtimeCountyRow, RealtimeCropLossGeoJSON, RealtimeCropLossSummary } from "../types/damage";
import { COLOR_RAMPS } from "../config/legends";
import { interpolateColor } from "../utils/colorScales";
import { formatNumber, formatPercent } from "../utils/formatters";

const CONUS_CENTER: [number, number] = [39, -96];
const CONUS_ZOOM = 4;
const RAMP = COLOR_RAMPS.crop_loss_probability; // same ramp Objective 1's routine forecast uses - visual consistency across both

/** Fits once on first load only (not on every re-render) - this is a national view,
 * unlike DamageReportPanel's per-event fit, so it shouldn't re-fit on every poll/refresh. */
function FitOnce({ data }: { data: RealtimeCropLossGeoJSON }) {
  const map = useMap();
  useEffect(() => {
    map.setView(CONUS_CENTER, CONUS_ZOOM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data === null]);
  return null;
}

const CROP = "corn"; // only crop with a real-time-ready baseline model + HRES feature pipeline for this pass

export function CropLossProbabilityPanel() {
  const [summary, setSummary] = useState<RealtimeCropLossSummary | null>(null);
  const [geojson, setGeojson] = useState<RealtimeCropLossGeoJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [notAvailable, setNotAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setNotAvailable(false);

    Promise.all([getRealtimeCropLoss(CROP), getRealtimeCropLossGeoJSON(CROP)])
      .then(([s, g]) => {
        setSummary(s);
        setGeojson(g);
      })
      .catch((err) => {
        if (err instanceof NotFoundError) setNotAvailable(true);
        else setError(String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="damage-report">
        <div className="empty-state">Loading real-time crop-loss probability…</div>
      </main>
    );
  }

  if (notAvailable) {
    return (
      <main className="damage-report">
        <div className="empty-state">
          No real-time run yet.
          <p className="muted">
            Run <code>download_ecmwf_hres_short_range.py</code> →{" "}
            <code>15_predict_realtime_crop_loss.py --crop corn</code> first.
          </p>
        </div>
      </main>
    );
  }

  if (error || !summary || !geojson) {
    return (
      <main className="damage-report">
        <div className="empty-state error">{error || "Failed to load real-time crop-loss probability."}</div>
      </main>
    );
  }

  const vmin = 0;
  const vmax = 1;
  const sorted = [...summary.counties].sort((a, b) => b.prob_below_normal_yield - a.prob_below_normal_yield);

  function style(feature?: Feature): PathOptions {
    if (!feature) return {};
    const props = feature.properties as RealtimeCountyRow;
    return {
      fillColor: interpolateColor(RAMP, props.prob_below_normal_yield, vmin, vmax),
      fillOpacity: 0.78,
      color: "#0d1220",
      weight: 0.4,
    };
  }

  function onEachFeature(feature: Feature, layer: Layer) {
    const props = feature.properties as RealtimeCountyRow;
    const satLine =
      props.satellite_damage_anomaly !== null
        ? `<br/>Satellite context (${props.satellite_sensor}): ${formatNumber(props.satellite_damage_anomaly, 2)}`
        : "";
    layer.bindTooltip(
      `<strong>${props.county_name} County</strong><br/>Crop Loss Probability: ${formatPercent(props.prob_below_normal_yield)}<br/>Mean Stress: ${formatNumber(props.mean_stress_f, 1, "°F excess")}${satLine}`,
      { sticky: true },
    );
    layer.on("mouseover", () => (layer as Path).setStyle({ weight: 2, color: "#f2a93c" }));
    layer.on("mouseout", () => (layer as Path).setStyle({ weight: 0.4, color: "#0d1220" }));
  }

  return (
    <main className="damage-report">
      <div className="topbar">
        <span>
          <span className="label">Crop</span>
          <b>Corn</b>
        </span>
        <span>
          <span className="label">Window</span>
          <b>
            {summary.window_start} → {summary.window_end}
          </b>
        </span>
        <span>
          <span className="label">Source</span>
          <b>ECMWF HRES (real-time)</b>
        </span>
        <span>
          <span className="label">Model</span>
          <b>{summary.counties[0]?.model_type ?? "—"} (baseline)</b>
        </span>
      </div>

      <div className="map-wrap">
        <MapContainer center={CONUS_CENTER} zoom={CONUS_ZOOM} className="leaflet-container-full" scrollWheelZoom>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <GeoJSON key={CROP} data={geojson as GeoJSON.FeatureCollection} style={style} onEachFeature={onEachFeature} />
          <FitOnce data={geojson} />
        </MapContainer>

        <div className="damage-legend">
          <div className="damage-legend-title">Crop Loss Probability</div>
          <div className="damage-legend-ramp">
            {RAMP.map((c) => (
              <span key={c} style={{ background: c }} />
            ))}
          </div>
          <div className="damage-legend-labels">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
          <div className="damage-legend-unit">Probability of below-trend yield, real-time nowcast</div>
        </div>
      </div>

      <div className="summary-strip">
        <span>
          Counties <b>{summary.n_counties}</b>
        </span>
        <span>
          Mean Probability <b>{formatPercent(summary.mean_prob_below_normal_yield)}</b>
        </span>
        <span>
          Max Probability <b>{formatPercent(summary.max_prob_below_normal_yield)}</b>
        </span>
      </div>

      <div className="table-panel">
        <table>
          <thead>
            <tr>
              <th>County</th>
              <th className="num">Crop Loss Prob.</th>
              <th className="num">Mean Stress</th>
              <th className="num">Satellite Context</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 100).map((c) => (
              <tr key={c.geoid}>
                <td>
                  {c.county_name}, {String(c.state_fips).padStart(2, "0")}
                </td>
                <td className="num anom-val" style={{ color: interpolateColor(RAMP, c.prob_below_normal_yield, vmin, vmax) }}>
                  {formatPercent(c.prob_below_normal_yield)}
                </td>
                <td className="num">{formatNumber(c.mean_stress_f, 1, "°F")}</td>
                <td className="num">{c.satellite_damage_anomaly !== null ? formatNumber(c.satellite_damage_anomaly, 2) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
