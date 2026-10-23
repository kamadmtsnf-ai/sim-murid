import { createRoot } from "react-dom/client";
import { ReconciliationPanel } from "../../src/app/account/services/[module]/reconciliation-panel";
import { reconciliationSnapshot } from "../../src/lib/services/reconciliation";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const empty = new URLSearchParams(location.search).has("empty");
const data = reconciliationSnapshot.parse({
  module: "reconciliation",
  revision: 7,
  today: "2026-10-23",
  month: "2026-10-01",
  isAdmin: true,
  isManager: false,
  rows: [],
  extra: {
    tables: empty ? 0 : 5000,
    savingsBalance: empty ? 0 : Number.MAX_SAFE_INTEGER,
    reportSnapshots: empty ? 0 : 400000,
    pointSnapshots: 0,
    submittedSurveys: empty ? 0 : 300000,
    sourceAvailable: false,
  },
  years: [{ id: id(8), start_year: 2026 }],
  classes: empty
    ? []
    : Array.from({ length: 100 }, (_, i) => ({
        id: id(i + 3),
        name:
          i === 0 ? "KelasDenganNamaPanjangTanpaSpasi".repeat(8) : "Kelas " + i,
        academic_year_id: id(8),
      })),
  subjects: [],
});
Object.assign(window, { reconciliationFixture: data });
createRoot(document.getElementById("root")!).render(
  <main
    id="main-content"
    className="mx-auto min-w-0 max-w-5xl space-y-6 px-4 py-6 sm:px-6"
  >
    <h1 className="text-3xl font-semibold">Rekonsiliasi migrasi</h1>
    <ReconciliationPanel initial={data} />
  </main>,
);
