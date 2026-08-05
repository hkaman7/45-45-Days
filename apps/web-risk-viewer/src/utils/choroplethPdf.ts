// Draws a CONUS county choropleth directly into a jsPDF document as filled vector
// polygons - used for the Risk Viewer PDF report's 4 vector-only product types
// (Crop Loss Probability, Expected Yield Reduction, Risk Classification,
// Climatology Baseline), which have no pre-rendered map PNG (see MapView.tsx: these
// render as a live Leaflet <GeoJSON> layer colored by county value, not a raster
// image). Reuses the exact same getCountyValue()/styleForValue() logic MapView.tsx
// uses for the on-screen map, so PDF colors match the app exactly. Drawing real
// vector paths (not a screenshot) means no basemap-tile CORS/canvas-tainting risk and
// a crisp, small-file-size result at any zoom.

import type { Feature } from "geojson";
import type { jsPDF } from "jspdf";
import { CONUS_BOUNDS } from "../config/products";
import { getCountyValue, styleForValue, type ClimatologyIndex, type MetricsIndex } from "./leafletLayers";
import type { CountyFeatureProperties, ProductConfig } from "../types/products";

function project(lon: number, lat: number, bounds: [[number, number], [number, number]], x: number, y: number, w: number, h: number): [number, number] {
  const [[latMin, lonMin], [latMax, lonMax]] = bounds;
  const px = x + ((lon - lonMin) / (lonMax - lonMin)) * w;
  const py = y + h - ((lat - latMin) / (latMax - latMin)) * h; // lat increases north -> smaller y (up)
  return [px, py];
}

function drawRing(
  doc: jsPDF,
  ring: number[][],
  bounds: [[number, number], [number, number]],
  x: number,
  y: number,
  w: number,
  h: number,
  style: "F" | "S",
) {
  if (ring.length < 3) return;
  const pts = ring.map(([lon, lat]) => project(lon, lat, bounds, x, y, w, h));
  const [startX, startY] = pts[0];
  const deltas: [number, number][] = [];
  for (let i = 1; i < pts.length; i++) {
    deltas.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
  }
  doc.lines(deltas, startX, startY, [1, 1], style, true);
}

interface DrawChoroplethParams {
  doc: jsPDF;
  x: number;
  y: number;
  width: number;
  height: number;
  counties: Feature[];
  product: ProductConfig;
  metricsIndex: MetricsIndex;
  climatologyIndex: ClimatologyIndex;
  highlightGeoid?: string | null;
  /** Overrides product.bounds/CONUS_BOUNDS - pass a tight region (e.g. the
   * selected county's own bbox, padded) to crop the drawn map to just that
   * area instead of projecting the full country into the box. */
  regionBounds?: [[number, number], [number, number]];
}

export function drawChoropleth(params: DrawChoroplethParams): void {
  const { doc, x, y, width, height, counties, product, metricsIndex, climatologyIndex, highlightGeoid, regionBounds } = params;
  const bounds = regionBounds ?? product.bounds ?? CONUS_BOUNDS;

  doc.setFillColor("#f9fafb");
  doc.rect(x, y, width, height, "F");

  doc.setLineWidth(0.1);
  for (const feature of counties) {
    const geoid = (feature.properties as CountyFeatureProperties).geoid;
    const value = getCountyValue(product, metricsIndex, climatologyIndex, geoid);
    const style = styleForValue(product, value);
    doc.setFillColor(style.fillColor as string);
    doc.setDrawColor(style.color as string);

    const geom = feature.geometry;
    const polygons = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
    for (const rings of polygons) {
      // Outer ring only - true holes are rare/tiny in the simplified dataset and
      // jsPDF's lines() fills one ring at a time (no even-odd multi-ring support
      // in a single call), not worth the complexity for a report-quality map.
      drawRing(doc, rings[0], bounds, x, y, width, height, "F");
    }
  }

  // Selected county highlight, drawn after the base fill so its border sits on top.
  if (highlightGeoid) {
    const feature = counties.find((f) => (f.properties as CountyFeatureProperties).geoid === highlightGeoid);
    if (feature) {
      doc.setDrawColor("#1d4ed8");
      doc.setLineWidth(1.1);
      const geom = feature.geometry;
      const polygons = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
      for (const rings of polygons) drawRing(doc, rings[0], bounds, x, y, width, height, "S");
    }
  }

  doc.setDrawColor(107, 114, 128);
  doc.setLineWidth(0.6);
  doc.rect(x, y, width, height);
}
