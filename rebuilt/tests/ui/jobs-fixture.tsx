import { createRoot } from "react-dom/client";
import { JobsPanel } from "../../src/app/account/services/[module]/jobs-panel";
import { jobsSnapshot } from "../../src/lib/services/jobs";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const empty = new URLSearchParams(location.search).has("empty"),
  stamp = "2026-10-23T10:00:00Z";
const data = jobsSnapshot.parse({
  module: "jobs",
  revision: 0,
  today: "2026-10-23",
  month: "2026-10-01",
  isAdmin: true,
  isManager: false,
  years: [],
  classes: [],
  subjects: [],
  rows: empty
    ? []
    : Array.from({ length: 25 }, (_, i) => ({
        id: id(i + 1),
        event_type:
          i === 0 ? "PeristiwaPanjangTanpaSpasi".repeat(8) : "event-" + i,
        channel: i % 2 === 0 ? "email" : "whatsapp",
        status: [
          "failed",
          "ambiguous",
          "sent",
          "queued",
          "processing",
          "cancelled",
        ][i % 6],
        attempts: i === 6 ? 5 : 1,
        created_at: stamp,
        available_at: stamp,
        locked_until: null,
        last_error_code: i === 0 ? "KodePanjangTanpaSpasi".repeat(8) : null,
      })),
  extra: {
    providers: { gmail: false, whatsapp: false, scheduledDispatch: false },
    jobs: empty
      ? []
      : Array.from({ length: 100 }, (_, i) => ({
          id: id(100 + i),
          job_type: "reset",
          job_key: i === 0 ? "JobKeyTanpaSpasi".repeat(8) : "job-" + i,
          business_date: "2026-10-23",
          attempts: 1,
          status: i % 2 ? "succeeded" : "failed",
          created_at: stamp,
          started_at: stamp,
          finished_at: stamp,
        })),
  },
});
Object.assign(window, { jobsFixture: data });
createRoot(document.getElementById("root")!).render(
  <main
    id="main-content"
    className="mx-auto min-w-0 max-w-5xl space-y-6 px-4 py-6 sm:px-6"
  >
    <h1 className="text-3xl font-semibold">Antrean dan pekerjaan</h1>
    <JobsPanel initial={data} />
  </main>,
);
