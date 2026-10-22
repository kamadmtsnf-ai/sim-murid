"use client";
import { useEffect, useRef, useState } from "react";
type Reply = Record<string, unknown>;
type Phase = "idle" | "pending" | "success" | "uncertain";
/** One in-flight mutation; never automatically replay an uncertain recovery operation. */
export function useRecoverySubmission(endpoint: string) {
  const busy = useRef(false),
    mounted = useRef(true),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("idle"),
    [message, setMessage] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message, phase]);
  function fail(text: string) {
    feedback.current?.focus();
    setMessage(text);
    setPhase("idle");
  }
  function clear() {
    busy.current = false;
    setPhase("idle");
    setMessage("");
  }
  async function run(
    payload: unknown,
    accept: (status: number, data: Reply) => boolean,
    onSuccess: (data: Reply) => void,
  ) {
    if (busy.current) return;
    busy.current = true;
    setPhase("pending");
    setMessage("");
    const controller = new AbortController();
    timer.current = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: controller.signal,
      });
      const body: unknown = await response.json();
      if (!mounted.current) return;
      if (
        typeof body !== "object" ||
        body === null ||
        !("message" in body) ||
        typeof body.message !== "string" ||
        !body.message.trim()
      )
        throw Error("Unconfirmed recovery response");
      const data = body as Reply;
      if (response.ok) {
        if (!accept(response.status, data))
          throw Error("Unconfirmed recovery response");
        setPhase("success");
        setMessage(body.message.slice(0, 1000));
        onSuccess(data);
        busy.current = false;
      } else if (response.status >= 400 && response.status < 500) {
        setMessage(body.message.slice(0, 1000));
        setPhase("idle");
        busy.current = false;
      } else throw Error("Uncertain recovery mutation");
    } catch {
      if (mounted.current) {
        setMessage(
          "Hasil permintaan belum dapat dipastikan. Jangan mengirim ulang secara otomatis. Hubungi petugas madrasah atau periksa dengan login jika sedang mengganti password.",
        );
        setPhase("uncertain");
      }
    } finally {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    }
  }
  return {
    phase,
    message,
    feedback,
    fail,
    clear,
    run,
    pending: phase === "pending",
    locked: phase === "pending" || phase === "uncertain",
  };
}
