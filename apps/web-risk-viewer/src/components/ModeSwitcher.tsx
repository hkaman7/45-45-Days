import { useAppDispatch, useAppState } from "../state/AppStateContext";

/** Top-level switch between the two viewers - lives at the top of the left box in
 * both modes (see ControlPanel.tsx), swaps both what the left box and the right
 * box render. "Rapid Response" is the short tab label for the fuller "Rapid
 * Response and Damage Assessment" viewer. */
export function ModeSwitcher() {
  const { mode } = useAppState();
  const dispatch = useAppDispatch();

  return (
    <div className="mode-switcher">
      <button
        className={`mode-tab ${mode === "risk" ? "active" : ""}`}
        onClick={() => dispatch({ type: "SET_MODE", mode: "risk" })}
      >
        Risk Viewer
      </button>
      <button
        className={`mode-tab ${mode === "damage" ? "active" : ""}`}
        onClick={() => dispatch({ type: "SET_MODE", mode: "damage" })}
      >
        Rapid Response
      </button>
    </div>
  );
}
