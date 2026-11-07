import type { ReactNode } from "react";
import { Inbox, LoaderCircle, SearchX, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function EmptyState({
  title,
  children,
  kind = "empty",
}: {
  title: string;
  children: ReactNode;
  kind?: "empty" | "search";
}) {
  const Icon = kind === "search" ? SearchX : Inbox;
  return (
    <div className="card ds-empty-state">
      <div className="mx-auto mb-3 grid size-[44px] place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-[20px]" aria-hidden="true" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <div className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

export function LoadingState({
  children,
  className,
  skeleton = true,
}: {
  children: ReactNode;
  className?: string;
  skeleton?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-4">
      <p role="status" className="alert alert-soft alert-info flex items-start gap-[12px] rounded-xl border bg-card p-[16px] text-sm text-muted-foreground">
        <LoaderCircle className="mt-0.5 size-[16px] shrink-0 motion-safe:animate-spin" aria-hidden="true" />
        <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
      </p>
      {skeleton && <div aria-hidden="true" className={cn("skeleton h-64 w-full", className)} />}
    </div>
  );
}

export function PermissionDenied({ title, children }: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-xl px-4 py-10">
      <div className="space-y-4 rounded-xl border bg-card p-[20px] [overflow-wrap:anywhere] sm:p-[24px]">
        <ShieldAlert className="size-[24px] text-warning" aria-hidden="true" />
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{children}</p>
        <Button asChild variant="outline" className="max-w-full whitespace-normal"><a href="/account">Kembali ke Dasbor</a></Button>
      </div>
    </main>
  );
}
