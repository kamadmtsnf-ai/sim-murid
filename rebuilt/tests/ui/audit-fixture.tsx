import { createRoot } from "react-dom/client";
import { AuditTrail } from "../../src/components/audit/audit-trail";
createRoot(document.getElementById("root")!).render(
  <main
    id="main-content"
    className="mx-auto min-w-0 max-w-5xl space-y-6 p-4 sm:p-6"
  >
    <h1 className="text-3xl font-semibold">Rekonsiliasi</h1>
    <AuditTrail />
  </main>,
);
