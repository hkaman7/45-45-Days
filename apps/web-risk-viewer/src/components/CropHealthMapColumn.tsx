import { useEffect } from "react";
import { GeoJSON, ImageOverlay, MapContainer, TileLayer, useMap } from "react-leaflet";
import type { Feature, FeatureCollection } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import type { CropHealthMapWindow } from "../types/damage";
import type { FieldFeatureProperties } from "../types/products";
import { withBase } from "../utils/basePath";

interface Props {
  title: string;
  dateRange: string;
  indexLabel: string;
  mapWindow: CropHealthMapWindow | undefined;
  counties: FeatureCollection | null;
  selectedGeoid: string | null;
  fields: FeatureCollection | null;
  selectedFieldId: string | null;
  onSelectField: (csbId: string, acres: number) => void;
}

const CA_CENTER: [number, number] = [34.9, -117.0]; // roughly between Imperial and Riverside
const CA_ZOOM = 8;

/** Fits to the raster's own bounds once per window - each column's map independently
 * frames its own image (both windows share the same county bbox, so they end up
 * visually aligned without needing explicit multi-map pan/zoom sync). */
function FitToBounds({ bounds }: { bounds: [[number, number], [number, number]] | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [12, 12] });
  }, [bounds, map]);
  return null;
}

function boundaryStyle(selected: boolean): PathOptions {
  return selected
    ? { fillOpacity: 0, color: "#1d4ed8", weight: 2.5, opacity: 1 }
    : { fillOpacity: 0, color: "#1f2937", weight: 0.6, opacity: 0.65 };
}

/** Same fill-less outline convention MapView.tsx uses for county context under a raster
 * (see MapView's boundaryStyle) - selected county gets a heavier highlight. */
function countyStyle(selected: boolean): PathOptions {
  return selected
    ? { fillOpacity: 0, color: "#1d4ed8", weight: 1.5, opacity: 0.9 }
    : { fillOpacity: 0, color: "#5b5b5b", weight: 0.8, opacity: 0.6 };
}

export function CropHealthMapColumn({
  title,
  dateRange,
  indexLabel,
  mapWindow,
  counties,
  selectedGeoid,
  fields,
  selectedFieldId,
  onSelectField,
}: Props) {
  function onEachField(feature: Feature, layer: Layer) {
    const props = feature.properties as FieldFeatureProperties;
    layer.bindTooltip(`Field …${props.csb_id.slice(-6)} — ${props.acres.toFixed(1)} ac (click to select)`, { sticky: true });
    layer.on("click", () => onSelectField(props.csb_id, props.acres));
  }

  function onEachCounty(feature: Feature, layer: Layer) {
    const props = feature.properties as { geoid?: string; county_name?: string };
    if (props.county_name) layer.bindTooltip(`${props.county_name} County`, { sticky: true });
  }

  return (
    <div className="crop-health-column">
      <div className="crop-health-column-header">
        <h2>{title}</h2>
        <span className="muted">
          {indexLabel} · {dateRange}
        </span>
      </div>
      <div className="crop-health-column-map">
        <MapContainer center={CA_CENTER} zoom={CA_ZOOM} className="leaflet-container-full" scrollWheelZoom>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          {mapWindow && (
            <>
              <ImageOverlay url={withBase(mapWindow.png)} bounds={mapWindow.bounds} opacity={0.85} />
              <FitToBounds bounds={mapWindow.bounds} />
            </>
          )}
          {counties && (
            <GeoJSON
              key={`${title}-counties-${selectedGeoid ?? "none"}`}
              data={counties}
              style={(f) => countyStyle((f?.properties as { geoid?: string } | undefined)?.geoid === selectedGeoid)}
              onEachFeature={onEachCounty}
            />
          )}
          {fields && (
            <GeoJSON
              key={`${title}-${fields.features.length}-${selectedFieldId ?? "none"}`}
              data={fields}
              style={(f) => boundaryStyle((f?.properties as FieldFeatureProperties | undefined)?.csb_id === selectedFieldId)}
              onEachFeature={onEachField}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
