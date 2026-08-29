import type { CapacitorConfig } from "@capacitor/cli";

// Points at the static, client-only bundle produced by `npm run build:apk:web`
// (see apk/vite.config.ts) — NOT the TanStack Start/nitro output, which needs
// a live server and can't run inside a WebView.
const config: CapacitorConfig = {
  appId: "com.lumadateback.app",
  appName: "LUMA dateback",
  webDir: ".output-apk",
};

export default config;
