/** Actual schedule components with synthetic records and intercepted writes only. */
import { createRoot } from "react-dom/client";
import { SchedulePanel } from "../../src/app/account/schedules/schedule-panel";
import Loading from "../../src/app/account/schedules/loading";
import ErrorPage from "../../src/app/account/schedules/error";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import {
  classSnapshot,
  scheduleSnapshot,
} from "../../src/lib/education/validation";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const mode = new URLSearchParams(location.search).get("mode") ?? "normal";
const can = mode !== "readonly";
const many = mode === "large";
const students = Array.from({ length: many ? 80 : 3 }, (_, i) => ({
  id: id(100 + i),
  name:
    i === 0 ? "Siswa " + "NamaPanjangTanpaSpasi".repeat(6) : `Siswa ${i + 1}`,
  enrollment_id: id(200 + i),
  starts_on: "2026-07-01",
  status: i === 2 ? "inactive" : "active",
}));
const classes = classSnapshot.parse({
  revision: 1,
  can_manage: can,
  years: [
    { id: id(10), start_year: 2026, is_active: true },
    { id: id(11), start_year: 2025, is_active: false },
  ],
  classes: [
    {
      id: id(20),
      year_id: id(10),
      name: "VII A",
      level: 7,
      teacher_id: id(30),
      teacher_name: "Guru IPA",
      archived: false,
      can_schedule: can,
      students,
    },
    {
      id: id(21),
      year_id: id(11),
      name: "VII Lama",
      level: 7,
      teacher_id: null,
      teacher_name: null,
      archived: false,
      can_schedule: can,
      students: [],
    },
  ],
  teachers: [],
  students: [],
});
const lesson = {
  id: id(40),
  class_id: id(20),
  year_id: id(10),
  class_name: "VII A",
  subject_id: id(50),
  subject: "IPA",
  teacher_id: id(30),
  teacher_name: "Guru IPA",
  weekday: 1,
  start_minute: 420,
  duration_minutes: 40,
  jtm: 2,
  break_minutes: 15,
  end_minute: 515,
  can_manage: can,
};
const data = scheduleSnapshot.parse({
  revision: 1,
  today: 4,
  lessons:
    mode === "empty"
      ? []
      : Array.from({ length: many ? 75 : 1 }, (_, i) => ({
          ...lesson,
          id: id(40 + i + 1000),
        })),
  duties:
    mode === "empty"
      ? []
      : [
          {
            id: id(60),
            class_id: id(20),
            class_name: "VII A",
            student_id: id(100),
            student_name: students[0]?.name ?? "Siswa",
            weekday: 1,
            can_manage: can,
          },
        ],
  duty_roster: [
    { class_id: id(20), student_id: id(100), weekday: 1 },
    { class_id: id(20), student_id: id(101), weekday: 7 },
    { class_id: id(20), student_id: id(102), weekday: 3 },
  ],
  subjects: [{ id: id(50), name: "IPA", active: mode !== "unavailable" }],
  teachers: mode === "unavailable" ? [] : [{ id: id(30), name: "Guru IPA" }],
});
Object.assign(window, { schedulesFixture: data });
createRoot(document.getElementById("root")!).render(
  <WorkspaceShell
    navigation={navigationFor(["references.read"], true)}
    name="Admin uji"
    username="qa-admin"
  >
    {mode === "loading" ? (
      <Loading />
    ) : mode === "error" ? (
      <ErrorPage error={Error("Synthetic")} reset={() => location.reload()} />
    ) : (
      <main
        id="main-content"
        tabIndex={-1}
        className="schedules-panel space-y-6"
      >
        <h1 className="text-3xl font-semibold">
          Jadwal pelajaran dan piket siswa
        </h1>
        <SchedulePanel
          initial={data}
          classes={classes}
          filters={{ year: id(10), weekday: 1 }}
        />
      </main>
    )}
  </WorkspaceShell>,
);
