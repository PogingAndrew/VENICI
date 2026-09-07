import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages project sites (username.github.io/repo-name) serve everything
// under a subpath, so asset URLs must be prefixed with it. Set VITE_BASE_PATH
// at build time (e.g. VITE_BASE_PATH=/repo-name/ npm run build); it's "/" for
// local dev, a custom domain, or a username.github.io root site.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
