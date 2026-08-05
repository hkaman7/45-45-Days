// Base map + layer opacity, floating over the Leaflet map itself (top-right corner)
// rather than living in the left control panel - these two are about how the map
// LOOKS, not what data it shows, so they belong on the map the same way Leaflet's
// own zoom control (top-left, unaffected) does. A single icon button that expands
// into a picker on click, not a permanently-visible row of pills - closes on
// click-outside or on selecting a base map.
import { useEffect, useRef, useState } from "react";
import type { BaseLayerId } from "../state/AppStateContext";
import { useAppDispatch, useAppState } from "../state/AppStateContext";

const BASE_LAYERS: { id: BaseLayerId; label: string }[] = [
  { id: "osm", label: "OpenStreetMap" },
  { id: "satellite", label: "Satellite" },
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "terrain", label: "Terrain" },
];

export function MapLayerControl() {
  const { baseLayer, opacity } = useAppState();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div className="map-layer-control" ref={rootRef}>
      <button
        className="map-layer-icon-button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Map layers"
        aria-expanded={open}
        title="Base map & opacity"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </button>

      {open && (
        <div className="map-layer-menu">
          <div className="map-layer-menu-label">Base Map</div>
          {BASE_LAYERS.map((b) => (
            <button
              key={b.id}
              className={`map-layer-menu-item ${baseLayer === b.id ? "map-layer-menu-item-active" : ""}`}
              onClick={() => {
                dispatch({ type: "SET_BASE_LAYER", baseLayer: b.id });
                setOpen(false);
              }}
            >
              <span className="map-layer-check">{baseLayer === b.id ? "✓" : ""}</span>
              {b.label}
            </button>
          ))}

          <div className="map-layer-menu-divider" />

          <div className="map-layer-menu-label" id="map-opacity-label">
            Layer Opacity — {Math.round(opacity * 100)}%
          </div>
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
      )}
    </div>
  );
}
