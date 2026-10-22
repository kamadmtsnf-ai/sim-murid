/** Actual Duty page components with synthetic records, never a production session. */
import { createRoot } from "react-dom/client";
import { DutyPanel } from "../../src/app/account/operations/[module]/duty-panel";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import Loading from "../../src/app/account/loading";
import ErrorPage from "../../src/app/account/error";
import { navigationFor } from "../../src/config/account-navigation";
import { dutySnapshot } from "../../src/lib/operations/duty";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const q = new URLSearchParams(location.search),
  mode = q.get("mode") ?? "normal",
  readonly = mode === "readonly";
const teachers = Array.from({ length: mode === "large" ? 60 : 4 }, (_, i) => ({
  id: id(30 + i),
  username: "guru-" + i,
  full_name:
    i === 0 ? "Guru " + "NamaPanjangTanpaSpasi".repeat(5) : "Guru " + (i + 1),
  role_code: "teacher",
  class_id: null,
  class_name: null,
}));
const rows = Array.from({ length: mode === "large" ? 50 : 4 }, (_, i) => ({
  id: id(100 + i),
  teacher_id: id(30 + (i % 4)),
  name: teachers[i % 4]?.full_name ?? "Guru",
  date: i === 3 ? "2026-10-21" : "2026-10-22",
  kind: i % 2 ? "substitute" : "primary",
  status: i === 2 ? "cancelled" : i % 2 ? "pending" : "confirmed",
  replaces_id: i % 2 ? id(30) : null,
  notes: i % 2 ? (teachers[0]?.full_name ?? "Guru utama") : "",
  can_edit: !readonly,
}));
const data = dutySnapshot.parse({
  module: "duty",
  today: "2026-10-22",
  revision: 1,
  canManage: !readonly,
  isAdmin: !readonly,
  people: mode === "empty" ? [] : teachers,
  classes: [],
  rows: mode === "empty" ? [] : rows,
  total: mode === "empty" ? 0 : mode === "large" ? 120 : rows.length,
  page: 1,
  pageSize: 50,
  summary: {},
  extra: {
    roster:
      mode === "empty"
        ? []
        : teachers.flatMap((p, i) =>
            [1, 4].map((weekday) => ({
              teacher_id: p.id,
              name: p.full_name,
              weekday: weekday + (i % 2),
            })),
          ),
    confirmed: readonly,
  },
});
Object.assign(window, { dutyFixture: data });
createRoot(document.getElementById("root")!).render(
  <WorkspaceShell
    navigation={navigationFor(["references.read"], true)}
    name="Petugas uji"
    username="qa-duty"
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
        <h1 className="text-3xl font-semibold">Guru Piket</h1>
        <DutyPanel
          initial={data}
          initialTab={q.get("view") === "history" ? "history" : "roster"}
          filters={{ year: 2026 }}
        />
      </main>
    )}
  </WorkspaceShell>,
);
