// Crops a same-origin raster PNG to a county's or field's real polygon shape,
// via Canvas - not just its bounding box, so the result actually looks like
// "only that county/field" rather than a rectangle that still shows a chunk
// of neighboring area. One implementation, two consumers: the live map
// (MapView.tsx, crop-on-selection) and the PDF report (pdfReport.ts, same
// crop instead of embedding the full-CONUS raster).

import type { Geometry } from "geojson";

export interface CroppedRaster {
  dataUrl: string;
  bounds: [[number, number], [number, number]]; // [[south,west],[north,east]]
  width: number; // cropped image's own pixel dimensions - callers that place
  height: number; // this at a fixed box size need these to preserve aspect ratio
}

const PADDING_FRAC = 0.06; // a little context around the shape's edge, not a razor-tight crop

function ringsOf(geometry: Geometry): number[][][] {
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  return [];
}

/** [minLon, minLat, maxLon, maxLat] - exported for callers that just need to
 * fit/zoom a map to a geometry, not crop a raster to it. */
export function bboxOf(geometry: Geometry): [number, number, number, number] {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const ring of ringsOf(geometry)) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return [minLon, minLat, maxLon, maxLat];
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Crops `imageUrl` (a raster whose own geographic extent is `imageBounds`,
 * [[south,west],[north,east]]) to `geometry`'s real shape (not just its
 * bbox), with a small padding for context. Returns the cropped image as a
 * data URL plus its own (tighter) bounds, ready to use as a new
 * <ImageOverlay bounds=...> or jsPDF addImage source. Returns null if the
 * image fails to load or the geometry has no rings.
 */
export async function cropRasterToGeometry(
  imageUrl: string,
  imageBounds: [[number, number], [number, number]],
  geometry: Geometry,
): Promise<CroppedRaster | null> {
  const rings = ringsOf(geometry);
  if (rings.length === 0) return null;

  let img: HTMLImageElement;
  try {
    img = await loadImage(imageUrl);
  } catch {
    return null;
  }

  const [imgSouth, imgWest] = imageBounds[0];
  const [imgNorth, imgEast] = imageBounds[1];
  const lonToPx = (lon: number) => ((lon - imgWest) / (imgEast - imgWest)) * img.naturalWidth;
  const latToPy = (lat: number) => ((imgNorth - lat) / (imgNorth - imgSouth)) * img.naturalHeight; // lat increases north -> smaller y

  const [minLon, minLat, maxLon, maxLat] = bboxOf(geometry);
  const padLon = (maxLon - minLon) * PADDING_FRAC;
  const padLat = (maxLat - minLat) * PADDING_FRAC;
  const cropSouth = Math.max(minLat - padLat, imgSouth);
  const cropNorth = Math.min(maxLat + padLat, imgNorth);
  const cropWest = Math.max(minLon - padLon, imgWest);
  const cropEast = Math.min(maxLon + padLon, imgEast);

  const srcX = lonToPx(cropWest);
  const srcY = latToPy(cropNorth);
  const srcW = lonToPx(cropEast) - srcX;
  const srcH = latToPy(cropSouth) - srcY;
  if (srcW <= 0 || srcH <= 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(srcW));
  canvas.height = Math.max(1, Math.round(srcH));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Clip to the real polygon shape (not the bbox) - project each ring into
  // canvas-local pixel space (relative to the crop's own top-left corner),
  // one subpath per ring, evenodd fill rule so holes (rare in county/field
  // data, but this way they're actually handled correctly) cut out properly.
  const path = new Path2D();
  for (const ring of rings) {
    ring.forEach(([lon, lat], i) => {
      const x = lonToPx(lon) - srcX;
      const y = latToPy(lat) - srcY;
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });
    path.closePath();
  }
  ctx.clip(path, "evenodd");

  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);

  return {
    dataUrl: canvas.toDataURL("image/png"),
    bounds: [
      [cropSouth, cropWest],
      [cropNorth, cropEast],
    ],
    width: canvas.width,
    height: canvas.height,
  };
}
