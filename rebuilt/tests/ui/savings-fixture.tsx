/** Actual savings panel with synthetic identities and intercepted writes. */
import { createRoot } from "react-dom/client";
import { SavingsPanel } from "../../src/app/account/operations/[module]/savings-panel";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import { savingsSnapshot } from "../../src/lib/operations/savings";
import Loading from "../../src/app/account/loading";
import ErrorPage from "../../src/app/account/error";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const mode = new URLSearchParams(location.search).get("mode") ?? "normal",
  readonly = mode === "readonly";
const people = Array.from({ length: mode === "large" ? 80 : 3 }, (_, i) => ({
  id: id(10 + i),
  username: "siswa-" + i,
  full_name: i === 2 ? "NamaTanpaSpasi".repeat(15) : "Siswa " + (i + 1),
  role_code: "student",
  class_id: null,
  class_name: null,
}));
const accounts = people.slice(0, -1).map((p, i) => ({
  id: id(300 + i),
  owner_id: p.id,
  name: p.full_name,
  category: "S",
  balance: 77000,
}));
const rows = Array.from({ length: mode === "large" ? 50 : 3 }, (_, i) => ({
  id: id(400 + i),
  account_id: id(300),
  student_id: id(10),
  name: "Siswa 1",
  date: "2026-10-22",
  kind: i === 2 ? "reversal" : "withdrawal",
  amount: 123000,
  delta: i === 2 ? 123000 : -123000,
  balance_before: i === 2 ? 77000 : 200000,
  balance: i === 2 ? 200000 : 77000,
  notes: "Catatan " + "panjang".repeat(35),
  reverses_id: i === 2 ? id(401) : null,
  reversed: i === 1,
  can_edit: !readonly && i !== 1 && i !== 2,
  ...(i !== 2
    ? { slip_id: id(700 + i), fee: 1000, cash_received: 122000 }
    : {}),
}));
const data = savingsSnapshot.parse({
  module: "savings",
  today: "2026-10-22",
  revision: 1,
  canManage: !readonly,
  isAdmin: !readonly,
  people: mode === "empty" ? [] : people,
  classes: [],
  rows: mode === "empty" ? [] : rows,
  total: mode === "empty" ? 0 : rows.length,
  page: 1,
  pageSize: 50,
  summary: {
    balance: 154000,
    periodNet: -123000,
    deposits: 0,
    withdrawals: 123000,
  },
  extra: {
    accounts: mode === "empty" ? [] : accounts,
    brackets: readonly
      ? undefined
      : [
          {
            id: id(600),
            minimum: 0,
            maximum: 200000,
            percent: 1.25,
            active: false,
          },
        ],
    trend: [
      { month: "2026-10", value: -123000 },
      { month: "2026-09", value: 200000 },
    ],
  },
});
Object.assign(window, { savingsFixture: data });
createRoot(document.getElementById("root")!).render(
  <WorkspaceShell
    navigation={navigationFor(["savings.read"], true)}
    name="Petugas uji"
    username="qa-savings"
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
        <h1 className="text-3xl font-semibold">Tabungan</h1>
        <SavingsPanel initial={data} />
      </main>
    )}
  </WorkspaceShell>,
);
