import type { Feature } from "geojson";
import { CropSelector } from "./CropSelector";
import { ProductSelector } from "./ProductSelector";
import { WeekSelector } from "./WeekSelector";
import { CountySearch } from "./CountySearch";
import { ModeSwitcher } from "./ModeSwitcher";
import { DamageSubTabSwitcher } from "./DamageSubTabSwitcher";
import { CropLossProbabilityControls } from "./CropLossProbabilityControls";
import { CropHealthControls } from "./CropHealthControls";
import { useAppDispatch, useAppState } from "../state/AppStateContext";

interface Props {
  counties: Feature[];
}

/** The one <aside> both viewers share (dark panel, collapse toggle, mode switcher) -
 * ModeSwitcher picks which body renders below it. */
export function ControlPanel({ counties }: Props) {
  const { controlPanelCollapsed, mode, damageSubTab } = useAppState();
  const dispatch = useAppDispatch();

  return (
    <aside className={`control-panel ${controlPanelCollapsed ? "collapsed" : ""}`}>
      <button
        className="collapse-toggle"
        onClick={() => dispatch({ type: "TOGGLE_CONTROL_PANEL" })}
        aria-label={controlPanelCollapsed ? "Expand control panel" : "Collapse control panel"}
      >
        {controlPanelCollapsed ? "»" : "«"}
      </button>

      {!controlPanelCollapsed && (
        <div className="control-panel-body">
          <ModeSwitcher />

          {mode === "risk" ? (
            <>
              <div className="control-panel-header">
                <h1>45+45 Risk Viewer</h1>
                <p className="muted">Agricultural weather-risk intelligence prototype</p>
              </div>

              <ProductSelector />
              <CropSelector />
              <WeekSelector />
              <CountySearch counties={counties} />

              <div className="control-group">
                <button className="reset-button" onClick={() => dispatch({ type: "RESET_EXTENT" })}>
                  Reset Map Extent
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="control-panel-header">
                <h1>Rapid Response</h1>
                <p className="muted">Rapid response and damage assessment - before/after event visualization.</p>
              </div>
              <DamageSubTabSwitcher />
              {damageSubTab === "crop_health" ? <CropHealthControls counties={counties} /> : <CropLossProbabilityControls />}
            </>
          )}
        </div>
      )}
    </aside>
  );
}
