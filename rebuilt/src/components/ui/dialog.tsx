"use client";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
export function Dialog({
  contentId,
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
  className,
  returnFocusRef,
  closeDisabled = false,
  onEscapeKeyDown,
  headerScrollLabel,
}: {
  contentId?: string;
  headerScrollLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  trigger?: ReactNode;
  children: ReactNode;
  className?: string;
  closeDisabled?: boolean;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  return (
    <Primitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && closeDisabled) return;
        onOpenChange(next);
      }}
    >
      {trigger && <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>}
      <Primitive.Portal>
        <Primitive.Overlay className="dialog-overlay fixed inset-0 z-40 bg-foreground/45 backdrop-blur-sm" />
        <Primitive.Content
        {...(contentId ? { id: contentId } : {})}
          onEscapeKeyDown={(event) => {
            onEscapeKeyDown?.(event);
            if (closeDisabled) event.preventDefault();
          }}
          className={cn(
            "dialog-content min-w-0 [overflow-wrap:anywhere] fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-xl",
            className,
          )}
          onPointerDownOutside={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            if (returnFocusRef?.current?.isConnected) {
              event.preventDefault();
              returnFocusRef.current.focus();
            }
          }}
        >
          <div className="dialog-header flex shrink-0 items-start justify-between gap-4 border-b p-5 sm:p-6">
            <div
              className="min-w-0 max-h-[35dvh] overflow-y-auto overscroll-contain"
              {...(headerScrollLabel ? { tabIndex: 0, role: "region", "aria-label": headerScrollLabel } : {})}
            >
              <Primitive.Title className="text-lg font-semibold leading-snug tracking-tight sm:text-xl">
                {title}
              </Primitive.Title>
              <Primitive.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {description}
              </Primitive.Description>
              {closeDisabled && (
                <p className="mt-2 text-xs font-medium text-muted-foreground">
                  Tunggu proses selesai sebelum menutup dialog.
                </p>
              )}
            </div>
            <Primitive.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full border bg-background/70"
                aria-label="Tutup dialog"
                disabled={closeDisabled}
              >
                <X aria-hidden="true" />
              </Button>
            </Primitive.Close>
          </div>
          <div className="dialog-body min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
            {children}
          </div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
