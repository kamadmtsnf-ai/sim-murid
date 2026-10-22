"use client";
import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
type Phase = "idle" | "pending" | "success" | "error" | "blocked" | "uncertain";
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
    feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (message && phase !== "pending") feedbackRef.current?.focus();
  }, [message, phase]);
  function fail(text: string) {
    setMessage(text);
    setPhase("error");
  }
  function clear() {
    if (!lock.current) {
      setMessage("");
      setPhase("idle");
    }
  }
  async function mutate(revision: number, command: unknown) {
    if (lock.current) return false;
    if (
      options.commandSchema &&
      !options.commandSchema.safeParse(command).success
    ) {
      fail("Periksa isian. Pilih siswa, tanggal, dan referensi yang valid.");
      return false;
    }
    lock.current = true;
    setBusy(true);
    setPhase("pending");
    setMessage("Menyimpan…");
    const controller = new AbortController();
    let retain = false;
    const timeout = options.confirmed
      ? setTimeout(() => controller.abort(), 30000)
      : undefined;
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
      const body: unknown = await r.json();
      if (!mounted.current) return false;
      if (typeof body !== "object" || body === null)
        throw Error("Invalid response");
      const data = body as Record<string, unknown>;
      if (r.ok) {
        const parsed = schema.safeParse(data[responseKey]);
        if (!parsed.success) throw Error("Invalid snapshot");
        onSaved(parsed.data, command);
        setPhase("success");
        setMessage(
          typeof data.message === "string"
            ? data.message
            : "Data berhasil disimpan.",
        );
        return true;
      }
      if (options.confirmed && r.status >= 500) throw Error("Uncertain write");
      retain =
        !!options.confirmed &&
        ([401, 403].includes(r.status) ||
          ["stale", "not_found", "request_conflict"].includes(
            String(data.code),
          ));
      setPhase(retain ? "blocked" : "error");
      setMessage(
        typeof data.message === "string"
          ? data.message
          : "Permintaan belum berhasil.",
      );
      return false;
    } catch {
      retain = !!options.confirmed;
      if (mounted.current) {
        setPhase(retain ? "uncertain" : "error");
        setMessage(
          "Hasil penyimpanan belum dapat dipastikan. Muat ulang untuk memeriksa data sebelum mencoba kembali.",
        );
      }
      return false;
    } finally {
      clearTimeout(timeout);
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
