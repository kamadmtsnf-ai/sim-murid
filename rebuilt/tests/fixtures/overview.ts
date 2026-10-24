import { projectOverview } from "../../src/lib/dashboard/projections";
import {
  overviewSchema,
  type Overview,
} from "../../src/lib/dashboard/overview";
import {
  overviewPlan,
  type OverviewAccess,
} from "../../src/lib/dashboard/plan";
export const overviewActor = "00000000-0000-4000-8000-000000000001";
export function overviewFixture(
  role: NonNullable<Overview["role"]> = "teacher",
  mode = "normal",
) {
  const id = overviewActor,
    today = "2026-10-24",
    now = new Date("2026-10-24T01:00:00Z"),
    empty = mode === "empty";
  const codes =
    mode === "head"
      ? ["school_head"]
      : mode === "multi"
        ? [
            "student_mentor",
            "committee_treasurer",
            "savings_manager",
            "homeroom_teacher",
            "duty_teacher",
          ]
        : [];
  const access: OverviewAccess = {
    user_id: id,
    role,
    assignments: codes.map((code) => ({ code, class_id: null })),
    grants:
      mode === "no-grants"
        ? []
        : [
            "references.read",
            "notifications.read",
            "attendance.read",
            "mentoring.read",
            "fees.read",
            "savings.read",
          ].map((capability) => ({ capability, scope: "own", class_id: null })),
  };
  const op = (
    module: string,
    extra: Record<string, unknown>,
    summary: Record<string, unknown> = {},
    total = 0,
  ) => ({
    module,
    today,
    revision: 1,
    canManage: role === "admin",
    isAdmin: role === "admin",
    people: [],
    classes: [],
    rows: [],
    total,
    page: 1,
    pageSize: 50,
    summary,
    extra,
  });
  const payload: Record<string, unknown> = {
    notifications: {
      module: "notifications",
      today,
      rows: [],
      extra: { unread: empty ? 0 : 205 },
    },
    schedule: {
      revision: 1,
      today: 6,
      lessons: empty
        ? []
        : Array.from({ length: 7 }, (_, i) => ({
            id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
            class_id: id,
            class_name: mode === "long" ? "KelasTanpaSpasi".repeat(25) : "7A",
            year_id: id,
            subject_id: id,
            subject:
              mode === "long"
                ? "MataPelajaranTanpaSpasi".repeat(20)
                : ["IPS", "Informatika", "Matematika"][i % 3],
            teacher_id: id,
            teacher_name: "PRIVATE TEACHER",
            weekday: 6,
            start_minute: 540 + i * 40,
            end_minute: 580 + i * 40,
            duration_minutes: 40,
            jtm: 1,
            break_minutes: 0,
            can_manage: false,
          })),
      duties: [],
      duty_roster: [],
      subjects: [],
      teachers: [],
    },
    attendance: op(
      "attendance",
      { holidays: mode === "holiday" ? [today] : [], trend: [] },
      {},
      empty ? 0 : 120,
    ),
    duty: op("duty", {
      roster: empty
        ? []
        : [{ teacher_id: id, name: "PRIVATE TEACHER", weekday: 6 }],
      confirmed: false,
    }),
    mentoring: op(
      "mentoring",
      { assignments: [], catalog: [], canAssign: false },
      {},
      empty ? 0 : 12,
    ),
    fees: op("fees", {
      months: empty
        ? []
        : [
            {
              student_id: id,
              name: "PRIVATE STUDENT",
              month: "2026-10-01",
              status: "unpaid",
              amount: 0,
              waiverSources: 0,
              tariff: mode === "unknown-fee" ? null : 50000,
              outstanding: mode === "unknown-fee" ? null : 50000,
            },
          ],
      trend: [],
    }),
    savings: op(
      "savings",
      {
        accounts: empty
          ? []
          : [
              {
                id,
                owner_id: id,
                name: "PRIVATE OWNER",
                category: "S",
                balance: 123000,
              },
            ],
        trend: [],
      },
      {
        balance: empty ? 0 : 123000,
        periodNet: 0,
        deposits: 0,
        withdrawals: 0,
      },
    ),
    jobs: {
      module: "jobs",
      today,
      isAdmin: true,
      rows: empty ? [] : [{ status: "failed" }, { status: "ambiguous" }],
      extra: {},
    },
  };
  const results = overviewPlan(access).map((id) =>
    mode === "partial" && id !== "notifications"
      ? { id, state: "unavailable" as const }
      : { id, data: payload[id] },
  );
  return overviewSchema.parse({
    subject: id,
    today,
    loadedAt: now.toISOString(),
    role: mode === "unavailable" ? null : role,
    assignments: codes,
    contextReady: mode !== "unavailable",
    ...(mode === "unavailable"
      ? {
          metrics: [],
          tasks: [],
          agenda: [],
          agendaCount: 0,
          calendar: "unknown",
        }
      : projectOverview(access, results, now)),
  });
}
