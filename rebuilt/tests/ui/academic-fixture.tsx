/** Actual components with synthetic records; no route, account session or real mutations. */
import { createRoot } from "react-dom/client";
import { LearningPanel } from "../../src/app/account/learning/[module]/panel";
import { SurveyForm } from "../../src/app/account/services/[module]/survey-form";
import { InsightsPanel } from "../../src/app/account/services/[module]/insights";
import { SchedulePanel } from "../../src/app/account/schedules/schedule-panel";
import { learningSnapshot } from "../../src/lib/learning/validation";
import { snapshot } from "../../src/lib/services/validation";
import {
  classSnapshot,
  scheduleSnapshot,
} from "../../src/lib/education/validation";
const view = new URLSearchParams(location.search).get("view") ?? "grades";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const years = [
    { id: id(10), start_year: 2026, is_active: true },
    { id: id(11), start_year: 2025, is_active: false },
  ],
  classes = [
    {
      id: id(20),
      name: "VII A",
      level: 7,
      year: 2026,
      academic_year_id: id(10),
    },
    {
      id: id(21),
      name: "VII Lama",
      level: 7,
      year: 2025,
      academic_year_id: id(11),
    },
  ];
const learning = learningSnapshot.parse({
  module: ["grades", "reports", "promotions"].includes(view) ? view : "grades",
  revision: 1,
  today: "2026-10-22",
  isAdmin: true,
  canWrite: true,
  classes,
  people: [],
  semester: 1,
  rows: [],
  extra: {
    canPublish: true,
    access: { allow_view: false, allow_download: false },
    kkm: null,
    entryPeople: [],
    scope: { semester: 1 },
    years,
    subjects: [{ id: id(30), name: "IPA" }],
  },
});
const service = snapshot.parse({
  module: view === "insights" ? "insights" : "surveys",
  revision: 1,
  today: "2026-10-22",
  isAdmin: true,
  isManager: true,
  month: "2026-10-01",
  years,
  classes: [],
  subjects: [],
  rows: [
    {
      id: id(40),
      title: "Evaluasi Semester",
      academic_year_id: id(10),
      semester: 1,
      starts_on: "2026-07-01",
      ends_on: "2026-12-31",
      status: "open",
      kind: "main",
    },
  ],
  extra: {},
});
const classroom = classSnapshot.parse({
  revision: 1,
  can_manage: false,
  years,
  classes: classes.map((c) => ({
    id: c.id,
    name: c.name,
    year_id: c.academic_year_id,
    level: 7,
    teacher_id: null,
    teacher_name: null,
    archived: false,
    can_schedule: false,
    students: [],
  })),
  teachers: [],
  students: [],
});
const schedule = scheduleSnapshot.parse({
  revision: 1,
  today: 4,
  lessons: [],
  duties: [],
  duty_roster: [],
  subjects: [],
  teachers: [],
});
Object.assign(window, { academicLearning: learning, academicCommands: [] });
const capture = async (command: unknown) => {
  const global = window as unknown as { academicCommands: unknown[] };
  global.academicCommands.push(command);
  return true;
};
createRoot(document.getElementById("root")!).render(
  <main id="main-content" className="mx-auto min-w-0 max-w-6xl p-4">
    <h1 className="mb-6 text-2xl font-semibold">Periode akademik</h1>
    {view === "survey" ? (
      <SurveyForm data={service} userId={id(1)} busy={false} mutate={capture} />
    ) : view === "insights" ? (
      <InsightsPanel
        data={service}
        busy={false}
        mutate={capture}
        load={async () => {}}
      />
    ) : view === "schedule" ? (
      <SchedulePanel
        initial={schedule}
        classes={classroom}
        filters={{ year: id(10) }}
      />
    ) : (
      <LearningPanel initial={learning} />
    )}
  </main>,
);
