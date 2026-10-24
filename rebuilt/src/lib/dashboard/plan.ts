import type { z } from "zod";
import type { accessSchema } from "../auth/access-validation.ts";
import type { OverviewSource } from "./overview.ts";
export type OverviewAccess = z.infer<typeof accessSchema>;
/** Query selection is not authorization: each existing RPC rechecks actor/session and row scope. */
export function overviewPlan(a: OverviewAccess): OverviewSource[] {
  const cap = (c: string) => a.grants.some((g) => g.capability === c),
    task = (c: string) => a.assignments.some((t) => t.code === c),
    admin = a.role === "admin",
    head = task("school_head"),
    academic =
      admin || head || ["teacher", "student", "parent"].includes(a.role);
  const plan: OverviewSource[] = [];
  if (cap("notifications.read")) plan.push("notifications");
  if (academic && cap("references.read")) plan.push("schedule");
  if ((admin || a.role === "teacher") && cap("attendance.read"))
    plan.push("duty");
  if (academic && cap("attendance.read")) plan.push("attendance");
  if ((head || task("student_mentor")) && cap("mentoring.read"))
    plan.push("mentoring");
  if (
    (task("committee_treasurer") || ["student", "parent"].includes(a.role)) &&
    cap("fees.read")
  )
    plan.push("fees");
  if (
    (task("savings_manager") ||
      ["student", "parent", "customer", "alumni"].includes(a.role)) &&
    cap("savings.read")
  )
    plan.push("savings");
  if (admin) plan.push("jobs");
  return plan;
}
