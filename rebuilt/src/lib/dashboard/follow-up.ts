import { z } from "zod";
import { overviewSchema, type Overview } from "./overview";
import { surveysSnapshot } from "../services/surveys";
export const followUpItem = z
  .object({
    id: z.string().min(1).max(150),
    source: z.string().max(100),
    module: z.string().max(100),
    title: z.string().max(250),
    detail: z.string().max(2000),
    owner: z.string().max(200),
    target: z.iso.date().nullable(),
    status: z.enum([
      "needs_action",
      "in_progress",
      "done",
      "no_action",
      "unavailable",
    ]),
    urgency: z.enum(["review", "overdue", "today", "info"]),
    required: z.boolean(),
  })
  .strict();
export const followUpSchema = z
  .object({
    subject: z.uuid(),
    today: z.iso.date(),
    loadedAt: z.iso.datetime(),
    contextReady: z.boolean(),
    items: z.array(followUpItem).max(208),
    plans: z.enum(["ready", "unavailable", "not_applicable"]),
    truncated: z.boolean(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      new Set(v.items.map((i) => i.id)).size !== v.items.length ||
      (!v.contextReady && v.items.length)
    )
      c.addIssue({ code: "custom", message: "Tindak lanjut tidak konsisten." });
  });
export type FollowUp = z.infer<typeof followUpSchema>;
export type FollowUpItem = z.infer<typeof followUpItem>;
const planItem = z.object({
  description: z.string().trim().min(3).max(2000),
  owner: z.string().trim().min(1).max(200),
  target: z.iso.date(),
  status: z.enum(["belum", "proses", "selesai"]),
});
/** A read-only projection: status belongs to the domain, not a second task store. */
export function projectFollowUp(raw: Overview, rawPlans?: unknown): FollowUp {
  const overview = overviewSchema.parse(raw);
  const order = { review: 0, overdue: 1, today: 2, info: 3 };
  const compare = (a: FollowUpItem, b: FollowUpItem) =>
    order[a.urgency] - order[b.urgency] ||
    (a.target ?? "9999").localeCompare(b.target ?? "9999") ||
    a.id.localeCompare(b.id);
  const items: FollowUpItem[] = overview.metrics.map((m) => {
    const t = overview.tasks.find((t) => t.id === m.id);
    return {
      id: `daily:${overview.today}:${m.id}`,
      source: m.id,
      module: m.module,
      title: t?.title ?? m.label,
      detail: t?.detail ?? m.detail,
      owner:
        m.id === "jobs" || (m.id === "duty" && overview.role === "admin")
          ? "Admin berwenang"
          : "Anda sesuai cakupan akses",
      target: null,
      status:
        m.state !== "ready" ? "unavailable" : t ? "needs_action" : "no_action",
      urgency: t?.priority ?? "info",
      required: t?.priority === "review" || t?.priority === "today",
    };
  });
  const canPlan =
    overview.contextReady &&
    (overview.role === "admin" || overview.assignments.includes("school_head"));
  let plans: FollowUp["plans"] = canPlan ? "unavailable" : "not_applicable",
    truncated = false;
  if (canPlan) {
    const parsed = surveysSnapshot.safeParse(rawPlans);
    if (
      parsed.success &&
      parsed.data.isManager &&
      parsed.data.today === overview.today &&
      !parsed.data.rows.some(
        (p) => p.response && p.response.user_id !== overview.subject,
      )
    ) {
      const projected: FollowUpItem[] = [];
      let valid = true;
      for (const p of parsed.data.rows) {
        for (const [index, rawItem] of (p.plan ?? []).entries()) {
          const result = planItem.safeParse(rawItem);
          if (!result.success) {
            valid = false;
            break;
          }
          const i = result.data;
          projected.push({
            id: `plan:${p.id}:${index}`,
            source: "plans",
            module: "Hasil survei dan rencana aksi",
            title: i.description.slice(0, 250),
            detail: `${p.title.slice(0, 200)} · Status dan target mengikuti rencana aksi pada modul sumber.`,
            owner: i.owner,
            target: i.target,
            status:
              i.status === "selesai"
                ? "done"
                : i.status === "proses"
                  ? "in_progress"
                  : "needs_action",
            urgency:
              i.status === "selesai"
                ? "info"
                : i.target < overview.today
                  ? "overdue"
                  : i.target === overview.today
                    ? "today"
                    : "info",
            required: i.status !== "selesai",
          });
        }
        if (!valid) break;
      }
      if (valid) {
        plans = "ready";
        truncated = projected.length > 200;
        projected.sort(compare);
        items.push(...projected.slice(0, 200));
      }
    }
  }
  items.sort(compare);
  return followUpSchema.parse({
    subject: overview.subject,
    today: overview.today,
    loadedAt: overview.loadedAt,
    contextReady: overview.contextReady,
    items,
    plans,
    truncated,
  });
}
export const followUpPreferences = z
  .object({ version: z.literal(1), showInformation: z.boolean() })
  .strict();
export function visibleFollowUps(
  items: FollowUpItem[],
  showInformation: boolean,
  module: string,
  status: string,
  query: string,
  urgency: string = "all",
) {
  const search = query.trim().toLocaleLowerCase("id-ID");
  return items.filter(
    (i) =>
      (showInformation || i.required || i.status === "unavailable") &&
      (module === "all" || i.source === module) &&
      (urgency === "all" || i.urgency === urgency) &&
      (status === "all" || i.status === status) &&
      (!search ||
        `${i.title} ${i.detail} ${i.owner}`
          .toLocaleLowerCase("id-ID")
          .includes(search)),
  );
}
