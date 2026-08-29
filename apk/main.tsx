import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Index } from "@/routes/index";
import { Toaster } from "@/components/ui/sonner";
import "@/styles.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element missing from apk/index.html");

createRoot(rootEl).render(
  <StrictMode>
    <Index />
    <Toaster position="bottom-center" richColors />
  </StrictMode>,
);
