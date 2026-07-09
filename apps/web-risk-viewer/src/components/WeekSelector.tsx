import { WEEKS } from "../config/products";
import { useAppDispatch, useAppState } from "../state/AppStateContext";

export function WeekSelector() {
  const { week } = useAppState();
  const dispatch = useAppDispatch();

  return (
    <div className="control-group">
      <label className="control-label" htmlFor="week-select">
        Forecast Week
      </label>
      <select
        id="week-select"
        className="select"
        value={week}
        onChange={(e) => dispatch({ type: "SET_WEEK", week: e.target.value as typeof week })}
      >
        {WEEKS.map((w) => (
          <option key={w.id} value={w.id}>
            {w.label}
          </option>
        ))}
      </select>
    </div>
  );
}
