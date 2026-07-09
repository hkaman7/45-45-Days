import type { BaseLayerId } from "../state/AppStateContext";
import { useAppDispatch, useAppState } from "../state/AppStateContext";

const BASE_LAYERS: { id: BaseLayerId; label: string }[] = [
  { id: "osm", label: "OpenStreetMap" },
  { id: "satellite", label: "Satellite" },
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "terrain", label: "Terrain" },
];

export function LayerToggle() {
  const { baseLayer, opacity } = useAppState();
  const dispatch = useAppDispatch();

  return (
    <>
      <div className="control-group">
        <label className="control-label">Base Map</label>
        <div className="pill-group">
          {BASE_LAYERS.map((b) => (
            <button
              key={b.id}
              className={`pill ${baseLayer === b.id ? "pill-active" : ""}`}
              onClick={() => dispatch({ type: "SET_BASE_LAYER", baseLayer: b.id })}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="control-group">
        <label className="control-label" htmlFor="opacity-slider">
          Layer Opacity — {Math.round(opacity * 100)}%
        </label>
        <input
          id="opacity-slider"
          className="slider"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => dispatch({ type: "SET_OPACITY", opacity: Number(e.target.value) })}
        />
      </div>
    </>
  );
}
