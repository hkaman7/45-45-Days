import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  // GitHub Pages serves the production build as a project page at
  // github.io/45-45-Days/, not at the domain root - keep dev at "/" so
  // `npm run dev` still works at the usual localhost:5173/ URL. Every runtime
  // fetch("/data/...") call and asset path baked into the pipeline's JSON
  // output respects this via utils/basePath.ts's withBase().
  base: command === "build" ? "/45-45-Days/" : "/",
  plugins: [react()],
  server: {
    port: 5173,
  },
}));
