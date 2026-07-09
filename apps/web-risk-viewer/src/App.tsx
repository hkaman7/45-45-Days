import { useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
import { ControlPanel } from "./components/ControlPanel";
import { MapView } from "./components/MapView";
import { Legend } from "./components/Legend";
import { CountyInfoPanel } from "./components/CountyInfoPanel";
import { FieldTrendPanel } from "./components/FieldTrendPanel";
import { CropLossProbabilityPanel } from "./components/CropLossProbabilityPanel";
import { CropHealthPanel } from "./components/CropHealthPanel";
import { AppStateProvider, useAppState } from "./state/AppStateContext";
import { getProduct } from "./config/products";
import { loadCounties, loadCropLossMetrics, loadCountyClimatology } from "./utils/dataLoader";
import { buildClimatologyIndex, buildMetricsIndex } from "./utils/leafletLayers";
import type { CountyClimatology, CropLossMetric } from "./types/products";
import "./styles.css";

interface LoadedData {
  counties: FeatureCollection;
  metrics: CropLossMetric[];
  climatology: CountyClimatology[];
}

function Dashboard({ data }: { data: LoadedData }) {
  const { mode, damageSubTab, crop, productType, week, referenceMode } = useAppState();
  const product = getProduct(crop, productType, week, referenceMode);
  const metricsIndex = buildMetricsIndex(data.metrics);
  const climatologyIndex = buildClimatologyIndex(data.climatology);

  return (
    <div className="app-shell">
      <ControlPanel counties={data.counties.features} />
      {mode === "risk" ? (
        <>
          <div className="map-area">
            <MapView counties={data.counties} metricsIndex={metricsIndex} climatologyIndex={climatologyIndex} product={product} />
            <div className="map-legend-slot">
              <Legend product={product} />
            </div>
          </div>
          <CountyInfoPanel
            counties={data.counties.features}
            metricsIndex={metricsIndex}
            climatologyIndex={climatologyIndex}
            allMetrics={data.metrics}
            product={product}
          />
          <FieldTrendPanel counties={data.counties.features} metricsIndex={metricsIndex} />
        </>
      ) : damageSubTab === "crop_health" ? (
        <CropHealthPanel counties={data.counties} />
      ) : (
        <CropLossProbabilityPanel />
      )}
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadCounties(), loadCropLossMetrics(), loadCountyClimatology()])
      .then(([counties, metrics, climatology]) => setData({ counties, metrics, climatology }))
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return (
      <div className="app-loading app-error">
        <p>Failed to load product data: {error}</p>
        <p className="muted">
          Run <code>python data_pipelines/pipelines/08_prepare_webapp_data.py</code> from the repo root to (re)generate
          apps/web-risk-viewer/public/data, then reload.
        </p>
      </div>
    );
  }

  if (!data) {
    return <div className="app-loading">Loading 45+45 risk products…</div>;
  }

  return (
    <AppStateProvider>
      <Dashboard data={data} />
    </AppStateProvider>
  );
}
