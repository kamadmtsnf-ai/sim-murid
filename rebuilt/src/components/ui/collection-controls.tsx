"use client";
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
}: {
  label: string;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  return (
    <nav aria-label={label} className="ds-pagination ds-actions">
      <Button
        type="button"
        variant="outline"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Sebelumnya
      </Button>
      <p className="text-sm tabular-nums">
        Halaman {page} dari {pageCount}
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Berikutnya
      </Button>
    </nav>
  );
}
