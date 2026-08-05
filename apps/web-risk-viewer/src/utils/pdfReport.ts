// Client-side PDF generation for the Crop Health tab's "Generate PDF Report" button.
// Runs entirely in the browser (jsPDF) so it works on the static GitHub Pages deploy
// with no backend involved - same constraint that drove Crop Health's data loading
// itself (see dataLoader.ts). Before/after imagery is embedded directly from the
// already-generated PNGs (same files the map <ImageOverlay> uses) rather than
// screenshotting the interactive Leaflet map - avoids canvas-tainting issues with
// cross-origin basemap tiles, and is higher fidelity than a screen capture anyway.

import { jsPDF } from "jspdf";
import type { CountyCropHealth, CropHealthMapManifest, DamageEvent } from "../types/damage";
import { withBase } from "./basePath";
import { formatNumber, formatPercent } from "./formatters";

interface ReportParams {
  event: DamageEvent;
  eventLabel: string;
  countyName: string;
  county: CountyCropHealth;
  threshold_f: number;
  summaryNote: string;
  manifest: CropHealthMapManifest | null;
  selectedIndex: string;
  selectedIndexLabel: string;
  selectedFieldId: string | null;
}

/** Plain-language severity tier for a bare probability - deliberately its own simple
 * scale, not Risk Viewer's risk_class (that's a weighted composite of stress/reduction/
 * confidence, not reproducible from probability alone - see 07_generate_products.py's
 * compute_risk()). Labeled as such in the report so the two aren't conflated. */
function probabilityTier(p: number): string {
  if (p < 0.25) return "Low";
  if (p < 0.5) return "Moderate";
  if (p < 0.75) return "High";
  return "Severe";
}

async function fetchAsDataUrl(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.src = dataUrl;
    });
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}

export async function generateCropHealthReportPdf(params: ReportParams): Promise<void> {
  const { event, eventLabel, countyName, county, threshold_f, summaryNote, manifest, selectedIndex, selectedIndexLabel, selectedFieldId } = params;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  function addWrappedText(text: string, fontSize: number, lineHeight: number, opts: { bold?: boolean; color?: [number, number, number] } = {}) {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setTextColor(...(opts.color ?? [17, 24, 39]));
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * lineHeight;
  }

  function ensureSpace(needed: number) {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  }

  // --- Header ---
  addWrappedText("45+45 Crop Health Report", 18, 22, { bold: true });
  addWrappedText(`Generated ${new Date().toLocaleString()}`, 9, 12, { color: [107, 114, 128] });
  y += 10;

  doc.setDrawColor(209, 213, 219);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  // --- Metadata ---
  addWrappedText(`Event: ${eventLabel}`, 11, 15, { bold: true });
  addWrappedText(`Hazard: ${event.hazard_type} · Confirmed ${event.confirmed_date} · Crop: ${event.crop ?? "n/a"}`, 10, 13);
  addWrappedText(`County: ${countyName} County (FIPS ${county.geoid})`, 10, 13);
  if (selectedFieldId) addWrappedText(`Selected field: …${selectedFieldId.slice(-6)}`, 10, 13);
  y += 12;

  // --- Stats strip ---
  const stats: [string, string][] = [
    ["Acres Affected", `${formatNumber(county.acres.acres_affected, 0)} / ${formatNumber(county.acres.total_acres, 0)} ac (${formatNumber(county.acres.pct_acres_affected, 0)}%)`],
    ["Fields Affected", `${county.acres.n_fields_affected} / ${county.acres.n_fields}`],
    ["Crop-Loss Probability — Observed", county.observed.prob_below_normal_yield !== null ? formatPercent(county.observed.prob_below_normal_yield) : "—"],
    ["Crop-Loss Probability — Forecast", county.forecast ? formatPercent(county.forecast.prob_below_normal_yield) : "—"],
  ];
  const colWidth = contentWidth / 2;
  const statsStartY = y;
  stats.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin + col * colWidth;
    const rowY = statsStartY + row * 40;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(label.toUpperCase(), x, rowY);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.text(value, x, rowY + 16);
  });
  y = statsStartY + Math.ceil(stats.length / 2) * 40 + 10;

  doc.setDrawColor(209, 213, 219);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  // --- Narrative ---
  const observedP = county.observed.prob_below_normal_yield;
  const observedTier = observedP !== null ? probabilityTier(observedP) : null;
  const forecastLine = county.forecast
    ? `For comparison, the routine forecast-based probability from the 45+45 Risk Viewer's subseasonal model is ${formatPercent(county.forecast.prob_below_normal_yield)} (${county.forecast.risk_class} risk class, ${county.forecast.week_group}), computed independently and shown for context - not blended with the observed figure.`
    : "No routine forecast is available for this county/crop for comparison.";

  const narrative =
    `This report summarizes observed crop health for ${countyName} County (${event.crop ?? "n/a"}) following the ` +
    `${event.hazard_type} event confirmed on ${event.confirmed_date}. Of ${formatNumber(county.acres.total_acres, 0)} acres of mapped ` +
    `${event.crop ?? "crop"} fields in this county, ${formatNumber(county.acres.acres_affected, 0)} acres ` +
    `(${formatNumber(county.acres.pct_acres_affected, 0)}%) - spanning ${county.acres.n_fields_affected} of ${county.acres.n_fields} fields - ` +
    `showed post-event land-surface temperature exceeding the crop's ${threshold_f}°F stress threshold, based on a satellite composite of the days ` +
    `immediately after the event compared against a 30-day pre-event baseline.\n\n` +
    (observedP !== null
      ? `The resulting observed crop-loss probability is ${formatPercent(observedP)} (${observedTier} severity on a simple 0-25/25-50/50-75/75-100% scale - ` +
        `not the same categorical scale Risk Viewer's forecast risk class uses). This is a single-snapshot estimate derived directly from satellite ` +
        `observations, not a forecast. ${forecastLine}`
      : `No observed crop-loss probability could be computed for this county. ${forecastLine}`);

  ensureSpace(120);
  addWrappedText("Summary", 12, 15, { bold: true });
  addWrappedText(narrative, 10, 14);
  y += 10;

  // --- Before/After imagery ---
  const sensor = manifest?.sensors[selectedIndex];
  const beforeWindow = sensor?.windows.before;
  const afterWindow = sensor?.windows.after;

  if (beforeWindow || afterWindow) {
    ensureSpace(220);
    addWrappedText(`Satellite Imagery — ${selectedIndexLabel}`, 12, 15, { bold: true });

    const imgColWidth = (contentWidth - 12) / 2;
    const imgHeight = 200;
    const rowY = y;

    const [beforeImg, afterImg] = await Promise.all([
      beforeWindow ? fetchAsDataUrl(withBase(beforeWindow.png)) : Promise.resolve(null),
      afterWindow ? fetchAsDataUrl(withBase(afterWindow.png)) : Promise.resolve(null),
    ]);

    function placeImage(img: { dataUrl: string; width: number; height: number } | null, x: number, label: string, dateRange: string) {
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 24, 39);
      doc.text(label, x, rowY);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      doc.text(dateRange, x, rowY + 11);

      if (!img) {
        doc.setDrawColor(209, 213, 219);
        doc.rect(x, rowY + 16, imgColWidth, imgHeight);
        doc.setFontSize(9);
        doc.text("Image unavailable", x + 8, rowY + 16 + imgHeight / 2);
        return;
      }
      const scale = Math.min(imgColWidth / img.width, imgHeight / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      doc.addImage(img.dataUrl, "PNG", x, rowY + 16, w, h);
    }

    // "to" not "→" - jsPDF's default Helvetica uses WinAnsi encoding (Windows-1252),
    // which has no arrow glyph and silently renders it as mojibake (confirmed by
    // rendering a real test PDF, not assumed).
    placeImage(beforeImg, margin, "Before", manifest ? `${manifest.date_windows.before.start} to ${manifest.date_windows.before.end}` : "");
    placeImage(afterImg, margin + imgColWidth + 12, "After", manifest ? `${manifest.date_windows.after.start} to ${manifest.date_windows.after.end}` : "");

    y = rowY + 16 + imgHeight + 16;
  }

  // --- Methodology / caveats ---
  ensureSpace(140);
  doc.setDrawColor(209, 213, 219);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;
  addWrappedText("Methodology & Caveats", 10, 13, { bold: true, color: [107, 114, 128] });
  addWrappedText(summaryNote, 8, 11, { color: [107, 114, 128] });

  const fileName = `45-45_crop_health_${event.event_id}_${county.geoid}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
