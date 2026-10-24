import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="ds-empty-state">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-2 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

export function LoadingState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="min-w-0 space-y-4">
      <p role="status" className="text-sm text-muted-foreground">
        {children}
      </p>
      <div
        aria-hidden="true"
        className={cn("skeleton h-64 w-full", className)}
      />
    </div>
  );
}
