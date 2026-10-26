"use client";
import dynamic from "next/dynamic";
import { PanelLoading } from "@/components/feedback/panel-loading";
import { type ServiceSnapshot } from "@/lib/services/validation";
import { disciplineSnapshot } from "@/lib/services/discipline";

const FollowUpCenter = dynamic(() => import("@/components/dashboard/follow-up-center").then(m => m.FollowUpCenter), { ssr: true, loading: PanelLoading });
const ReconciliationPanel = dynamic(() => import("./reconciliation-panel").then(m => m.ReconciliationPanel), { ssr: true, loading: PanelLoading });
const JobsPanel = dynamic(() => import("./jobs-panel").then(m => m.JobsPanel), { ssr: true, loading: PanelLoading });
const SurveysPanel = dynamic(() => import("./surveys-panel").then(m => m.SurveysPanel), { ssr: true, loading: PanelLoading });
const InsightsWorkspace = dynamic(() => import("./insights-workspace").then(m => m.InsightsWorkspace), { ssr: true, loading: PanelLoading });
const DisciplinePanel = dynamic(() => import("./discipline-panel").then(m => m.DisciplinePanel), { ssr: true, loading: PanelLoading });
const NotificationsPanel = dynamic(() => import("./notifications-panel").then(m => m.NotificationsPanel), { ssr: true, loading: PanelLoading });

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
