// Small app-wide state: which crop/product/week/reference mode is active,
// the opacity slider, base layer choice, and the selected county. Kept as
// a plain useReducer + Context instead of a state library since the shape
// is small and stable - swap this out if the app grows real async/server
// state needs later.

import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import type { CropId, ProductType, ReferenceMode, WeekId } from "../types/products";

export type BaseLayerId = "osm" | "satellite" | "dark" | "light" | "terrain";

/** Which top-level viewer is showing - swapping this is the only thing that changes
 * which content the left and right boxes render (see components/ModeSwitcher.tsx). */
export type AppMode = "risk" | "damage";

/** Within "damage" mode: the observed before/after Crop Health view (county+field
 * scoped), or the real-time national crop-loss-probability view (see
 * components/CropLossProbabilityPanel.tsx). */
export type DamageSubTab = "crop_loss_probability" | "crop_health";

/** Which sensor's before/after map is shown in the Crop Health tab's two map
 * columns - picked once in the left box, applies to both columns at once. */
export type CropHealthIndex = "s2_ndvi" | "s2_ndmi" | "s1_backscatter" | "modis_lst" | "viirs_lst";

export interface AppState {
  mode: AppMode;
  damageSubTab: DamageSubTab;
  /** "Crop Health" sub-tab's own event/county/field/index selection - separate from
   * selectedCountyGeoid (Risk Viewer) since the two viewers can have independent
   * selections at once. Field is set by clicking its boundary on either before/after
   * map (see components/CropHealthMapColumn.tsx), not a dropdown. */
  selectedCropHealthEventId: string | null;
  selectedCropHealthGeoid: string | null;
  selectedCropHealthFieldId: string | null;
  selectedCropHealthIndex: CropHealthIndex;
  crop: CropId;
  productType: ProductType;
  week: WeekId;
  referenceMode: ReferenceMode;
  opacity: number;
  baseLayer: BaseLayerId;
  selectedCountyGeoid: string | null;
  /** csb_id of the clicked field-boundary polygon (see components/MapView.tsx's field layer). */
  selectedFieldId: string | null;
  selectedFieldAcres: number | null;
  controlPanelCollapsed: boolean;
  resetExtentToken: number;
  /** Set (with an incrementing token so repeat selections still trigger) when CountySearch picks a county to fly to. */
  flyToGeoid: string | null;
  flyToToken: number;
}

export type AppAction =
  | { type: "SET_MODE"; mode: AppMode }
  | { type: "SET_DAMAGE_SUBTAB"; subTab: DamageSubTab }
  | { type: "SELECT_CROP_HEALTH_EVENT"; eventId: string }
  | { type: "SELECT_CROP_HEALTH_COUNTY"; geoid: string | null }
  | { type: "SELECT_CROP_HEALTH_FIELD"; fieldId: string | null }
  | { type: "SET_CROP_HEALTH_INDEX"; index: CropHealthIndex }
  | { type: "SET_CROP"; crop: CropId }
  | { type: "SET_PRODUCT_TYPE"; productType: ProductType }
  | { type: "SET_WEEK"; week: WeekId }
  | { type: "SET_REFERENCE_MODE"; referenceMode: ReferenceMode }
  | { type: "SET_OPACITY"; opacity: number }
  | { type: "SET_BASE_LAYER"; baseLayer: BaseLayerId }
  | { type: "SELECT_COUNTY"; geoid: string | null }
  | { type: "SELECT_FIELD"; field: { id: string; acres: number } | null }
  | { type: "TOGGLE_CONTROL_PANEL" }
  | { type: "RESET_EXTENT" }
  | { type: "FLY_TO_COUNTY"; geoid: string };

const initialState: AppState = {
  mode: "risk",
  damageSubTab: "crop_health",
  selectedCropHealthEventId: null,
  selectedCropHealthGeoid: null,
  selectedCropHealthFieldId: null,
  selectedCropHealthIndex: "s2_ndvi",
  crop: "corn",
  productType: "crop_stress",
  week: "wk3_6",
  referenceMode: "forecast",
  opacity: 0.8,
  baseLayer: "osm",
  selectedCountyGeoid: null,
  selectedFieldId: null,
  selectedFieldAcres: null,
  controlPanelCollapsed: false,
  resetExtentToken: 0,
  flyToGeoid: null,
  flyToToken: 0,
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.mode };
    case "SET_DAMAGE_SUBTAB":
      return { ...state, damageSubTab: action.subTab };
    case "SELECT_CROP_HEALTH_EVENT":
      return { ...state, selectedCropHealthEventId: action.eventId, selectedCropHealthGeoid: null, selectedCropHealthFieldId: null };
    case "SELECT_CROP_HEALTH_COUNTY":
      return { ...state, selectedCropHealthGeoid: action.geoid, selectedCropHealthFieldId: null };
    case "SELECT_CROP_HEALTH_FIELD":
      return { ...state, selectedCropHealthFieldId: action.fieldId };
    case "SET_CROP_HEALTH_INDEX":
      return { ...state, selectedCropHealthIndex: action.index };
    case "SET_CROP":
      return { ...state, crop: action.crop, selectedCountyGeoid: null, selectedFieldId: null, selectedFieldAcres: null };
    case "SET_PRODUCT_TYPE":
      return { ...state, productType: action.productType, selectedCountyGeoid: null };
    case "SET_WEEK":
      return { ...state, week: action.week };
    case "SET_REFERENCE_MODE":
      return { ...state, referenceMode: action.referenceMode };
    case "SET_OPACITY":
      return { ...state, opacity: action.opacity };
    case "SET_BASE_LAYER":
      return { ...state, baseLayer: action.baseLayer };
    case "SELECT_COUNTY":
      return { ...state, selectedCountyGeoid: action.geoid, selectedFieldId: null, selectedFieldAcres: null };
    case "SELECT_FIELD":
      return { ...state, selectedFieldId: action.field?.id ?? null, selectedFieldAcres: action.field?.acres ?? null };
    case "TOGGLE_CONTROL_PANEL":
      return { ...state, controlPanelCollapsed: !state.controlPanelCollapsed };
    case "RESET_EXTENT":
      // Also clears county/field selection - the map crops to whatever's selected
      // (see MapView.tsx), so "reset extent" back to the national view only makes
      // sense paired with dropping the selection that was cropping it.
      return {
        ...state,
        resetExtentToken: state.resetExtentToken + 1,
        selectedCountyGeoid: null,
        selectedFieldId: null,
        selectedFieldAcres: null,
      };
    case "FLY_TO_COUNTY":
      return {
        ...state,
        selectedCountyGeoid: action.geoid,
        selectedFieldId: null,
        selectedFieldAcres: null,
        flyToGeoid: action.geoid,
        flyToToken: state.flyToToken + 1,
      };
    default:
      return state;
  }
}

const AppStateCtx = createContext<AppState | null>(null);
const AppDispatchCtx = createContext<Dispatch<AppAction> | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AppStateCtx.Provider value={state}>
      <AppDispatchCtx.Provider value={dispatch}>{children}</AppDispatchCtx.Provider>
    </AppStateCtx.Provider>
  );
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateCtx);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}

export function useAppDispatch(): Dispatch<AppAction> {
  const ctx = useContext(AppDispatchCtx);
  if (!ctx) throw new Error("useAppDispatch must be used within AppStateProvider");
  return ctx;
}
