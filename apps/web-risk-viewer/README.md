# 45+45 Agricultural Risk Intelligence — Web Risk Viewer

A React + TypeScript + Leaflet prototype for visualizing the 45+45 project's
national agricultural weather-risk products: crop stress, heatwave
probability, crop-loss probability, expected yield reduction, county risk
classification, and GridMET climatology baseline, for Corn (national/Corn
Belt) and Grapes (California).

## Running it

```bash
# 1. (Re)generate the data files this app reads, from the Python pipeline's
#    real outputs. Run from the repo root, with the project's .venv active:
python data_pipelines/pipelines/08_prepare_webapp_data.py

# 2. Install & run the app
cd apps/web-risk-viewer
npm install
npm run dev
# -> http://localhost:5173
```

## How this connects to the pipeline (READ THIS before adding a product)

This app never talks to the Python pipeline directly — everything it shows
comes from static files under `public/data/`, generated once by
`data_pipelines/pipelines/08_prepare_webapp_data.py`:

| File | Built from | Contains |
|---|---|---|
| `counties_simplified.geojson` | `us_counties.shp` | Simplified county geometry only (no metrics — kept separate so it's never duplicated per week/product) |
| `crop_loss_metrics.json` | `forecast_crop_loss.csv` (script 06) | Per county × crop × week_group: probability of loss, expected reduction, risk class/score, confidence, dominant driver |
| `county_climatology.json` | `county_crop_stress_2015_2022.csv` (script 02) | Real 2015-2022 per-county historical mean stress — the genuine "climatology baseline" |
| `rasters/*_crop_stress_*.png` | `crop_stress/forecast/.../mean_stress_F.tif` (script 04) | Corn/grape forecast stress, converted to PNG since no PNG existed yet |
| `rasters/*.png` (heatwave, percentile, anomaly, risk_category, confidence) | `ui_map_products/.../map_catalog.json` (older `generate_s2s_ui_map_products.py` run) | Everything else — reused, not regenerated |
| `raster_catalog.json` | trimmed copy of the above `map_catalog.json` | Metadata for the reused rasters |

**Every layer path lives in one place: `src/config/products.ts`.** No
component ever hard-codes a file path, color, or threshold — they all read
from the `PRODUCT_REGISTRY` array built there. To add a new product or wire
up real data for a combination that's currently a placeholder:

1. Make sure `08_prepare_webapp_data.py` (or a future pipeline step) writes
   the file under `public/data/`.
2. Add/adjust the resolver logic in `products.ts` (`rasterEntry()` /
   `vectorEntry()`) so that combination's `dataAvailable` flips to `true`
   and points at the right path.
3. Nothing else needs to change — every component (`MapView`, `Legend`,
   `CountyInfoPanel`) reads the registry generically.

## What's real vs. placeholder right now

- **Real**: Corn & Grape crop stress (all weeks + aggregate, forecast
  reference), heatwave probability (forecast + anomaly reference, both
  crops), climatology baseline (both raster-percentile and real vector
  2015-2022 mean), crop-loss probability / expected yield reduction / risk
  classification (vector, forecast reference, all weeks + aggregate).
- **Placeholder** (clearly labeled in the legend/info panel, not silently
  blank): historical-climatology or forecast-anomaly reference mode for the
  three vector crop-loss products — Phase 2's model doesn't produce a
  historical-year or anomaly version of those yet.

## Rendering approach

Rasters render via Leaflet's built-in `<ImageOverlay>` (a plain georeferenced
PNG + bounds), not `georaster-layer-for-leaflet`/`geotiff.js` — the source
PNGs are already small, pre-colored, full-CONUS-extent images, so there's no
need for in-browser GeoTIFF decoding. Each `ProductConfig` in the registry
also carries a `cogUrl` pointing at the source GeoTIFF/COG (not rendered by
this prototype) — swap the rendering strategy there if this later moves to
tiled/GCS-hosted rasters.

Vector (county) layers render via `<GeoJSON>` styled from
`crop_loss_metrics.json` / `county_climatology.json`, joined client-side by
GEOID in `src/utils/leafletLayers.ts` (kept separate from geometry so the
210MB+ collapsed GeoJSON the pipeline produces never has to be served to a
browser).

## Folder structure

```
src/
  main.tsx, App.tsx
  components/     - MapView, ControlPanel, Legend, CountyInfoPanel,
                    ProductSelector, CropSelector, WeekSelector,
                    ReferenceSelector, LayerToggle, CountySearch
  config/         - products.ts (the registry), legends.ts (color ramps)
  state/          - AppStateContext.tsx (crop/product/week/reference/etc.)
  utils/          - colorScales.ts, formatters.ts, leafletLayers.ts, dataLoader.ts
  types/          - products.ts (all shared TS interfaces)
```
