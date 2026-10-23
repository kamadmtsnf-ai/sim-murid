import { createRoot } from "react-dom/client";
import { ServicesPanel } from "../../src/app/account/services/[module]/panel";
import type { ServiceSnapshot } from "../../src/lib/services/validation";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const data: ServiceSnapshot = {
  module: "insights",
  revision: 1,
  today: "2027-01-15",
  month: "2027-01-01",
  isAdmin: true,
  isManager: true,
  years: [{ id: id(1), start_year: 2026 }],
  classes: [],
  subjects: [],
  rows: [1, 2].map((n) => ({
    id: id(n + 10),
    title: "Evaluasi Semester " + n,
    academic_year_id: id(1),
    semester: 1,
    kind: "main",
    status: "closed",
    start: "2026-07-01",
    end: "2026-12-31",
  })),
  extra: {
    appliedFilters: {},
    progress: [],
    aggregates: [],
    plan: [],
    analyses: [],
    configs: [],
    canPlan: true,
  },
};
Object.assign(window, { insightsFixture: data });
createRoot(document.getElementById("root")!).render(
  <main
    id="main-content"
    className="mx-auto min-w-0 max-w-7xl space-y-6 p-4 sm:p-6"
  >
    <h1 className="text-3xl font-semibold">Hasil Survei</h1>
    <ServicesPanel initial={data} userId={id(99)} />
  </main>,
);
