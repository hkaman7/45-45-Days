import { useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, ImageOverlay, MapContainer, TileLayer, useMap } from "react-leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Layer, Path, PathOptions } from "leaflet";
import { CONUS_BOUNDS } from "../config/products";
import { getCountyValue, styleForValue, type ClimatologyIndex, type MetricsIndex } from "../utils/leafletLayers";
import { loadCountyFields } from "../utils/dataLoader";
import { withBase } from "../utils/basePath";
import { bboxOf, cropRasterToGeometry, type CroppedRaster } from "../utils/rasterCrop";
import { MapLayerControl } from "./MapLayerControl";
import { useAppDispatch, useAppState } from "../state/AppStateContext";
import type { CountyFeatureProperties, FieldFeatureProperties, ProductConfig } from "../types/products";

// Crops with field-level boundary data prepared (see
// data_pipelines/pipelines/09_prepare_field_boundaries.py) - corn has no
// fields yet, so it's left out rather than attempting a fetch that always 404s.
const CROPS_WITH_FIELDS = new Set(["grape"]);

const TILE_LAYERS = {
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics",
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
  },
};

const CONUS_CENTER: [number, number] = [39, -96];
const CONUS_ZOOM = 4;

interface Props {
  counties: FeatureCollection;
  metricsIndex: MetricsIndex;
  climatologyIndex: ClimatologyIndex;
  product: ProductConfig | undefined;
}

/** Runs inside <MapContainer> (needs useMap()) - reacts to reset/fly-to state changes. */
function MapController({ counties }: { counties: FeatureCollection }) {
  const map = useMap();
  const { resetExtentToken, flyToGeoid, flyToToken } = useAppState();

  useEffect(() => {
    map.setView(CONUS_CENTER, CONUS_ZOOM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetExtentToken]);

  useEffect(() => {
    if (!flyToGeoid) return;
    const feature = counties.features.find((f) => (f.properties as CountyFeatureProperties).geoid === flyToGeoid);
    if (!feature) return;
    // Rough centroid from the polygon's first ring - good enough for a fly-to at national scale.
    const coords = feature.geometry.type === "Polygon" ? feature.geometry.coordinates[0] : feature.geometry.type === "MultiPolygon" ? feature.geometry.coordinates[0][0] : null;
    if (!coords) return;
    const lats = coords.map((c) => c[1]);
    const lons = coords.map((c) => c[0]);
    const center: [number, number] = [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lons) + Math.max(...lons)) / 2];
    map.flyTo(center, 8, { duration: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToToken]);

  return null;
}

/** Zooms/fits to whatever's currently selected (field tighter than county,
 * county tighter than nothing) - runs whenever the selection itself changes,
 * not on every render, so panning around a selected county doesn't keep
 * getting yanked back. `selectionKey` is fieldId ?? geoid ?? "none" so this
 * fires exactly once per actual selection change. */
function FitToSelection({ bounds, selectionKey }: { bounds: [[number, number], [number, number]] | null; selectionKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [24, 24] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);
  return null;
}

export function MapView({ counties, metricsIndex, climatologyIndex, product }: Props) {
  const { baseLayer, opacity, selectedCountyGeoid, selectedFieldId, crop } = useAppState();
  const dispatch = useAppDispatch();
  const selectedLayerRef = useRef<Path | null>(null);
  const selectedFieldLayerRef = useRef<Path | null>(null);
  const [countyFields, setCountyFields] = useState<FeatureCollection | null>(null);

  // The GeoJSON layer remounts (new Leaflet layer instances) whenever the active
  // product changes, so a ref to a previously-selected path from before the
  // switch would point at a detached layer - drop it rather than risk calling
  // setStyle() on something no longer on the map.
  useEffect(() => {
    selectedLayerRef.current = null;
  }, [product?.crop, product?.productType, product?.week, product?.referenceMode]);

  // Field-level boundaries load on demand for the selected county only (one
  // county's fields in memory at a time) - only for crops with prepared data.
  useEffect(() => {
    selectedFieldLayerRef.current = null;
    if (!selectedCountyGeoid || !CROPS_WITH_FIELDS.has(crop)) {
      setCountyFields(null);
      return;
    }
    let cancelled = false;
    loadCountyFields(crop, selectedCountyGeoid).then((fc) => {
      if (!cancelled) setCountyFields(fc);
    });
    return () => {
      cancelled = true;
    };
  }, [crop, selectedCountyGeoid]);

  const tile = TILE_LAYERS[baseLayer];
  const showRaster = product?.layerType === "raster" && product.dataAvailable && product.rasterUrl;
  const showVector = product?.layerType === "vector";

  const selectedCountyFeature = useMemo(
    () => (selectedCountyGeoid ? counties.features.find((f) => (f.properties as CountyFeatureProperties).geoid === selectedCountyGeoid) : undefined),
    [counties, selectedCountyGeoid],
  );
  const selectedFieldFeature = useMemo(
    () => (selectedFieldId && countyFields ? countyFields.features.find((f) => (f.properties as FieldFeatureProperties).csb_id === selectedFieldId) : undefined),
    [countyFields, selectedFieldId],
  );
  // Field crops tighter than county, county crops tighter than nothing (full CONUS) -
  // this one geometry drives both the raster crop and the map's fit-to-selection.
  const selectionGeometry: Geometry | null = selectedFieldFeature?.geometry ?? selectedCountyFeature?.geometry ?? null;
  const selectionKey = selectedFieldId ?? selectedCountyGeoid ?? "none";

  // Counties actually rendered on the map/in the vector layer - just the
  // selected one once something's selected, not all ~3100 nationally. Click a
  // county to select it in the first place, so the unfiltered set is only
  // shown before any selection exists.
  const visibleCounties = useMemo<FeatureCollection>(() => {
    if (!selectedCountyFeature) return counties;
    return { type: "FeatureCollection", features: [selectedCountyFeature] };
  }, [counties, selectedCountyFeature]);

  const [croppedRaster, setCroppedRaster] = useState<CroppedRaster | null>(null);

  // Crop the raster to whatever's selected (field tighter than county) - full
  // CONUS raster only when nothing is selected. Runs client-side (Canvas),
  // same crop utility the PDF report reuses (see utils/rasterCrop.ts).
  useEffect(() => {
    if (!showRaster || !selectionGeometry) {
      setCroppedRaster(null);
      return;
    }
    let cancelled = false;
    cropRasterToGeometry(withBase(product!.rasterUrl!), product!.bounds ?? CONUS_BOUNDS, selectionGeometry).then((cropped) => {
      if (!cancelled) setCroppedRaster(cropped);
    });
    return () => {
      cancelled = true;
    };
  }, [showRaster, product?.rasterUrl, selectionGeometry]);

  const selectionBounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (!selectionGeometry) return null;
    const [minLon, minLat, maxLon, maxLat] = bboxOf(selectionGeometry);
    return [
      [minLat, minLon],
      [maxLat, maxLon],
    ];
  }, [selectionGeometry]);

  const fieldsValue = product && selectedCountyGeoid && product.dataAvailable
    ? getCountyValue(product, metricsIndex, climatologyIndex, selectedCountyGeoid)
    : undefined;
  const fieldsStyle: PathOptions | undefined = product
    ? { ...styleForValue(product, fieldsValue), color: "#2b2b2b", weight: 0.6 }
    : undefined;

  function style(feature?: Feature) {
    if (!feature || !product) return {};
    const geoid = (feature.properties as CountyFeatureProperties).geoid;
    const value = product.dataAvailable ? getCountyValue(product, metricsIndex, climatologyIndex, geoid) : undefined;
    return styleForValue(product, value);
  }

  /** No fill (the raster underneath already shows the data) - just thin outlines for geographic context, same as every vector product already has. */
  function boundaryStyle() {
    return { fillOpacity: 0, color: "#5b5b5b", weight: 0.5, opacity: 0.55 };
  }

  function makeOnEachFeature(defaultWeight: number, defaultColor: string) {
    return (feature: Feature, layer: Layer) => {
      const geoid = (feature.properties as CountyFeatureProperties).geoid;
      const props = feature.properties as CountyFeatureProperties;
      layer.bindTooltip(`${props.county_name} County`, { sticky: true });
      layer.on("click", () => {
        dispatch({ type: "SELECT_COUNTY", geoid });
        const path = layer as Path;
        if (selectedLayerRef.current) {
          selectedLayerRef.current.setStyle({ weight: defaultWeight, color: defaultColor });
        }
        path.setStyle({ weight: 2.5, color: "#1d4ed8" });
        selectedLayerRef.current = path;
      });
    };
  }

  /** Clicking an individual field selects it (drives FieldTrendPanel) without touching county selection - Leaflet path clicks don't bubble to sibling layers, so this doesn't fire the county's own click handler underneath. */
  function makeFieldOnEachFeature(defaultWeight: number, defaultColor: string) {
    return (feature: Feature, layer: Layer) => {
      const props = feature.properties as FieldFeatureProperties;
      layer.bindTooltip(`Field ${props.csb_id} — ${props.acres.toFixed(1)} ac`, { sticky: true });
      layer.on("click", () => {
        dispatch({ type: "SELECT_FIELD", field: { id: props.csb_id, acres: props.acres } });
        const path = layer as Path;
        if (selectedFieldLayerRef.current) {
          selectedFieldLayerRef.current.setStyle({ weight: defaultWeight, color: defaultColor });
        }
        path.setStyle({ weight: 2.5, color: "#1d4ed8" });
        selectedFieldLayerRef.current = path;
      });
    };
  }

  return (
    <div className="map-view">
      <MapContainer center={CONUS_CENTER} zoom={CONUS_ZOOM} className="leaflet-container-full" scrollWheelZoom>
        <TileLayer url={tile.url} attribution={tile.attribution} />
        <MapController counties={counties} />
        <FitToSelection bounds={selectionBounds} selectionKey={selectionKey} />

        {showRaster && (
          <>
            <ImageOverlay
              key={croppedRaster ? `crop-${selectionKey}` : "conus"}
              url={croppedRaster ? croppedRaster.dataUrl : withBase(product!.rasterUrl!)}
              bounds={croppedRaster ? croppedRaster.bounds : product!.bounds ?? CONUS_BOUNDS}
              opacity={opacity}
            />
            {/* County outlines over the raster, same as every vector product already shows - fill-less so the raster stays fully visible underneath.
                Just the selected county once one's picked, matching the cropped raster above - see visibleCounties. */}
            <GeoJSON
              key={`boundary-${selectionKey}-${product?.crop}-${product?.productType}-${product?.week}-${product?.referenceMode}`}
              data={visibleCounties}
              style={boundaryStyle}
              onEachFeature={makeOnEachFeature(0.5, "#5b5b5b")}
            />
          </>
        )}

        {showVector && (
          <GeoJSON
            key={`${selectionKey}-${product?.crop}-${product?.productType}-${product?.week}-${product?.referenceMode}`}
            data={visibleCounties}
            style={style}
            onEachFeature={makeOnEachFeature(0.4, "#4a4a4a")}
          />
        )}

        {/* Field-level boundaries for the selected county (grape pilot) - each field
            shares its county's value, styled identically, just at finer granularity.
            Clickable - see makeFieldOnEachFeature, drives FieldTrendPanel below the map. */}
        {countyFields && fieldsStyle && (
          <GeoJSON
            key={`fields-${crop}-${selectedCountyGeoid}`}
            data={countyFields}
            style={fieldsStyle}
            onEachFeature={makeFieldOnEachFeature(fieldsStyle.weight as number, fieldsStyle.color as string)}
          />
        )}
      </MapContainer>

      <MapLayerControl />

      {product && !product.dataAvailable && (
        <div className="map-placeholder-banner">No generated data yet for this combination — {product.description}</div>
      )}
      {selectedCountyGeoid === null && <div className="map-hint">Click a county to see details in the right panel.</div>}
    </div>
  );
}
