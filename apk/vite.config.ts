import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Standalone client-only build used ONLY to produce the static bundle that
// gets embedded in the Capacitor Android shell (see ../capacitor.config.ts
// and the `build:apk:web` script). It deliberately bypasses TanStack
// Start/nitro (SSR) — the app has a single, data-less route, so it renders
// fine as a plain client SPA, and a plain SPA is what a WebView needs: no
// server to talk to. It reuses the real `Index` screen and design tokens
// from `src/`, so there is no UI to keep in sync.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL("../.output-apk", import.meta.url)),
    emptyOutDir: true,
  },
});
