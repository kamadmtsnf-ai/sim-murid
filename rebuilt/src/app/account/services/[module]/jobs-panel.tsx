"use client";
import { Pagination } from "@/components/ui/collection-controls";
import { useWriteGuard } from "@/lib/forms/use-write-guard";
import { listenForUnsavedChanges } from "@/lib/forms/leave-guard";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Status } from "@/components/ui/status";
import { controlClass } from "@/components/domain-controls";
import {
  jobsSnapshot,
  jobsAcknowledgement,
  deliveryResult,
  jobStatusLabel,
  type JobsSnapshot,
} from "@/lib/services/jobs";
import type { ServiceSnapshot } from "@/lib/services/validation";
const dates = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});
const api = "/api/services/jobs";
export function JobsPanel({ initial }: { initial: ServiceSnapshot }) {
  const [data, setData] = useState<JobsSnapshot>(() =>
      jobsSnapshot.parse(initial),
    ),
    [busy, setBusy] = useState(""),
    [locked, setLocked] = useState(false),
    [message, setMessage] = useState(""),
    [tone, setTone] = useState<"info" | "error" | "success">("info"),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [channel, setChannel] = useState("all"),
    [page, setPage] = useState(1);
  const active = useRef(false),
    mounted = useRef(true),
    controller = useRef<AbortController | null>(null),
    feedback = useRef<HTMLDivElement>(null);
  useWriteGuard(
    () => !!active.current,
    () => locked,
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (active.current) e.preventDefault();
    };
    const stopUnloadGuard = listenForUnsavedChanges(warn);
    return () => stopUnloadGuard();
  }, []);
  const disabled = Boolean(busy) || locked;
  function notify(text: string, kind: typeof tone = "error") {
    setTone(kind);
    setMessage(text);
  }
  async function run(
    kind: "refresh" | "preview" | "queue" | "dispatch" | "retry",
    id?: string,
  ) {
    if (active.current || (locked && kind !== "refresh")) return;
    if (
      ["queue", "dispatch", "retry"].includes(kind) &&
      !window.confirm(
        kind === "queue"
          ? "Antrekan pekerjaan yang memenuhi syarat? Ini tidak langsung membuktikan pengiriman."
          : kind === "dispatch"
            ? "Proses satu pengiriman email atau WhatsApp yang siap? Tindakan dapat mengirim pesan ke penerima."
            : `Antre ulang pekerjaan ${id}? Pastikan penyebab kegagalan telah diperiksa.`,
      )
    )
      return;
    active.current = true;
    setBusy(kind);
    setMessage("");
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 55000);
    try {
      const command =
        kind === "retry"
          ? { type: "retry", id }
          : { type: "tick", dryRun: kind === "preview" };
      const response = await fetch(
        kind === "dispatch" ? "/api/services/dispatch" : api,
        {
          method: kind === "refresh" ? "GET" : "POST",
          headers:
            kind === "refresh" ? {} : { "Content-Type": "application/json" },
          cache: "no-store",
          signal: abort.signal,
          ...(kind === "refresh" || kind === "dispatch"
            ? {}
            : {
                body: JSON.stringify({
                  requestId: crypto.randomUUID(),
                  revision: data.revision,
                  command,
                }),
              }),
        },
      );
      const body: unknown = await response.json();
      if (!mounted.current) return;
      if (!response.ok) throw Error("Unconfirmed operation");
      if (kind === "dispatch") {
        const result = deliveryResult.safeParse(body);
        if (!result.success || result.data.code === "unconfirmed")
          throw Error("Unconfirmed dispatch");
        // A provider side effect can be complete even if refreshing the queue fails.
        notify(
          result.data.message,
          result.data.code === "sent"
            ? "success"
            : result.data.code === "empty"
              ? "info"
              : "error",
        );
        const fresh = await fetch(api, {
          cache: "no-store",
          signal: abort.signal,
        });
        const b: unknown = await fresh.json();
        if (!fresh.ok) throw Error("Refresh unavailable");
        const next = jobsSnapshot.parse(
          typeof b === "object" && b !== null && "data" in b ? b.data : null,
        );
        if (mounted.current) setData(next);
        if (mounted.current && result.data.code === "ambiguous") {
          setLocked(true);
          notify(result.data.message + " Muat ulang untuk memeriksa status.");
        }
      } else {
        const record =
          typeof body === "object" && body !== null
            ? (body as Record<string, unknown>)
            : {};
        const next = jobsSnapshot.parse(record.data);
        if (kind !== "refresh") {
          const ack = jobsAcknowledgement.parse(record.result);
          if (
            record.code !== "saved" ||
            ack.code !== "saved" ||
            next.revision !== data.revision + 1
          )
            throw Error("Unconfirmed write");
          if (
            kind === "retry" &&
            (ack.id !== id ||
              !next.rows.some(
                (r) => r.id === id && r.status === "queued" && r.attempts < 5,
              ))
          )
            throw Error("Unconfirmed retry");
          if (
            kind !== "retry" &&
            (ack.dryRun !== (kind === "preview") ||
              ack.reminderCandidates === undefined ||
              !ack.date ||
              ack.hourWib === undefined)
          )
            throw Error("Unconfirmed tick");
          notify(
            kind === "preview"
              ? `Pratinjau ${ack.date}, pukul ${ack.hourWib}.00 WIB: ${ack.reminderCandidates} calon penerima pengingat. Tidak ada pengiriman dilakukan.`
              : kind === "queue"
                ? "Pemeriksaan dan pengantrean pekerjaan selesai. Periksa status antrean; pengiriman diproses terpisah."
                : "Pekerjaan diantre ulang. Jumlah percobaan tetap dipertahankan.",
            kind === "preview" ? "info" : "success",
          );
        } else {
          setLocked(false);
          notify(
            "Antrean diperbarui. Periksa status sebelum menjalankan tindakan berikutnya.",
            "success",
          );
        }
        setData(next);
      }
    } catch {
      if (mounted.current) {
        setLocked(true);
        notify(
          kind === "refresh"
            ? "Antrean belum dapat dimuat. Coba muat ulang; tindakan tetap dikunci."
            : "Hasil tindakan belum dapat dipastikan. Jangan mengulang atau menganggap pesan telah terkirim. Muat ulang antrean untuk memeriksa status sebelum melanjutkan.",
        );
      }
    } finally {
      clearTimeout(timer);
      if (mounted.current) {
        active.current = false;
        setBusy("");
      }
    }
  }
  const term = query.trim().toLocaleLowerCase("id-ID"),
    filtered = data.rows.filter(
      (r) =>
        (status === "all" || r.status === status) &&
        (channel === "all" || r.channel === channel) &&
        (!term ||
          `${r.id} ${r.event_type}`.toLocaleLowerCase("id-ID").includes(term)),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 10)),
    current = Math.min(page, pages),
    visible = filtered.slice((current - 1) * 10, current * 10);
  const waiting = data.rows.filter(
      (r) => r.status === "queued" || r.status === "processing",
    ).length,
    needsReview = data.rows.filter(
      (r) => r.status === "failed" || r.status === "ambiguous",
    ).length;
  return (
    <div className="jobs-panel min-w-0 space-y-6" aria-busy={Boolean(busy)}>
      <p className="text-muted-foreground">
        Pantau antrean pengiriman, periksa pekerjaan otomatis, dan tindak
        lanjuti kegagalan.
      </p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        {[
          ["Dalam antrean/proses", waiting],
          ["Perlu diperiksa", needsReview],
          ["Pengiriman ditampilkan", data.rows.length],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="space-y-1 py-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Kesiapan pengiriman</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              ["Email", data.extra.providers.gmail],
              ["WhatsApp", data.extra.providers.whatsapp],
              [
                "Izin dispatch otomatis",
                data.extra.providers.scheduledDispatch,
              ],
            ].map(([label, ready]) => (
              <div key={String(label)} className="rounded-lg border p-3">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="font-medium">
                  {ready ? "Konfigurasi aktif" : "Belum aktif"}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted-foreground">
            Status konfigurasi bukan bukti koneksi atau penerimaan pesan. Hasil
            ambigu perlu diperiksa dan tidak diulang otomatis. Pengiriman gagal
            mengikuti backoff dengan maksimal lima percobaan.
          </p>
        </CardContent>
      </Card>
      <div
        ref={feedback}
        tabIndex={-1}
        className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {message && <Status tone={tone}>{message}</Status>}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Tindakan pekerjaan</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pratinjau hanya memeriksa kandidat. Antrekan pekerjaan menjalankan
            pemeriksaan terjadwal. Proses satu pengiriman mengambil satu email
            atau WhatsApp yang siap.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => void run("preview")}
            >
              Pratinjau pekerjaan
            </Button>
            <Button disabled={disabled} onClick={() => void run("queue")}>
              Antrekan pekerjaan
            </Button>
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => void run("dispatch")}
            >
              Proses satu pengiriman
            </Button>
            <Button
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => void run("refresh")}
            >
              Muat ulang antrean
            </Button>
          </div>
          {busy && (
            <p role="status">
              {busy === "refresh" ? "Memuat antrean…" : "Memproses tindakan…"}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Antrean pengiriman</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Maksimal 200 pengiriman terbaru; ringkasan dan filter berlaku pada
            data yang ditampilkan.
          </p>
          <div className="grid min-w-0 gap-3 sm:grid-cols-3">
            <label className="block text-sm" htmlFor="jobs-search">
              Cari peristiwa atau ID
              <input
                id="jobs-search"
                type="search"
                maxLength={200}
                className={controlClass}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="block text-sm" htmlFor="jobs-status">
              Status
              <select
                id="jobs-status"
                className={controlClass}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Semua status</option>
                {[
                  "queued",
                  "processing",
                  "sent",
                  "failed",
                  "ambiguous",
                  "cancelled",
                ].map((s) => (
                  <option key={s} value={s}>
                    {jobStatusLabel[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm" htmlFor="jobs-channel">
              Saluran
              <select
                id="jobs-channel"
                className={controlClass}
                value={channel}
                onChange={(e) => {
                  setChannel(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Semua saluran</option>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="internal">Internal</option>
              </select>
            </label>
          </div>
          {!filtered.length ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              {data.rows.length
                ? "Tidak ada pengiriman sesuai filter."
                : "Belum ada pengiriman dalam antrean."}
            </p>
          ) : (
            <>
              <ul className="space-y-3">
                {visible.map((r) => (
                  <li
                    key={r.id}
                    className="min-w-0 space-y-3 rounded-lg border p-4 text-sm"
                  >
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                      <h3 className="min-w-0 flex-1 break-words font-semibold">
                        {r.event_type}
                      </h3>
                      <span className="rounded-full bg-muted px-3 py-1">
                        {jobStatusLabel[r.status]}
                      </span>
                    </div>
                    <p className="break-all text-xs text-muted-foreground">
                      ID: {r.id}
                    </p>
                    <p>
                      {r.channel === "email"
                        ? "Email"
                        : r.channel === "whatsapp"
                          ? "WhatsApp"
                          : "Internal"}{" "}
                      · Percobaan {r.attempts}
                      {r.channel !== "internal" ? " dari 5" : ""}
                    </p>
                    <p className="text-muted-foreground">
                      Dibuat {dates.format(new Date(r.created_at))} WIB
                      <br />
                      Jadwal {dates.format(new Date(r.available_at))} WIB
                    </p>
                    {r.last_error_code && (
                      <p className="break-words text-muted-foreground">
                        Kode pemeriksaan: {r.last_error_code}
                      </p>
                    )}
                    {r.status === "ambiguous" && (
                      <p>
                        Periksa hasil di penyedia sebelum tindakan lanjutan.
                        Antre ulang dinonaktifkan.
                      </p>
                    )}
                    {r.status === "failed" &&
                      (r.attempts >= 5 ? (
                        <p>
                          Batas lima percobaan tercapai. Periksa bersama
                          operator.
                        </p>
                      ) : (
                        r.channel !== "internal" && (
                          <Button
                            variant="outline"
                            disabled={disabled}
                            onClick={() => void run("retry", r.id)}
                          >
                            Antre ulang
                          </Button>
                        )
                      ))}
                  </li>
                ))}
              </ul>
              <Pagination
                label="Halaman antrean pengiriman"
                page={current}
                pageCount={pages}
                onPageChange={setPage}
                summary={`${filtered.length} hasil`}
              />
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Riwayat pekerjaan otomatis</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <details>
            <summary className="min-h-11 cursor-pointer rounded-md py-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring">
              Tampilkan riwayat ({data.extra.jobs.length})
            </summary>
            <p className="my-3 text-sm text-muted-foreground">
              Maksimal 100 catatan terbaru. Riwayat pekerjaan berbeda dari
              status pengiriman.
            </p>
            {!data.extra.jobs.length ? (
              <p className="text-sm text-muted-foreground">
                Belum ada riwayat pekerjaan otomatis.
              </p>
            ) : (
              <ul
                tabIndex={0}
                aria-label="Daftar riwayat pekerjaan otomatis"
                className="max-h-96 space-y-3 overflow-y-auto focus-visible:ring-2 focus-visible:ring-ring"
              >
                {data.extra.jobs.map((j) => (
                  <li
                    key={j.id}
                    className="min-w-0 space-y-1 rounded-md border p-3 text-sm"
                  >
                    <p className="break-words font-medium">
                      {j.job_type} · {jobStatusLabel[j.status]}
                    </p>
                    <p className="break-all text-muted-foreground">
                      {j.job_key}
                    </p>
                    <p>
                      Tanggal kerja {j.business_date} · Percobaan {j.attempts}
                    </p>
                    <p>{dates.format(new Date(j.created_at))} WIB</p>
                  </li>
                ))}
              </ul>
            )}
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
