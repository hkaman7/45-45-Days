/**
 * Prefixes an absolute "/data/..." path with Vite's configured base
 * (see vite.config.ts) - needed because GitHub Pages serves this app from a
 * /45-45-Days/ subpath, not the domain root, but every static-data path in
 * this codebase (both hand-written fetch() calls and paths the Python
 * pipeline bakes into manifest.json/raster_catalog.json) assumes root
 * deployment. import.meta.env.BASE_URL already ends in "/", so strip the
 * leading slash before concatenating.
 */
export function withBase(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
