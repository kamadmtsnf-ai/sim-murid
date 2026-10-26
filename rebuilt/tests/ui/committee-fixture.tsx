/** Actual committee UI, synthetic records; no production identity or mutation. */
import { createRoot } from "react-dom/client";
import { OperationsPanel as CommitteePanel } from "../../src/app/account/operations/[module]/panel";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import { committeeSnapshot } from "../../src/lib/operations/committee";
import Loading from "../../src/app/account/loading";
import ErrorPage from "../../src/app/account/error";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const mode = new URLSearchParams(location.search).get("mode") ?? "normal",
  readonly = mode === "readonly";
const people = Array.from({ length: mode === "large" ? 80 : 3 }, (_, i) => ({
  id: id(10 + i),
  username: "siswa-" + i,
  full_name: i === 2 ? "NamaPanjangTanpaSpasi".repeat(7) : "Siswa " + (i + 1),
  role_code: "student",
  class_id: id(300),
  class_name: "7A",
}));
const monthRows = people.flatMap((p) =>
  Array.from({ length: 12 }, (_, i) => ({
    student_id: p.id,
    name: p.full_name,
    month: "2026-" + String(i + 1).padStart(2, "0") + "-01",
    status: i === 0 ? "paid" : i === 1 ? "waived" : "unpaid",
    amount: i === 0 ? 60000 : 0,
    waiverSources: i === 1 ? 1 : 0,
    tariff: i === 3 ? null : 50000,
    outstanding: i < 2 ? 0 : i === 3 ? null : 50000,
  })),
);
const rows = Array.from({ length: mode === "large" ? 50 : 2 }, (_, i) => ({
  id: id(400 + i),
  student_id: id(10),
  name: "Siswa 1",
  date: "2026-10-02",
  notes: "Catatan " + "panjang".repeat(30),
  amount: 110000,
  allocations: [
    { month: "2025-12-01", amount: 50000 },
    { month: "2026-01-01", amount: 60000 },
  ],
  can_edit: !readonly,
}));
const data = committeeSnapshot.parse({
  module: "fees",
  today: "2026-10-22",
  revision: 1,
  canManage: !readonly,
  isAdmin: !readonly,
  people: mode === "empty" ? [] : people,
  classes: [{ id: id(300), name: "7A", level: 7, academic_year_id: id(301) }],
  rows: mode === "empty" ? [] : rows,
  total: mode === "empty" ? 0 : mode === "large" ? 120 : 2,
  page: 1,
  pageSize: 50,
  summary: {
    cashReceived: 220000,
    waivedMonths: 3,
    unpaidMonths: 30,
    knownOutstanding: 1350000,
    unknownTariffs: 3,
  },
  extra: {
    months: mode === "empty" ? [] : monthRows,
    trend: [{ month: "2026-10", value: 220000 }],
  },
});
Object.assign(window, { committeeFixture: data });
createRoot(document.getElementById("root")!).render(
  <WorkspaceShell
    navigation={navigationFor(["fees.read"], true)}
    name="Petugas uji"
    username="qa-committee"
  >
    {mode === "loading" ? (
      <Loading />
    ) : mode === "error" ? (
      <ErrorPage error={Error("Synthetic")} reset={() => location.reload()} />
    ) : (
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto min-w-0 max-w-7xl space-y-6 p-6"
      >
        <h1 className="text-3xl font-semibold">Iuran Komite</h1>
        <CommitteePanel initial={data} />
      </main>
    )}
  </WorkspaceShell>,
);
