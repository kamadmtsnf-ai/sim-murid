import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { FollowUpCenter } from "../../src/components/dashboard/follow-up-center";
import { NotificationsPanel } from "../../src/app/account/services/[module]/notifications-panel";
import { overviewFixture, overviewActor } from "../fixtures/overview";
import { projectFollowUp } from "../../src/lib/dashboard/follow-up";
const q = new URLSearchParams(location.search),
  role = (q.get("role") ?? "admin") as
    | "admin"
    | "teacher"
    | "student"
    | "parent"
    | "customer"
    | "alumni"
    | "applicant",
  mode = q.get("mode") ?? "normal";
const id = "00000000-0000-4000-8000-000000000099";
const plans = {
  module: "surveys",
  revision: 0,
  today: "2026-10-24",
  month: "2026-10-01",
  years: [],
  classes: [],
  subjects: [],
  isAdmin: true,
  isManager: true,
  rows: [
    {
      id,
      title: "Evaluasi sintetis",
      academic_year_id: id,
      semester: 1,
      starts_on: "2026-10-01",
      ends_on: "2026-10-30",
      status: "open",
      kind: "main",
      instrument_version: "qa",
      response: null,
      plan: Array.from({ length: mode === "many" ? 35 : 3 }, (_, i) => ({
        description:
          mode === "long" ? "Deskripsi".repeat(120) : "Tindak lanjut " + i,
        owner: mode === "long" ? "Petugas".repeat(25) : "Petugas QA",
        target: i === 0 ? "2026-10-23" : i === 1 ? "2026-10-24" : "2026-11-01",
        status: i === 2 ? "selesai" : "belum",
      })),
    },
  ],
  extra: { required: [], peers: [] },
};
const source = overviewFixture(
  role,
  mode === "partial" ? "partial" : mode === "empty" ? "empty" : "normal",
);
const initial = projectFollowUp(
  source,
  mode === "unavailable" ? undefined : plans,
);
const inbox = {
  module: "notifications" as const,
  revision: 0,
  today: "2026-10-24",
  month: "2026-10-01",
  years: [],
  classes: [],
  subjects: [],
  isAdmin: false,
  isManager: false,
  rows: [
    {
      id,
      title: "Pesan sintetis",
      message: "Informasi akun",
      created_at: "2026-10-24T01:00:00Z",
      read_at: null,
    },
  ],
  extra: { unread: 1 },
};
function Fixture() {
  const [user, setUser] = useState(overviewActor),
    [show, setShow] = useState(true);
  useEffect(() => {
    Object.assign(window, {
      followUpFixture: initial,
      notificationFixture: inbox,
      changeFollowUpAccount: () => setUser(id),
      unmountFollowUp: () => setShow(false),
    });
  }, []);
  return (
    <main id="main-content" className="mx-auto min-w-0 max-w-5xl space-y-6 p-4">
      <h1 className="text-3xl font-semibold">Notifikasi</h1>
      {show ? (
        <FollowUpCenter
          key={user}
          userId={user}
          inbox={<NotificationsPanel initial={inbox} />}
        />
      ) : null}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
