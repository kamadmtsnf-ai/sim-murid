"use client";
import { type LearningSnapshot } from "@/lib/learning/validation";
import { PromotionsPanel } from "./promotions-panel";
import { promotionsSnapshot } from "@/lib/learning/promotions";
import { ReportsPanel } from "./reports-panel";
import { reportsSnapshot } from "@/lib/learning/reports";
import { GradesPanel } from "./grades-panel";
import { gradesSnapshot } from "@/lib/learning/grades";
import { BooksPanel } from "./books-panel";
import { booksSnapshot } from "@/lib/learning/books";
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
