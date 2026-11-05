"use client";

import { useState, type ReactNode } from "react";
import { collectionRange, paginationView } from "@/lib/collections/presentation";
import { Pagination } from "./collection-controls";

export function PagedCollection<T>({
  items,
  label,
  pageSize = 12,
  children,
}: {
  items: readonly T[];
  label: string;
  pageSize?: number;
  children: (items: readonly T[]) => ReactNode;
}) {
  const [requestedPage, setPage] = useState(1);
  const { page, pageCount } = paginationView(
    requestedPage,
    Math.ceil(items.length / pageSize),
  );
  const range = collectionRange(items.length, page, pageSize);

  return (
    <>
      {children(items.slice((page - 1) * pageSize, page * pageSize))}
      {pageCount > 1 && range && (
        <Pagination
          label={label}
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          summary={`${range.from}–${range.to} dari ${range.total}`}
        />
      )}
    </>
  );
}
