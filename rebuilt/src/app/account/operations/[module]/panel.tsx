"use client";
import { CommitteePanel } from "./committee-panel";
import { committeeSnapshot } from "@/lib/operations/committee";
import { MentoringPanel } from "./mentoring-panel";
import { mentoringSnapshot } from "@/lib/operations/mentoring";
import { AttendancePanel } from "./attendance-panel";
import { attendanceSnapshot } from "@/lib/operations/attendance";
import { DutyPanel } from "./duty-panel";
import { dutySnapshot } from "@/lib/operations/duty";

import { SavingsPanel } from "./savings-panel";
import { savingsSnapshot } from "@/lib/operations/savings";
import type { OperationsSnapshot } from "@/lib/operations/validation";
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
