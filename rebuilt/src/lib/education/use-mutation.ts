"use client";
import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import {
  rejectionPhase,
  savedAcknowledgement,
  type MutationPhase as Phase,
} from "@/lib/forms/mutation-result";
import {
  listenForPendingWrite,
  listenForUnsavedChanges,
} from "@/lib/forms/leave-guard";
/** Confirmed mode prevents blind retries after an indeterminate write. Other domains retain their existing behavior. */
export function useDomainMutation<T>(
  url: string,
  schema: z.ZodType<T>,
  responseKey: string,
  onSaved: (data: T, command: unknown) => void,
  options: { confirmed?: boolean; commandSchema?: z.ZodType } = {},
) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [phase, setPhase] = useState<Phase>("idle");
  const lock = useRef(false),
    mounted = useRef(true),
    feedbackRef = useRef<HTMLDivElement>(null),
    active = useRef<AbortController | null>(null),
    phaseRef = useRef<Phase>("idle");
  useEffect(() => {
    mounted.current = true;
    const stopPending = listenForPendingWrite(() => active.current !== null);
    const stopUnsaved = listenForUnsavedChanges((event) => {
      if (["pending", "uncertain"].includes(phaseRef.current))
        event.preventDefault();
    });
    return () => {
      mounted.current = false;
      active.current?.abort();
      stopPending();
      stopUnsaved();
    };
  }, []);
  useEffect(() => {
    if (message && phase !== "pending") feedbackRef.current?.focus();
  }, [message, phase]);
  function transition(next: Phase, text: string) {
    phaseRef.current = next;
    if (mounted.current) {
      setPhase(next);
      setMessage(text);
    }
  }
  function fail(text: string) {
    if (!lock.current) transition("error", text);
  }
  function clear() {
    if (!lock.current) {
      transition("idle", "");
    }
  }
  async function mutate(revision: number, command: unknown) {
    if (lock.current || !mounted.current) return false;
    if (
      !Number.isSafeInteger(revision) ||
      revision < 0 ||
      (options.commandSchema &&
        !options.commandSchema.safeParse(command).success)
    ) {
      fail("Periksa isian. Pilih siswa, tanggal, dan referensi yang valid.");
      return false;
    }
    lock.current = true;
    setBusy(true);
    transition("pending", "Menyimpan…");
    const controller = new AbortController();
    active.current = controller;
    let retain = false;
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          revision,
          command,
        }),
        signal: controller.signal,
      });
      if (!mounted.current) return false;
      if (options.confirmed && (r.status === 401 || r.status === 403)) {
        retain = true;
        transition(
          "blocked",
          r.status === 401
            ? "Sesi berakhir. Masuk kembali sebelum melanjutkan."
            : "Akses tidak diizinkan. Periksa akun dan data terbaru sebelum melanjutkan.",
        );
        return false;
      }
      const body: unknown = await r.json();
      if (!mounted.current) return false;
      if (typeof body !== "object" || body === null || Array.isArray(body))
        throw Error("Invalid response");
      const data = body as Record<string, unknown>;
      if (r.ok) {
        const parsed = schema.safeParse(data[responseKey]);
        if (
          !parsed.success ||
          (options.confirmed &&
            !savedAcknowledgement(data, parsed.data, revision))
        )
          throw Error("Unconfirmed write");
        onSaved(parsed.data, command);
        transition(
          "success",
          typeof data.message === "string"
            ? data.message
            : "Data berhasil disimpan.",
        );
        return true;
      }
      const next = options.confirmed
        ? rejectionPhase(r.status, data.code)
        : "error";
      if (next === "uncertain") throw Error("Uncertain write");
      retain = next === "blocked";
      transition(
        next,
        typeof data.message === "string"
          ? data.message
          : "Permintaan belum berhasil. Periksa data terbaru sebelum melanjutkan.",
      );
      return false;
    } catch {
      retain = !!options.confirmed;
      transition(
        retain ? "uncertain" : "error",
        "Hasil penyimpanan belum dapat dipastikan. Isian tetap dipertahankan. Periksa data terbaru sebelum mencoba kembali.",
      );
      return false;
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) active.current = null;
      lock.current = retain;
      if (mounted.current) setBusy(false);
    }
  }
  return {
    busy,
    message,
    phase,
    blocked: phase === "blocked" || phase === "uncertain",
    feedbackRef,
    fail,
    clear,
    mutate,
  };
}
