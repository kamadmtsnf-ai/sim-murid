/** Actual discipline UI with synthetic records and intercepted writes. */
import { createRoot } from "react-dom/client";
import { DisciplinePanel } from "../../src/app/account/services/[module]/discipline-panel";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import { disciplineSnapshot } from "../../src/lib/services/discipline";
import Loading from "../../src/app/account/loading";
import ErrorPage from "../../src/app/account/error";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const mode = new URLSearchParams(location.search).get("mode") ?? "normal",
  readonly = mode === "readonly",
  teacher = mode === "teacher";
const catalog = [
  {
    code: "A01",
    category: "Kehadiran",
    description: "Terlambat datang ke sekolah",
    points: -2,
    consequence: "Tindak lanjut wali",
    active: true,
  },
  {
    code: "F01",
    category: "Apresiasi",
    description: "Prestasi siswa",
    points: 5,
    consequence: "",
    active: false,
  },
];
const rows = Array.from({ length: mode === "large" ? 80 : 3 }, (_, i) => ({
  student_id: id(10 + i),
  class_id: id(i === 1 ? 301 : 300),
  name: i === 2 ? "NamaTanpaSpasi".repeat(15) : "Siswa " + (i + 1),
  class_name: i === 1 ? "8A" : "7A",
  archived: i === 1,
  snapshot: {
    student_id: id(10 + i),
    month: "2026-10-01",
    balance: i === 2 ? 0 : 48,
    level: i === 2 ? 5 : 1,
    violations: 1,
    good: 0,
    policy: "SPK-1.0",
    events: [
      {
        id: id(400 + i),
        student_id: id(10 + i),
        event_date: "2026-10-23",
        code: "A01",
        notes: "Catatan " + "tanpaspasi".repeat(35),
        created_by: id(i === 2 ? 2 : 1),
        base_points: -2,
        catalog_snapshot: catalog[0],
        multiplier: i === 2 ? 3 : 1,
        r02: i === 2,
        r03: i === 2,
        before: 50,
        after: i === 2 ? 0 : 48,
        delta: i === 2 ? -50 : -2,
      },
    ],
  },
}));
const data = disciplineSnapshot.parse({
  module: "discipline",
  today: "2026-10-23",
  month: "2026-10-01",
  revision: 1,
  isAdmin: !readonly && !teacher,
  isManager: false,
  rows: mode === "empty" ? [] : rows,
  extra: {
    canRecord: !readonly,
    recordingStudents:
      mode === "empty"
        ? []
        : rows.map(({ student_id, name, class_id, class_name }) => ({
            student_id,
            name,
            class_id,
            class_name,
          })),
    catalog: mode === "empty" ? [] : catalog,
    settings: {
      email_enabled: true,
      whatsapp_enabled: false,
      point_threshold: 3,
      affective_subject_id: id(600),
    },
    ranking: [],
    affective: [],
  },
  years: null,
  classes: [
    { id: id(300), name: "7A" },
    { id: id(301), name: "8A" },
  ],
  subjects:
    mode === "inactive-subject"
      ? []
      : [{ id: id(600), name: "Akhlak dan Budi Pekerti" }],
});
Object.assign(window, { pointsFixture: data });
createRoot(document.getElementById("root")!).render(
  <WorkspaceShell
    navigation={navigationFor(["discipline.read"], true)}
    name="Petugas uji"
    username="qa-points"
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
        <h1 className="text-3xl font-semibold">Poin Siswa</h1>
        <DisciplinePanel initial={data} userId={id(1)} />
      </main>
    )}
  </WorkspaceShell>,
);
