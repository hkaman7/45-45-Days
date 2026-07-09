// Formatting helpers for values shown in the legend, info panel, and popups.

export function formatPercent(value: number | undefined | null, digits = 0): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatPercentValue(value: number | undefined | null, digits = 1): string {
  // For values already expressed as a percent (0-100), not a fraction (0-1).
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatNumber(value: number | undefined | null, digits = 2, suffix = ""): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}${suffix}`;
}

export function formatTemperature(value: number | undefined | null): string {
  return formatNumber(value, 1, "°F");
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function titleCase(s: string): string {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const CROP_LABELS: Record<string, string> = { corn: "Corn", grape: "Grapes" };
export const WEEK_LABELS: Record<string, string> = {
  week3: "Week 3",
  week4: "Week 4",
  week5: "Week 5",
  week6: "Week 6",
  wk3_6: "Weeks 3–6",
};

// --- Rapid Response and Damage Assessment viewer ---

export const HAZARD_LABELS: Record<string, string> = {
  hail: "Hail",
  flood: "Flood",
  frost_freeze: "Frost / Freeze",
  heat: "Heat",
};

/** MODIS LST reads in °F, Sentinel-1 backscatter reads in dB - unit depends on which sensor produced the anomaly. */
export function unitForSensor(sensor: string | undefined): string {
  if (sensor === "s1_backscatter") return "dB";
  if (sensor === "modis_lst") return "°F";
  return "";
}
