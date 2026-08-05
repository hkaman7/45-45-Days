// Client-side PDF generation for both viewers' "Generate PDF Report" buttons. Runs
// entirely in the browser (jsPDF) so it works on the static GitHub Pages deploy with
// no backend involved - same constraint that drives both viewers' data loading (see
// dataLoader.ts). Map imagery is embedded directly from the already-generated PNGs
// (same files the on-screen <ImageOverlay>s use) rather than screenshotting the
// interactive Leaflet map - avoids canvas-tainting issues with cross-origin basemap
// tiles, and is higher fidelity than a screen capture anyway.
//
// Narrative text (the "Summary"/"Lead-Time Outlook" sections) is generated from a
// fixed template driven by the real numbers, not a live LLM call - deliberately: this
// app has no backend on the deployed static site, so calling an LLM API directly from
// the browser would mean shipping an API key to every visitor. The data already
// available client-side (crop_loss_metrics.json's per-week rows, the crop health
// summary) is specific enough to write a genuinely informative, accurate narrative
// without one - see discussLeadTimes()/the Crop Health narrative below for what that
// looks like in practice.

import { jsPDF } from "jspdf";
import type { CountyCropHealth, CropHealthMapManifest, DamageEvent } from "../types/damage";
import type { CropLossMetric } from "../types/products";
import { withBase } from "./basePath";
import { formatNumber, formatPercent, formatPercentValue, WEEK_LABELS } from "./formatters";

// ---------------------------------------------------------------------------
// Shared PDF-building helpers
// ---------------------------------------------------------------------------

interface PdfBuilder {
  doc: jsPDF;
  pageWidth: number;
  margin: number;
  contentWidth: number;
  y: number;
  addWrappedText(text: string, fontSize: number, lineHeight: number, opts?: { bold?: boolean; color?: [number, number, number] }): void;
  ensureSpace(needed: number): void;
  hr(): void;
}

function createPdfBuilder(doc: jsPDF): PdfBuilder {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 42;
  const b = {
    doc,
    pageWidth,
    margin,
    contentWidth: pageWidth - margin * 2,
    y: margin,
    addWrappedText(text: string, fontSize: number, lineHeight: number, opts: { bold?: boolean; color?: [number, number, number] } = {}) {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", opts.bold ? "bold" : "normal");
      doc.setTextColor(...(opts.color ?? [17, 24, 39]));
      const lines = doc.splitTextToSize(text, b.contentWidth);
      doc.text(lines, margin, b.y);
      b.y += lines.length * lineHeight;
    },
    ensureSpace(needed: number) {
      if (b.y + needed > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        b.y = margin;
      }
    },
    hr() {
      doc.setDrawColor(209, 213, 219);
      doc.line(margin, b.y, pageWidth - margin, b.y);
      b.y += 18;
    },
  };
  return b;
}

/** Fetches a same-origin PNG and returns it as a data URL + its native pixel
 * dimensions (needed to scale it into the PDF without distortion). Same-origin
 * only - this is for the pipeline's own generated PNGs, not arbitrary images. */
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

function placeImage(
  b: PdfBuilder,
  img: { dataUrl: string; width: number; height: number } | null,
  x: number,
  rowY: number,
  colWidth: number,
  imgHeight: number,
  label: string,
  caption: string,
) {
  b.doc.setFontSize(9.5);
  b.doc.setFont("helvetica", "bold");
  b.doc.setTextColor(17, 24, 39);
  b.doc.text(label, x, rowY);
  b.doc.setFontSize(8);
  b.doc.setFont("helvetica", "normal");
  b.doc.setTextColor(107, 114, 128);
  b.doc.text(caption, x, rowY + 11);

  if (!img) {
    b.doc.setDrawColor(209, 213, 219);
    b.doc.rect(x, rowY + 16, colWidth, imgHeight);
    b.doc.setFontSize(9);
    b.doc.text("Image unavailable", x + 8, rowY + 16 + imgHeight / 2);
    return;
  }
  const scale = Math.min(colWidth / img.width, imgHeight / img.height);
  b.doc.addImage(img.dataUrl, "PNG", x, rowY + 16, img.width * scale, img.height * scale);
}

function statsGrid(b: PdfBuilder, stats: [string, string][], nCols = 2) {
  const colWidth = b.contentWidth / nCols;
  const startY = b.y;
  stats.forEach(([label, value], i) => {
    const col = i % nCols;
    const row = Math.floor(i / nCols);
    const x = b.margin + col * colWidth;
    const rowY = startY + row * 40;
    b.doc.setFontSize(8.5);
    b.doc.setFont("helvetica", "normal");
    b.doc.setTextColor(107, 114, 128);
    b.doc.text(label.toUpperCase(), x, rowY);
    b.doc.setFontSize(14);
    b.doc.setFont("helvetica", "bold");
    b.doc.setTextColor(17, 24, 39);
    b.doc.text(value, x, rowY + 16);
  });
  b.y = startY + Math.ceil(stats.length / nCols) * 40 + 10;
}

// ---------------------------------------------------------------------------
// Crop Health (Rapid Response) report
// ---------------------------------------------------------------------------

interface CropHealthReportParams {
  event: DamageEvent;
  eventLabel: string;
  countyName: string;
  county: CountyCropHealth;
  threshold_f: number;
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

export async function generateCropHealthReportPdf(params: CropHealthReportParams): Promise<void> {
  const { event, eventLabel, countyName, county, threshold_f, manifest, selectedIndex, selectedIndexLabel, selectedFieldId } = params;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const b = createPdfBuilder(doc);

  b.addWrappedText("45+45 Crop Health Report", 18, 22, { bold: true });
  b.addWrappedText(`Generated ${new Date().toLocaleString()}`, 9, 12, { color: [107, 114, 128] });
  b.y += 10;
  b.hr();

  b.addWrappedText(`Event: ${eventLabel}`, 11, 15, { bold: true });
  b.addWrappedText(`Hazard: ${event.hazard_type} · Confirmed ${event.confirmed_date} · Crop: ${event.crop ?? "n/a"}`, 10, 13);
  b.addWrappedText(`County: ${countyName} County (FIPS ${county.geoid})`, 10, 13);
  if (selectedFieldId) b.addWrappedText(`Selected field: …${selectedFieldId.slice(-6)}`, 10, 13);
  b.y += 12;

  statsGrid(b, [
    ["Acres Affected", `${formatNumber(county.acres.acres_affected, 0)} / ${formatNumber(county.acres.total_acres, 0)} ac (${formatNumber(county.acres.pct_acres_affected, 0)}%)`],
    ["Fields Affected", `${county.acres.n_fields_affected} / ${county.acres.n_fields}`],
    ["Crop-Loss Probability — Observed", county.observed.prob_below_normal_yield !== null ? formatPercent(county.observed.prob_below_normal_yield) : "—"],
    ["Crop-Loss Probability — Forecast", county.forecast ? formatPercent(county.forecast.prob_below_normal_yield) : "—"],
  ]);
  b.hr();
  b.y += 2;

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
      ? `The resulting observed crop-loss probability is ${formatPercent(observedP)} (${observedTier} severity). This is a single-snapshot estimate ` +
        `derived directly from satellite observations, not a forecast. ${forecastLine}`
      : `No observed crop-loss probability could be computed for this county. ${forecastLine}`);

  b.ensureSpace(120);
  b.addWrappedText("Summary", 12, 15, { bold: true });
  b.addWrappedText(narrative, 10, 14);
  b.y += 10;

  const sensor = manifest?.sensors[selectedIndex];
  const beforeWindow = sensor?.windows.before;
  const afterWindow = sensor?.windows.after;

  if (beforeWindow || afterWindow) {
    b.ensureSpace(220);
    b.addWrappedText(`Satellite Imagery — ${selectedIndexLabel}`, 12, 15, { bold: true });

    const imgColWidth = (b.contentWidth - 12) / 2;
    const imgHeight = 200;
    const rowY = b.y;

    const [beforeImg, afterImg] = await Promise.all([
      beforeWindow ? fetchAsDataUrl(withBase(beforeWindow.png)) : Promise.resolve(null),
      afterWindow ? fetchAsDataUrl(withBase(afterWindow.png)) : Promise.resolve(null),
    ]);

    // "to" not "→" - jsPDF's default Helvetica uses WinAnsi encoding (Windows-1252),
    // which has no arrow glyph and silently renders it as mojibake (confirmed by
    // rendering a real test PDF, not assumed).
    placeImage(b, beforeImg, b.margin, rowY, imgColWidth, imgHeight, "Before", manifest ? `${manifest.date_windows.before.start} to ${manifest.date_windows.before.end}` : "");
    placeImage(b, afterImg, b.margin + imgColWidth + 12, rowY, imgColWidth, imgHeight, "After", manifest ? `${manifest.date_windows.after.start} to ${manifest.date_windows.after.end}` : "");

    b.y = rowY + 16 + imgHeight + 16;
  }

  const fileName = `45-45_crop_health_${event.event_id}_${county.geoid}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

// ---------------------------------------------------------------------------
// Risk Viewer report
// ---------------------------------------------------------------------------

const WEEK_ORDER: Record<string, number> = { week3: 0, week4: 1, week5: 2, week6: 3 };

interface RiskViewerReportParams {
  countyName: string;
  geoid: string;
  cropLabel: string;
  productLabel: string;
  forecastInitDate: string;
  weekRows: CropLossMetric[]; // this county+crop's rows, any order, any subset of week3..week6
  mapImageUrl: string | null; // product.rasterUrl, already a repo-root-relative path
  mapImageLabel: string;
}

/** Deterministic trend/discussion narrative from the real per-week numbers - see the
 * module docstring for why this is a template, not a live LLM call. */
function discussLeadTimes(cropLabel: string, countyName: string, weekRows: CropLossMetric[]): string {
  if (weekRows.length === 0) {
    return `No forecast data is available across lead times for ${cropLabel} in ${countyName} County.`;
  }
  const sorted = [...weekRows].sort((a, b) => WEEK_ORDER[a.week_group] - WEEK_ORDER[b.week_group]);
  const peak = [...sorted].sort((a, b) => b.prob_below_normal_yield - a.prob_below_normal_yield)[0];
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const delta = last.prob_below_normal_yield - first.prob_below_normal_yield;
  const trend = delta > 0.05 ? "rising" : delta < -0.05 ? "easing" : "roughly stable";

  const drivers = Array.from(new Set(sorted.map((r) => r.dominant_driver)));
  const driverText =
    drivers.length === 1
      ? `consistently driven by ${drivers[0].replace("_", " ")}`
      : `driven by a mix of ${drivers.map((d) => d.replace("_", " ")).join(" and ")} depending on the week`;

  const avgConfidence = sorted.reduce((s, r) => s + r.confidence_score, 0) / sorted.length;

  const weekByWeek = sorted
    .map((r) => `${WEEK_LABELS[r.week_group]} (${formatPercent(r.prob_below_normal_yield)}, ${r.risk_class})`)
    .join(", ");

  return (
    `Across the ${sorted.length}-week subseasonal outlook (${WEEK_LABELS[first.week_group]} through ${WEEK_LABELS[last.week_group]}), ` +
    `crop-loss probability for ${cropLabel} in ${countyName} County is ${trend} over the forecast window, peaking in ${WEEK_LABELS[peak.week_group]} ` +
    `at ${formatPercent(peak.prob_below_normal_yield)} (${peak.risk_class} risk class). The outlook is ${driverText} across the period, with an average ` +
    `ensemble confidence score of ${avgConfidence.toFixed(2)} (0-1 scale, higher is more confident). Week-by-week: ${weekByWeek}.`
  );
}

export async function generateRiskViewerReportPdf(params: RiskViewerReportParams): Promise<void> {
  const { countyName, geoid, cropLabel, productLabel, forecastInitDate, weekRows, mapImageUrl, mapImageLabel } = params;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const b = createPdfBuilder(doc);

  b.addWrappedText("45+45 Risk Viewer Report", 18, 22, { bold: true });
  b.addWrappedText(`Generated ${new Date().toLocaleString()}`, 9, 12, { color: [107, 114, 128] });
  b.y += 10;
  b.hr();

  b.addWrappedText(`County: ${countyName} County (FIPS ${geoid})`, 11, 15, { bold: true });
  b.addWrappedText(`Crop: ${cropLabel} · Product: ${productLabel} · Forecast Init Date: ${forecastInitDate}`, 10, 13);
  b.y += 12;

  const sorted = [...weekRows].sort((a, r) => WEEK_ORDER[a.week_group] - WEEK_ORDER[r.week_group]);

  if (mapImageUrl) {
    b.ensureSpace(230);
    const img = await fetchAsDataUrl(withBase(mapImageUrl));
    const imgHeight = 200;
    const rowY = b.y;
    placeImage(b, img, b.margin, rowY, b.contentWidth, imgHeight, mapImageLabel, `${cropLabel} · ${productLabel}`);
    b.y = rowY + 16 + imgHeight + 20;
  }

  // --- Per-lead-time results table ---
  b.ensureSpace(40 + sorted.length * 20);
  b.addWrappedText("Results by Lead Time", 12, 15, { bold: true });
  b.y += 4;

  const cols = [
    { label: "Week", width: 0.14 },
    { label: "Risk Class", width: 0.18 },
    { label: "Prob. of Loss", width: 0.15 },
    { label: "Yield Reduction", width: 0.17 },
    { label: "Mean Stress", width: 0.15 },
    { label: "Driver", width: 0.21 },
  ];
  let cx = b.margin;
  const headerY = b.y;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(107, 114, 128);
  for (const col of cols) {
    doc.text(col.label.toUpperCase(), cx, headerY);
    cx += col.width * b.contentWidth;
  }
  b.y += 14;
  doc.setDrawColor(229, 231, 235);
  doc.line(b.margin, b.y - 6, b.pageWidth - b.margin, b.y - 6);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(9.5);
  for (const row of sorted) {
    cx = b.margin;
    const values = [
      WEEK_LABELS[row.week_group],
      row.risk_class,
      formatPercent(row.prob_below_normal_yield),
      formatPercentValue(row.expected_reduction_pct),
      formatNumber(row.mean_stress_f, 1, "°F"),
      row.dominant_driver.replace("_", " "),
    ];
    for (let i = 0; i < cols.length; i++) {
      doc.text(values[i], cx, b.y);
      cx += cols[i].width * b.contentWidth;
    }
    b.y += 18;
  }
  b.y += 10;
  b.hr();
  b.y += 2;

  // --- Discussion ---
  const narrative = discussLeadTimes(cropLabel, countyName, sorted);
  b.ensureSpace(120);
  b.addWrappedText("Lead-Time Outlook", 12, 15, { bold: true });
  b.addWrappedText(narrative, 10, 14);

  const fileName = `45-45_risk_viewer_${geoid}_${cropLabel.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
