/** Real grades panel, synthetic scoped records and intercepted requests. */
import { createRoot } from "react-dom/client";
import { GradesPanel } from "../../src/app/account/learning/[module]/grades-panel";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import { gradesSnapshot } from "../../src/lib/learning/grades";
import Loading from "../../src/app/account/loading";
import ErrorPage from "../../src/app/account/error";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const mode = new URLSearchParams(location.search).get("mode") ?? "normal",
  readonly = mode === "readonly";
const people = Array.from({ length: mode === "large" ? 60 : 3 }, (_, i) => ({
  id: id(10 + i),
  username: "siswa-" + i,
  full_name: i === 2 ? "NamaTanpaSpasi".repeat(12) : "Siswa " + (i + 1),
  role_code: "student",
  class_id: id(30),
}));
people.push({
  id: id(91),
  username: "historic",
  full_name: "Siswa historis",
  role_code: "alumni",
  class_id: id(31),
});
const scores = people
  .filter((p) => p.class_id === id(30))
  .map((p, i) => ({
    student_id: p.id,
    name: p.full_name,
    value: i === 0 ? 0 : i === 1 ? null : 82,
    notes: "Catatan " + "panjang".repeat(20),
  }));
const rows = Array.from({ length: mode === "large" ? 30 : 4 }, (_, i) => ({
  id: id(400 + i),
  class_id: id(i === 3 ? 31 : 30),
  subject_id: id(i === 3 ? 61 : 60),
  academic_year_id: id(i === 3 ? 71 : 70),
  semester: 1,
  kind: i === 1 ? "ATS" : i === 2 ? "Praktik" : "PH",
  ph_number: i === 1 || i === 2 ? null : i + 1,
  teacher_id: id(1),
  assessment_date: i === 3 ? "2025-10-23" : "2026-10-23",
  kkm_snapshot: 75,
  kkm_fallback: true,
  subject_name: i === 3 ? "Matematika" : "IPS",
  can_edit: !readonly,
  scores:
    i === 3
      ? [
          {
            student_id: id(91),
            name: "Siswa historis",
            value: 56,
            notes: "Catatan asal",
          },
          {
            student_id: id(99),
            name: "Siswa di luar katalog",
            value: 0,
            notes: "Pertahankan",
          },
        ]
      : scores.map((s) => ({
          ...s,
          value: i === 1 ? (s.value === null ? null : 70) : s.value,
        })),
}));
const data = gradesSnapshot.parse({
  module: "grades",
  today: "2026-10-23",
  revision: 1,
  isAdmin: !readonly,
  canWrite: !readonly,
  semester: 1,
  classes: [
    {
      id: id(30),
      name: "7A",
      year: 2026,
      academic_year_id: id(70),
      archived_at: null,
    },
    {
      id: id(31),
      name: "8A",
      year: 2025,
      academic_year_id: id(71),
      archived_at: null,
    },
  ],
  people: mode === "empty" ? [] : people,
  rows: mode === "empty" ? [] : rows,
  extra: {
    kkm: 0,
    subjects: [
      { id: id(60), name: "IPS" },
      { id: id(61), name: "Matematika" },
    ],
    entryPeople: mode === "empty" ? [] : people,
    scope: { semester: 1 },
  },
});
Object.assign(window, { gradesFixture: data });
createRoot(document.getElementById("root")!).render(
  <WorkspaceShell
    navigation={navigationFor(["grades.read"], true)}
    name="Petugas uji"
    username="qa-grades"
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
        <h1 className="text-3xl font-semibold">Penilaian dan KKM</h1>
        <GradesPanel initial={data} />
      </main>
    )}
  </WorkspaceShell>,
);
