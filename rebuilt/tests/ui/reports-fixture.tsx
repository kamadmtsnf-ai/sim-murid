/** Actual Rapor panel with synthetic scoped records and intercepted HTTP boundaries. */
import { createRoot } from "react-dom/client";
import { ReportsPanel } from "../../src/app/account/learning/[module]/reports-panel";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import { reportsSnapshot } from "../../src/lib/learning/reports";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const mode = new URLSearchParams(location.search).get("mode") ?? "normal";
const rows = Array.from(
  { length: mode === "empty" ? 0 : mode === "large" ? 35 : 4 },
  (_, i) => {
    const draft = {
      student: {
        id: id(100 + i),
        name: i === 3 ? "NamaTanpaSpasi".repeat(25) : "Siswa " + (i + 1),
        username: "siswa-" + (i + 1),
      },
      class: { id: id(30), name: "7A" },
      year: 2026,
      semester: 1,
      draft: true,
      policy: "RAPOR-1.0",
      subjects: [
        {
          subject_id: id(60),
          name: "Ilmu Pengetahuan Sosial " + "panjang".repeat(12),
          ph: 80,
          ats: 70,
          asas: i === 1 ? null : 90,
          practice: 0,
          final: i === 1 ? 37 : 82,
          kkm: 75,
          grade: "C",
          complete: i !== 1,
        },
      ],
      school: { name: "Sekolah", identity: {} },
    };
    return {
      student_id: id(100 + i),
      name: draft.student.name,
      draft: i === 2 ? null : draft,
      published:
        i === 0
          ? {
              id: id(500),
              published_at: "2026-10-23T00:00:00Z",
              snapshot: { ...draft, draft: false },
            }
          : null,
    };
  },
);
const data = reportsSnapshot.parse({
  module: "reports",
  revision: 1,
  today: "2026-10-23",
  isAdmin: mode !== "readonly",
  canWrite: mode !== "readonly",
  semester: 1,
  classes: [
    { id: id(30), name: "7A", year: 2026 },
    { id: id(31), name: "7B", year: 2025 },
  ],
  people: [],
  rows: [],
  extra: { canPublish: mode !== "readonly", scope: { semester: 1 } },
});
Object.assign(window, { reportsFixture: { ...data, rows } });
createRoot(document.getElementById("root")!).render(
  <WorkspaceShell
    navigation={navigationFor(["grades.read"], mode !== "readonly")}
    name="Petugas uji"
    username="qa-reports"
  >
    <main
      id="main-content"
      className="mx-auto min-w-0 max-w-7xl space-y-6 p-4 sm:p-6"
    >
      <h1 className="text-3xl font-semibold">Rapor</h1>
      <ReportsPanel initial={data} />
    </main>
  </WorkspaceShell>,
);
