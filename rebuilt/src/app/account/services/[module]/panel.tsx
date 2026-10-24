"use client";
import { FollowUpCenter } from "@/components/dashboard/follow-up-center";
import { ReconciliationPanel } from "./reconciliation-panel";
import { JobsPanel } from "./jobs-panel";
import { type ServiceSnapshot } from "@/lib/services/validation";
import { SurveysPanel } from "./surveys-panel";
import { InsightsWorkspace } from "./insights-workspace";
import { DisciplinePanel } from "./discipline-panel";
import { disciplineSnapshot } from "@/lib/services/discipline";
import { NotificationsPanel } from "./notifications-panel";
type Row = Record<string, unknown>;
export const obj = (v: unknown): Row =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {};
export const list = (v: unknown): Row[] =>
  Array.isArray(v) ? (v as Row[]) : [];
export function ServicesPanel(props: {
  initial: ServiceSnapshot;
  userId: string;
}) {
  if (props.initial.module === "reconciliation")
    return <ReconciliationPanel initial={props.initial} />;
  if (props.initial.module === "jobs")
    return <JobsPanel initial={props.initial} />;
  if (props.initial.module === "insights")
    return <InsightsWorkspace initial={props.initial} />;
  if (props.initial.module === "surveys")
    return (
      <SurveysPanel
        key={props.userId + ":" + props.initial.revision}
        {...props}
      />
    );
  if (props.initial.module === "discipline")
    return (
      <DisciplinePanel
        key={`${props.userId}:${props.initial.revision}:${props.initial.month}`}
        initial={disciplineSnapshot.parse(props.initial)}
        userId={props.userId}
      />
    );
  return props.initial.module === "notifications" ? (
    <FollowUpCenter
      key={`${props.userId}:${props.initial.revision}`}
      userId={props.userId}
      inbox={<NotificationsPanel initial={props.initial} />}
    />
  ) : null;
}
