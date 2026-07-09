// Not in the spec's suggested file list by name, but required by the UI spec
// ("time/reference selector: Forecast / Historical Climatology / Forecast
// Anomaly vs Climatology") - kept as its own component alongside the other
// *Selector components for consistency.
import { REFERENCE_MODES } from "../config/products";
import { useAppDispatch, useAppState } from "../state/AppStateContext";

export function ReferenceSelector() {
  const { referenceMode } = useAppState();
  const dispatch = useAppDispatch();

  return (
    <div className="control-group">
      <label className="control-label" htmlFor="reference-select">
        Reference
      </label>
      <select
        id="reference-select"
        className="select"
        value={referenceMode}
        onChange={(e) => dispatch({ type: "SET_REFERENCE_MODE", referenceMode: e.target.value as typeof referenceMode })}
      >
        {REFERENCE_MODES.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
    </div>
  );
}
