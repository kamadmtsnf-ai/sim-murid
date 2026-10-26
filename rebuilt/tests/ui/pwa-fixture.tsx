import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PwaInstall } from "@/components/pwa-install";
createRoot(document.getElementById("root")!).render(<StrictMode><main id="main-content"><h1>SiM-Murid</h1><label>Catatan<input aria-label="Catatan" /></label></main><PwaInstall /></StrictMode>);
