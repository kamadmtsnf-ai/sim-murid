"use client";
import { Pagination } from "@/components/ui/collection-controls";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Status } from "@/components/ui/status";
import { controlClass } from "@/components/domain-controls";
import {
  commands,
  notificationSnapshot,
  type ServiceSnapshot,
} from "@/lib/services/validation";

const formatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});
const pageSize = 20;
const api = "/api/services/notifications";
function timestamp(value: string | null) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? formatter.format(date) + " WIB"
    : null;
}
type Feedback = { tone: "success" | "error"; message: string };

export function NotificationsPanel({ initial }: { initial: ServiceSnapshot }) {
  const [data, setData] = useState(() => notificationSnapshot.parse(initial));
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(1);
  const [pending, setPending] = useState<"refresh" | "read" | null>(null),
    [needsRefresh, setNeedsRefresh] = useState(false),
    [feedback, setFeedback] = useState<Feedback | null>(null);
  const request = useRef<AbortController | null>(null),
    results = useRef<HTMLHeadingElement>(null);
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );
  const search = query.trim().toLocaleLowerCase("id-ID");
  const filtered = data.rows.filter(
    (row) =>
      (filter === "all" ||
        (filter === "read" ? !!row.read_at : !row.read_at)) &&
      (!search ||
        `${row.title ?? ""} ${row.message ?? ""}`
          .toLocaleLowerCase("id-ID")
          .includes(search)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    current = Math.min(page, pages),
    offset = (current - 1) * pageSize;
  const rows = filtered.slice(offset, offset + pageSize),
    busy = pending !== null;
  async function synchronize(id?: string | null) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const writing = id !== undefined;
    let committed = false;
    setPending(writing ? "read" : "refresh");
    setFeedback(null);
    try {
      if (writing) {
        const command = commands.notifications.parse({ type: "read", id });
        const response = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            revision: data.revision,
            command,
          }),
          signal: controller.signal,
        });
        const body = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok || body?.result?.code !== "saved") {
          setNeedsRefresh(true);
          setFeedback({
            tone: "error",
            message:
              response.status === 401
                ? "Sesi Anda berakhir. Masuk kembali untuk melanjutkan."
                : response.status === 403
                  ? "Akses notifikasi tidak diizinkan. Muat ulang daftar untuk memeriksa akses."
                  : response.status === 409
                    ? "Data telah berubah. Muat ulang daftar sebelum mencoba lagi."
                    : "Perubahan belum dapat dipastikan. Muat ulang daftar sebelum mencoba lagi.",
          });
          return;
        }
        committed = true;
      }
      const response = await fetch(api, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Notification refresh failed");
      const body = await response.json(),
        fresh = notificationSnapshot.parse(body.data);
      if (controller.signal.aborted) return;
      setData(fresh);
      setNeedsRefresh(false);
      setFeedback({
        tone: "success",
        message: writing
          ? id === null
            ? "Semua notifikasi ditandai dibaca."
            : "Notifikasi ditandai dibaca."
          : "Daftar notifikasi diperbarui.",
      });
      if (writing) results.current?.focus();
    } catch {
      if (controller.signal.aborted) return;
      if (writing) setNeedsRefresh(true);
      setFeedback({
        tone: "error",
        message: committed
          ? "Perubahan tersimpan, tetapi daftar belum berhasil diperbarui. Muat ulang daftar sebelum menandai lagi."
          : writing
            ? "Hasil perubahan belum dapat dipastikan. Muat ulang daftar sebelum mencoba lagi."
            : "Daftar notifikasi belum dapat dimuat. Data terakhir tetap ditampilkan; coba muat ulang daftar.",
      });
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setPending(null);
    }
  }
  return (
    <div className="notifications-panel space-y-6">
      <section
        aria-labelledby="inbox-summary-title"
        className="notification-summary"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="summary-icon shrink-0">
            <Bell aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="inbox-summary-title" className="text-lg font-semibold">
              Kotak masuk Anda
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Informasi dan pemberitahuan untuk akun Anda.
            </p>
            <p className="mt-3 font-medium">
              Belum dibaca:{" "}
              <span className="font-semibold text-primary tabular-nums">
                {data.extra.unread.toLocaleString("id-ID")}
              </span>
            </p>
          </div>
        </div>
        <div className="notification-actions">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void synchronize()}
          >
            <RefreshCw aria-hidden="true" />
            Muat ulang daftar
          </Button>
          <Button
            type="button"
            disabled={busy || needsRefresh || data.extra.unread === 0}
            onClick={() => void synchronize(null)}
          >
            <CheckCheck aria-hidden="true" />
            Tandai semua dibaca
          </Button>
        </div>
      </section>
      {pending ? (
        <p role="status" className="text-sm text-muted-foreground">
          {pending === "read"
            ? "Menyimpan status dan memperbarui daftar…"
            : "Memuat notifikasi…"}
        </p>
      ) : null}
      {feedback ? (
        <Status tone={feedback.tone}>{feedback.message}</Status>
      ) : null}
      <div className="notification-filters">
        <label className="min-w-0">
          <span className="mb-2 block text-sm font-medium">
            Cari notifikasi
          </span>
          <span className="relative block">
            <Search
              className="pointer-events-none absolute top-[1.125rem] left-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              maxLength={200}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Cari judul atau isi pesan"
              aria-describedby="notification-search-help"
              className={`${controlClass} pl-10`}
            />
          </span>
        </label>
        <label className="min-w-0">
          <span className="mb-2 block text-sm font-medium">
            Status notifikasi
          </span>
          <select
            className={controlClass}
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Semua status</option>
            <option value="unread">Belum dibaca</option>
            <option value="read">Sudah dibaca</option>
          </select>
        </label>
        <p
          id="notification-search-help"
          className="notification-search-help text-sm text-muted-foreground"
        >
          Pencarian dan filter berlaku pada daftar yang dimuat.
          {data.rows.length >= 200 ||
          data.extra.unread > data.rows.filter((row) => !row.read_at).length
            ? " Daftar memuat hingga 200 notifikasi terbaru; jumlah belum dibaca dan tindakan tandai semua mencakup seluruh kotak masuk."
            : ""}
        </p>
      </div>
      <section
        aria-labelledby="notification-results-title"
        aria-busy={busy}
        className="space-y-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="notification-results-title"
            ref={results}
            tabIndex={-1}
            className="rounded text-lg font-semibold"
          >
            Daftar notifikasi
          </h2>
          <p
            role="status"
            aria-atomic="true"
            className="text-sm text-muted-foreground"
          >
            {filtered.length
              ? `${offset + 1}–${Math.min(offset + pageSize, filtered.length)} dari ${filtered.length} notifikasi`
              : "0 notifikasi"}
          </p>
        </div>
        {rows.length ? (
          <ul className="space-y-3">
            {rows.map((row) => {
              const time = timestamp(row.created_at);
              return (
                <li key={row.id}>
                  <article
                    className={`notification-card ${row.read_at ? "" : "notification-unread"}`}
                  >
                    <div className="notification-card-heading">
                      <h3 className="min-w-0 flex-1 font-semibold">
                        {row.title?.trim() || "Pemberitahuan"}
                      </h3>
                      <span
                        className={`notification-badge ${row.read_at ? "" : "notification-badge-unread"}`}
                      >
                        {row.read_at ? "Sudah dibaca" : "Belum dibaca"}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm">
                      {row.message || "Tidak ada keterangan tambahan."}
                    </p>
                    <div className="notification-card-footer">
                      <p className="text-xs text-muted-foreground">
                        {time ? (
                          <time dateTime={row.created_at!}>{time}</time>
                        ) : (
                          "Waktu tidak tersedia"
                        )}
                      </p>
                      {!row.read_at ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy || needsRefresh}
                          aria-label={`Tandai dibaca: ${row.title?.trim() || "Pemberitahuan"}`}
                          onClick={() => void synchronize(row.id)}
                        >
                          Tandai dibaca
                        </Button>
                      ) : null}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty-state">
            <Bell
              className="mx-auto mb-3 size-7 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="font-medium">
              {data.rows.length
                ? "Tidak ada notifikasi yang cocok."
                : "Belum ada notifikasi."}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.rows.length
                ? "Ubah kata pencarian atau status untuk melihat pesan lainnya."
                : "Pemberitahuan baru akan tampil di sini."}
            </p>
            {query || filter !== "all" ? (
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                  setPage(1);
                }}
              >
                Reset pencarian dan filter
              </Button>
            ) : null}
          </div>
        )}
        {pages > 1 ? (
          <Pagination
            label="Halaman notifikasi"
            page={current}
            pageCount={pages}
            onPageChange={(page) => {
              setPage(page);
              results.current?.focus();
            }}
          />
        ) : null}
      </section>
    </div>
  );
}
