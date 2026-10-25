"use client";
import { confirmAction } from "@/components/ui/confirm-action";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
  type FormEvent,
} from "react";
import {
  pageHasPendingWrite,
  pageHasUnsavedChanges,
} from "@/lib/forms/leave-guard";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Status } from "@/components/ui/status";
export function FormNavigationGuard({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const approvedAnchor = useRef<HTMLAnchorElement | null>(null),
    approvedSubmit = useRef<HTMLFormElement | null>(null),
    confirmingLogout = useRef(false);
  const notice = useRef<HTMLDivElement>(null),
    approvedNative = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (message) notice.current?.focus();
  }, [message]);
  useEffect(() => {
    const native = (event: BeforeUnloadEvent) => {
      if (approvedNative.current && event.isTrusted)
        event.stopImmediatePropagation();
    };
    window.addEventListener("beforeunload", native, true);
    return () => {
      window.removeEventListener("beforeunload", native, true);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  async function allow() {
    if (pageHasPendingWrite()) {
      setMessage(
        "Tunggu proses pada halaman ini selesai sebelum berpindah. Setelah itu, pilih kembali tujuan Anda.",
      );
      return false;
    }
    if (
      pageHasUnsavedChanges() &&
      !(await confirmAction(
        "Ada isian yang belum disimpan atau hasil penyimpanan yang perlu diperiksa. Tinggalkan halaman? Isian halaman ini dapat hilang.",
      ))
    )
      return false;
    setMessage("");
    return true;
  }
  function approveNative() {
    approvedNative.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      approvedNative.current = false;
    }, 1000);
  }
  async function click(event: MouseEvent<HTMLDivElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor =
      event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (
      !(anchor instanceof HTMLAnchorElement) ||
      anchor.hasAttribute("download") ||
      (anchor.target && anchor.target !== "_self")
    )
      return;
    if (approvedAnchor.current === anchor) {
      approvedAnchor.current = null;
      return;
    }
    const next = new URL(anchor.href, location.href);
    if (
      next.origin !== location.origin ||
      !(
        next.pathname === "/account" || next.pathname.startsWith("/account/")
      ) ||
      (next.pathname === location.pathname && next.search === location.search)
    )
      return;
    if (!pageHasPendingWrite() && !pageHasUnsavedChanges()) return;
    event.preventDefault();
    event.stopPropagation();
    if (
      (await allow()) &&
      !pageHasPendingWrite() &&
      anchor.isConnected &&
      anchor.href === next.href
    ) {
      approvedAnchor.current = anchor;
      approveNative();
      anchor.click();
    }
  }
  async function submit(event: FormEvent<HTMLDivElement>) {
    if (approvedSubmit.current === event.target) {
      approvedSubmit.current = null;
      approveNative();
      return;
    }
    if (
      event.defaultPrevented ||
      !(event.target instanceof HTMLFormElement) ||
      new URL(event.target.action, location.href).pathname !==
        "/api/auth/logout"
    )
      return;
    const form = event.target;
    event.preventDefault();
    event.stopPropagation();
    if (confirmingLogout.current) return;
    confirmingLogout.current = true;
    try {
      if (pageHasPendingWrite()) {
        await allow();
        return;
      }
      setMessage("");
      const confirmed = await confirmAction(
        pageHasUnsavedChanges()
          ? "Ada isian yang belum disimpan atau hasil penyimpanan yang perlu diperiksa. Jika keluar, isian pada halaman ini dapat hilang. Anda yakin ingin keluar dari aplikasi?"
          : "Anda akan keluar dari akun ini. Untuk menggunakan aplikasi kembali, silakan masuk dengan akun Anda.",
        {
          title: "Keluar dari aplikasi?",
          confirmLabel: "Ya, keluar",
          cancelLabel: "Tetap di aplikasi",
          tone: "danger",
        },
      );
      if (!confirmed || !form.isConnected) return;
      if (pageHasPendingWrite()) {
        await allow();
        return;
      }
      setMessage("");
      approvedSubmit.current = form;
      form.requestSubmit();
    } finally {
      confirmingLogout.current = false;
    }
  }
  return (
    <div className="contents" onClickCapture={click} onSubmitCapture={submit}>
      {message && (
        <div className="form-navigation-notice">
          <Status
            ref={notice}
            tabIndex={-1}
            tone="warning"
            className="relative pr-14"
          >
            {message}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1"
              aria-label="Tutup pemberitahuan"
              onClick={() => setMessage("")}
            >
              <X aria-hidden="true" />
            </Button>
          </Status>
        </div>
      )}
      {children}
    </div>
  );
}
