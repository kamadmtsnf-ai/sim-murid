/** Actual attendance components; synthetic data, never a production identity. */
import { createRoot } from "react-dom/client";
import { AttendancePanel } from "../../src/app/account/operations/[module]/attendance-panel";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import { attendanceSnapshot } from "../../src/lib/operations/attendance";
import Loading from "../../src/app/account/loading";
import ErrorPage from "../../src/app/account/error";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const q = new URLSearchParams(location.search),
  mode = q.get("mode") ?? "normal",
  readonly = mode === "readonly";
const people = Array.from({ length: mode === "large" ? 80 : 3 }, (_, i) => ({
  id: id(10 + i),
  username: "siswa-" + i,
  full_name: i === 2 ? "NamaPanjangTanpaSpasi".repeat(8) : "Siswa " + (i + 1),
  role_code: "student",
  class_id: id(i === 1 ? 21 : 20),
  class_name: i === 1 ? "7B" : "7A",
}));
const rows = Array.from({ length: mode === "large" ? 50 : 2 }, (_, i) => ({
  id: id(100 + i),
  student_id: people[i % people.length]!.id,
  class_id: id(20),
  name: people[i % people.length]!.full_name,
  class_name: "7A",
  date: "2026-10-" + String(1 + Math.floor(i / people.length)).padStart(2, "0"),
  status: i % 2 ? "Izin" : "Hadir",
  notes: "Catatan " + "panjang".repeat(20),
  can_edit: !readonly,
}));
const data = attendanceSnapshot.parse({
  module: "attendance",
  today: "2026-10-22",
  revision: 1,
  canManage: !readonly,
  isAdmin: !readonly,
  people: mode === "empty" ? [] : people,
  classes: [
    { id: id(20), name: "7A", level: 7, academic_year_id: id(30) },
    { id: id(21), name: "7B", level: 7, academic_year_id: id(30) },
  ],
  rows: mode === "empty" ? [] : rows,
  total: mode === "empty" ? 0 : mode === "large" ? 120 : 2,
  page: 1,
  pageSize: 50,
  summary: {
    recorded: 2,
    present: 1,
    sick: 0,
    excused: 1,
    absent: 0,
    recordedPercent: 50,
    effectivePercent: 5,
    effectiveDays: 20,
    effectiveStudentDays: 20,
    studentCount: 3,
  },
  extra: { holidays: ["2026-10-05"], trend: [{ month: "2026-10", value: 1 }] },
});
Object.assign(window, { attendanceFixture: data });
createRoot(document.getElementById("root")!).render(
  <WorkspaceShell
    navigation={navigationFor(["attendance.read"], true)}
    name="Petugas uji"
    username="qa-attendance"
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
        <h1 className="text-3xl font-semibold">Absensi siswa</h1>
        <AttendancePanel initial={data} />
      </main>
    )}
  </WorkspaceShell>,
);
