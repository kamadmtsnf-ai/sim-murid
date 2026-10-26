"use client";
import dynamic from "next/dynamic";
import { PanelLoading } from "@/components/feedback/panel-loading";
import { type LearningSnapshot } from "@/lib/learning/validation";
import { promotionsSnapshot } from "@/lib/learning/promotions";
import { reportsSnapshot } from "@/lib/learning/reports";
import { gradesSnapshot } from "@/lib/learning/grades";
import { booksSnapshot } from "@/lib/learning/books";

const PromotionsPanel = dynamic(() => import("./promotions-panel").then(m => m.PromotionsPanel), { ssr: true, loading: PanelLoading });
const ReportsPanel = dynamic(() => import("./reports-panel").then(m => m.ReportsPanel), { ssr: true, loading: PanelLoading });
const GradesPanel = dynamic(() => import("./grades-panel").then(m => m.GradesPanel), { ssr: true, loading: PanelLoading });
const BooksPanel = dynamic(() => import("./books-panel").then(m => m.BooksPanel), { ssr: true, loading: PanelLoading });

export function LearningPanel({
  initial,
  bulkAvailable = false,
}: {
  initial: LearningSnapshot;
  bulkAvailable?: boolean;
}) {
  if (initial.module === "grades")
    return (
      <GradesPanel
        key={`${initial.revision}:${initial.semester}`}
        bulkAvailable={bulkAvailable}
        initial={gradesSnapshot.parse(initial)}
      />
    );
  if (initial.module === "reports")
    return <ReportsPanel initial={reportsSnapshot.parse(initial)} />;
  if (initial.module === "promotions")
    return <PromotionsPanel initial={promotionsSnapshot.parse(initial)} />;
  return (
    <BooksPanel key={initial.revision} initial={booksSnapshot.parse(initial)} />
  );
}
