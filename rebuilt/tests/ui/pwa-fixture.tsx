import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PwaInstall, PwaInstallButton, PwaRequirement, PwaSkipLink } from "@/components/pwa-install";
import { FormNavigationGuard } from "@/components/forms/navigation-guard";
const required=new URLSearchParams(location.search).get('required')==='1';
createRoot(document.getElementById("root")!).render(<StrictMode>
  <PwaInstall><PwaSkipLink /><FormNavigationGuard>
    <PwaRequirement required={required} signOut={<form action="/api/auth/logout" method="post"><button type="submit">Keluar akun</button></form>}>
      <main id="main-content" tabIndex={-1} className="min-h-dvh p-[16px]">
        <h1>SiM-Murid</h1><p>Konten layanan akun</p><label className="ds-field">Catatan<input className="ds-field-control" aria-label="Catatan" /></label>
      </main>
      <footer className="workspace-footer" aria-label="Informasi aplikasi"><span>SiM-Murid</span><PwaInstallButton /></footer>
    </PwaRequirement>
  </FormNavigationGuard></PwaInstall>
</StrictMode>);
