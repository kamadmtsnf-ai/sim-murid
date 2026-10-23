/** Actual UI/shell with synthetic records; session storage models only the test server. */
import { createRoot } from "react-dom/client";
import { ServicesPanel } from "../../src/app/account/services/[module]/panel";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import { surveysSnapshot } from "../../src/lib/services/surveys";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const mode = new URLSearchParams(location.search).get("mode") ?? "normal",
  teacher = mode === "teacher",
  manager = mode === "manager",
  closed = mode === "closed",
  large = mode === "large";
const instrument = Array.from({ length: large ? 25 : 2 }, (_, i) => ({
  code: `Q-${i + 1}`,
  question:
    i === 1
      ? "Berikan saran untuk madrasah."
      : "Bagaimana penilaian Anda terhadap pembelajaran " + (i + 1) + "?",
  kind: i === 1 ? "essay" : "likert",
  required: true,
  section: "A",
  aspect: "A1",
}));
const response = {
  period_id: id(10),
  user_id: id(1),
  role: teacher ? "teacher" : "student",
  revision: 0,
  instrument,
  answers: closed ? { "Q-1": 4, "Q-2": "Saran tersimpan" } : {},
  peer_answers: {},
  peers: teacher ? [id(3)] : [],
  submitted_at: closed ? "2026-10-23T00:00:00Z" : null,
  peer_submitted_at: null,
};
const data = surveysSnapshot.parse(
  JSON.parse(sessionStorage.getItem("survey-fixture-server") ?? "null") ?? {
    module: "surveys",
    revision: 1,
    today: "2026-10-23",
    month: "2026-10-01",
    isAdmin: manager,
    isManager: manager,
    classes: [],
    subjects: [],
    years: [
      { id: id(70), start_year: 2026, is_active: true },
      { id: id(71), start_year: 2025, is_active: false },
    ],
    rows:
      mode === "empty"
        ? []
        : [
            {
              id: id(10),
              title: large
                ? "JudulPeriodeTanpaSpasi".repeat(20)
                : "Evaluasi Madrasah",
              academic_year_id: id(70),
              semester: 1,
              starts_on: "2026-07-01",
              ends_on: "2026-12-31",
              status: closed ? "closed" : "open",
              kind: "main",
              instrument_version: "SURVEI-1.0",
              targets: ["student", "teacher"],
              response: manager || mode === "unstarted" ? null : response,
              plan: closed
                ? [
                    {
                      description: "Perbaikan layanan",
                      owner: "Madrasah",
                      status: "proses",
                    },
                  ]
                : null,
            },
          ],
    extra: {
      required: manager || closed ? [] : [id(10)],
      peers: teacher ? [{ id: id(3), name: "Rekan Guru" }] : [],
      ...(manager ? { respondentRole: "admin" } : {}),
    },
  },
);
Object.assign(window, { surveysFixture: data, surveyResponse: response });
createRoot(document.getElementById("root")!).render(
  <WorkspaceShell
    navigation={navigationFor(["surveys.read"], manager)}
    name="Pengguna uji"
    username="qa-surveys"
  >
    <main id="main-content" className="mx-auto min-w-0 max-w-7xl space-y-6 p-6">
      <h1 className="text-3xl font-semibold">Survei evaluasi</h1>
      <ServicesPanel initial={data} userId={id(1)} />
    </main>
  </WorkspaceShell>,
);
