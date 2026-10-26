"use client";
import dynamic from "next/dynamic";
import { PanelLoading } from "@/components/feedback/panel-loading";
import { committeeSnapshot } from "@/lib/operations/committee";
import { mentoringSnapshot } from "@/lib/operations/mentoring";
import { attendanceSnapshot } from "@/lib/operations/attendance";
import { dutySnapshot } from "@/lib/operations/duty";

import { savingsSnapshot } from "@/lib/operations/savings";
import type { OperationsSnapshot } from "@/lib/operations/validation";

const CommitteePanel = dynamic(() => import("./committee-panel").then(m => m.CommitteePanel), { ssr: true, loading: PanelLoading });
const MentoringPanel = dynamic(() => import("./mentoring-panel").then(m => m.MentoringPanel), { ssr: true, loading: PanelLoading });
const AttendancePanel = dynamic(() => import("./attendance-panel").then(m => m.AttendancePanel), { ssr: true, loading: PanelLoading });
const DutyPanel = dynamic(() => import("./duty-panel").then(m => m.DutyPanel), { ssr: true, loading: PanelLoading });
const SavingsPanel = dynamic(() => import("./savings-panel").then(m => m.SavingsPanel), { ssr: true, loading: PanelLoading });

export function OperationsPanel({ initial }: { initial: OperationsSnapshot }) {
  switch (initial.module) {
    case "duty":
      return <DutyPanel initial={dutySnapshot.parse(initial)} />;
    case "attendance":
      return <AttendancePanel initial={attendanceSnapshot.parse(initial)} />;
    case "mentoring":
      return <MentoringPanel initial={mentoringSnapshot.parse(initial)} />;
    case "fees":
      return <CommitteePanel initial={committeeSnapshot.parse(initial)} />;
    case "savings":
      return <SavingsPanel initial={savingsSnapshot.parse(initial)} />;
  }
}
