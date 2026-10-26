"use client";
import { paginationView } from "@/lib/collections/presentation";
import type { ReactNode } from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function FilterBar({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("ds-filter-bar", className)}>
      <legend className="sr-only">{label}</legend>
      {children}
    </fieldset>
  );
}

/** One-based page values. Fetching, slicing, counts and focus stay with the caller. */
export function Pagination({
  label,
  page,
  pageCount,
  onPageChange,
  disabled = false,
  previousLabel = "Sebelumnya",
  nextLabel = "Berikutnya",
  summary,
}: {
  label: string;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  previousLabel?: string;
  nextLabel?: string;
  summary?: ReactNode;
}) {
  const view = paginationView(page, pageCount);
  return (
    <nav aria-label={label} className="ds-pagination ds-actions">
      <Button
        type="button"
        variant="outline"
        disabled={disabled || !view.hasPrevious}
        onClick={() => onPageChange(view.previous)}
      >
        {previousLabel}
      </Button>
      <p className="text-sm tabular-nums">
        {summary && <>{summary} · </>}Halaman {view.page} dari {view.pageCount}
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || !view.hasNext}
        onClick={() => onPageChange(view.next)}
      >
        {nextLabel}
      </Button>
    </nav>
  );
}
