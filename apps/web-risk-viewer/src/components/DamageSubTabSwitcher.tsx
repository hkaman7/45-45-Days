import { useAppDispatch, useAppState, type DamageSubTab } from "../state/AppStateContext";

const TABS: { id: DamageSubTab; label: string }[] = [
  { id: "crop_health", label: "Crop Health" },
  { id: "crop_loss_probability", label: "Crop Loss Probability" },
];

/** Second-level tabs inside "Rapid Response" mode - Crop Health (observed
 * before/after for a selected county+field, county picked via dropdown, field
 * picked by clicking its boundary on the map) and Crop Loss Probability
 * (real-time, national, not tied to any one field). The old standalone
 * "Events" tab (event cards + a single anomaly map) was folded into Crop
 * Health - there's only ever one sample event for this pass, so browsing a
 * list of events added a click without adding information. */
export function DamageSubTabSwitcher() {
  const { damageSubTab } = useAppState();
  const dispatch = useAppDispatch();

  return (
    <div className="subtab-switcher">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`subtab ${damageSubTab === t.id ? "active" : ""}`}
          onClick={() => dispatch({ type: "SET_DAMAGE_SUBTAB", subTab: t.id })}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
