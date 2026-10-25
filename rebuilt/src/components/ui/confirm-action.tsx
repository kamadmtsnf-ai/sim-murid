"use client";
import { createRoot } from "react-dom/client";
import { AlertDialog } from "radix-ui";
import { CircleAlert, Info } from "lucide-react";
import { Button } from "./button";
let active = false;
let cancelActive: (() => void) | null = null;
export function cancelActiveConfirmation() {
  cancelActive?.();
}
/** Resolve an explicit decision once; never queue or replay mutations. */
export type ConfirmationOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};
export function confirmAction(
  message: string,
  options: ConfirmationOptions = {},
): Promise<boolean> {
  if (typeof document === "undefined" || active) return Promise.resolve(false);
  active = true;
  const previous =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const Icon = options.tone === "danger" ? CircleAlert : Info;
  return new Promise((resolve) => {
    let settled = false;
    const cancel = () => finish(false);
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // This confirmation may sit above a drawer/dialog in another React root.
      // Consume Escape here so it cannot dismiss the underlying surface.
      event.preventDefault();
      event.stopImmediatePropagation();
      finish(false);
    };
    function finish(value: boolean) {
      if (settled) return;
      settled = true;
      cancelActive = null;
      window.removeEventListener("popstate", cancel);
      window.removeEventListener("pagehide", cancel);
      window.removeEventListener("keydown", escape, true);
      root.render(null);
      setTimeout(() => {
        root.unmount();
        host.remove();
        active = false;
        if (previous?.isConnected) previous.focus();
        resolve(value);
      }, 0);
    }
    cancelActive = cancel;
    window.addEventListener("popstate", cancel);
    window.addEventListener("pagehide", cancel);
    window.addEventListener("keydown", escape, true);
    root.render(
      <AlertDialog.Root
        open
        onOpenChange={(open) => {
          if (!open) finish(false);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="dialog-overlay fixed inset-0 z-[100] bg-foreground/45 backdrop-blur-sm" />
          <AlertDialog.Content
            className="fixed left-1/2 top-1/2 z-[101] max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card p-[clamp(16px,4vw,24px)] text-card-foreground shadow-2xl [overflow-wrap:anywhere]"
            onCloseAutoFocus={(event) => event.preventDefault()}
            onEscapeKeyDown={() => finish(false)}
          >
            <div
              className={
                "mb-4 inline-flex size-12 items-center justify-center rounded-xl border " +
                (options.tone === "danger"
                  ? "bg-danger-subtle text-destructive"
                  : "bg-secondary text-primary")
              }
            >
              <Icon aria-hidden="true" className="size-6" />
            </div>
            <AlertDialog.Title className="text-xl font-semibold leading-snug tracking-tight">
              {options.title ?? "Konfirmasi tindakan"}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">
              {message}
            </AlertDialog.Description>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <AlertDialog.Cancel asChild>
                <Button
                  type="button"
                  className="min-w-0 max-w-full whitespace-normal"
                  variant="outline"
                  data-confirm-action="cancel"
                  onClick={() => finish(false)}
                >
                  {options.cancelLabel ?? "Batal"}
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  type="button"
                  className="min-w-0 max-w-full whitespace-normal"
                  variant={
                    options.tone === "danger" ? "destructive" : "default"
                  }
                  data-confirm-action="accept"
                  onClick={() => finish(true)}
                >
                  {options.confirmLabel ?? "Lanjutkan"}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>,
    );
  });
}
