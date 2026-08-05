// Base map + layer opacity, floating over the Leaflet map itself (top-right corner)
// rather than living in the left control panel - these two are about how the map
// LOOKS, not what data it shows, so they belong on the map the same way Leaflet's
// own zoom control (top-left, unaffected) does. Moved out of the former LayerToggle
// component, which lived in the left sidebar.
import type { BaseLayerId } from "../state/AppStateContext";
import { useAppDispatch, useAppState } from "../state/AppStateContext";

const BASE_LAYERS: { id: BaseLayerId; label: string }[] = [
  { id: "osm", label: "OSM" },
  { id: "satellite", label: "Satellite" },
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "terrain", label: "Terrain" },
];

export function MapLayerControl() {
  const { baseLayer, opacity } = useAppState();
  const dispatch = useAppDispatch();

  return (
    <div className="map-layer-control">
      <div className="map-layer-control-row">
        <span className="map-layer-control-label">Base Map</span>
        <div className="pill-group pill-group-light">
          {BASE_LAYERS.map((b) => (
            <button
              key={b.id}
              className={`pill pill-light ${baseLayer === b.id ? "pill-active" : ""}`}
              onClick={() => dispatch({ type: "SET_BASE_LAYER", baseLayer: b.id })}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="map-layer-control-row">
        <span className="map-layer-control-label" id="map-opacity-label">
          Layer Opacity — {Math.round(opacity * 100)}%
        </span>
        <input
          className="slider"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          aria-labelledby="map-opacity-label"
          onChange={(e) => dispatch({ type: "SET_OPACITY", opacity: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}
