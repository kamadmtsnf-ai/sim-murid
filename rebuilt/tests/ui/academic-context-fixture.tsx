import { createRoot } from "react-dom/client";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import { SchedulePanel } from "../../src/app/account/schedules/schedule-panel";
import { scheduleSnapshot } from "../../src/lib/education/validation";
import { ClassPanel } from "../../src/app/account/classes/class-panel";
import { GradesPanel } from "../../src/app/account/learning/[module]/grades-panel";
import { ReportsPanel } from "../../src/app/account/learning/[module]/reports-panel";
import { classSnapshot } from "../../src/lib/education/validation";
import { gradesSnapshot } from "../../src/lib/learning/grades";
import { reportsSnapshot } from "../../src/lib/learning/reports";
const q = new URLSearchParams(location.search),
  id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const classes = [
  {
    id: id(30),
    name: "7 A",
    year: 2026,
    academic_year_id: id(70),
    archived_at: null,
  },
  {
    id: id(31),
    name: "8 B",
    year: 2025,
    academic_year_id: id(71),
    archived_at: null,
  },
].filter((c) => !q.has("revoked") || c.id !== id(30));
const grades = gradesSnapshot.parse({
  module: "grades",
  revision: 1,
  today: q.get("today") ?? "2027-01-01",
  isAdmin: true,
  canWrite: true,
  semester: 2,
  classes,
  people: [],
  rows: [],
  extra: {
    kkm: 75,
    subjects: [{ id: id(60), name: "IPS" }],
    entryPeople: [],
    scope: { semester: 2 },
  },
});
const reports = reportsSnapshot.parse({
  ...grades,
  module: "reports",
  extra: { canPublish: true, scope: { semester: 2 } },
});
const classroom = classSnapshot.parse({
  revision: 1,
  can_manage: true,
  years: [
    { id: id(70), start_year: 2026, is_active: true },
    { id: id(71), start_year: 2025, is_active: false },
  ],
  classes: classes.map((c) => ({
    id: c.id,
    name: c.name,
    year_id: c.academic_year_id,
    archived: false,
    level: 7,
    teacher_id: null,
    teacher_name: null,
    can_schedule: false,
    students: [],
  })),
  teachers: [],
  students: [],
});
const schedules = scheduleSnapshot.parse({
  revision: 1,
  today: 2,
  lessons: [],
  duties: [],
  duty_roster: [],
  subjects: [],
  teachers: [],
});
Object.assign(window, { academicFixture: { grades, reports } });
const pageModule = q.get("module") ?? "classes";
createRoot(document.getElementById("root")!).render(
  <WorkspaceShell
    username={q.get("user") ?? "001-context"}
    name="Pengguna uji"
    academicToday={grades.today}
    navigation={navigationFor([], false)}
  >
    <main id="main-content" className="min-w-0 space-y-6">
      <h1 className="text-2xl font-semibold">
        Konteks akademik — {pageModule}
      </h1>
      {pageModule === "classes" ? (
        <ClassPanel initial={classroom} />
      ) : pageModule === "grades" ? (
        <GradesPanel initial={grades} />
      ) : pageModule === "schedules" ? (
        <SchedulePanel
          initial={schedules}
          classes={classroom}
          filters={{ year: id(70), weekday: 2, personal: true }}
          initialTab="piket"
        />
      ) : pageModule === "reports" ? (
        <ReportsPanel initial={reports} />
      ) : (
        <p>
          Halaman ini memakai tahun kalender. Pilihan akademik tidak menyaring
          data.
        </p>
      )}
    </main>
  </WorkspaceShell>,
);
