import { CROPS } from "../config/products";
import { useAppDispatch, useAppState } from "../state/AppStateContext";

// Dropdown (not pill buttons) on purpose: CROPS is expected to grow beyond
// corn/grape, and a scrollable <select> scales to many crops without
// re-laying-out the control panel the way a pill row would.
export function CropSelector() {
  const { crop } = useAppState();
  const dispatch = useAppDispatch();

  return (
    <div className="control-group">
      <label className="control-label" htmlFor="crop-select">
        Crop
      </label>
      <select
        id="crop-select"
        className="select"
        value={crop}
        onChange={(e) => dispatch({ type: "SET_CROP", crop: e.target.value as typeof crop })}
      >
        {CROPS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}
