import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PwaInstall } from "@/components/pwa-install";
createRoot(document.getElementById("root")!).render(<StrictMode>
  <main id="main-content" tabIndex={-1} className="min-h-dvh p-[16px]">
    <h1>SiM-Murid</h1><label className="ds-field">Catatan<input className="ds-field-control" aria-label="Catatan" /></label>
  </main>
  <PwaInstall />
</StrictMode>);
