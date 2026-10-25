"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Status } from "@/components/ui/status";
import { TableRegion } from "@/components/ui/data-table";
import { controlClass } from "@/components/domain-controls";
import {
  domains,
  auditSnapshot,
  auditAction,
  auditValues,
  domainLabels,
  finalizationMatrix,
  type AuditEntry,
  type AuditSnapshot,
} from "@/lib/audit/validation";
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const time = (v: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(v));
type Cursor = AuditSnapshot["next"];
function ScoreChanges({ before, after }: { before: unknown; after: unknown }) {
  const [page, setPage] = useState(0);
  const extract = (v: unknown) => (Array.isArray(v) ? v.map(object) : []);
  const previous = extract(object(before).scores),
    next = extract(object(after).scores),
    ids = [...new Set([...previous, ...next].map((v) => String(v.student_id)))];
  if (!ids.length) return null;
  return (
    <section aria-label="Perubahan nilai siswa" className="space-y-3">
      <h3 className="font-medium">Nilai siswa ({ids.length})</h3>
      <TableRegion label="Perbandingan nilai siswa">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th scope="col" className="p-3">
                ID siswa
              </th>
              <th scope="col" className="p-3">
                Sebelum
              </th>
              <th scope="col" className="p-3">
                Sesudah
              </th>
            </tr>
          </thead>
          <tbody>
            {ids.slice(page * 10, page * 10 + 10).map((id) => {
              const a = previous.find((v) => v.student_id === id),
                b = next.find((v) => v.student_id === id);
              return (
                <tr key={id}>
                  <th
                    scope="row"
                    className="max-w-64 break-all border-t p-3 font-normal"
                  >
                    {id}
                  </th>
                  <td className="border-t p-3">
                    {a ? String(a.value ?? "Belum diisi") : "Tidak tercatat"}
                  </td>
                  <td className="border-t p-3">
                    {b ? String(b.value ?? "Belum diisi") : "Tidak tercatat"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableRegion>
      {ids.length > 10 && (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={!page}
            onClick={() => setPage((p) => p - 1)}
          >
            Nilai sebelumnya
          </Button>
          <span className="self-center text-sm">
            Halaman {page + 1} dari {Math.ceil(ids.length / 10)}
          </span>
          <Button
            variant="outline"
            disabled={(page + 1) * 10 >= ids.length}
            onClick={() => setPage((p) => p + 1)}
          >
            Nilai berikutnya
          </Button>
        </div>
      )}
    </section>
  );
}
export function AuditTrail() {
  const [domain, setDomain] = useState(""),
    [data, setData] = useState<AuditSnapshot | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [cursors, setCursors] = useState<Cursor[]>([null]),
    [detail, setDetail] = useState<AuditEntry | null>(null);
  const active = useRef(false),
    mounted = useRef(true),
    controller = useRef<AbortController | null>(null),
    trigger = useRef<HTMLButtonElement | null>(null),
    feedback = useRef<HTMLDivElement>(null);
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
  async function load(nextCursors: Cursor[] = [null]) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setMessage("");
    setData(null);
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 12000);
    try {
      const cursor = nextCursors.at(-1),
        query = new URLSearchParams();
      if (domain) query.set("domain", domain);
      if (cursor) {
        query.set("before", cursor.at);
        query.set("beforeId", cursor.id);
      }
      const r = await fetch("/api/audit?" + query, {
        cache: "no-store",
        signal: abort.signal,
      });
      if (!r.ok)
        throw Error(
          r.status === 401
            ? "Sesi berakhir. Muat ulang halaman untuk masuk kembali."
            : r.status === 403
              ? "Hak akses riwayat tidak tersedia. Muat ulang halaman."
              : "Riwayat belum dapat dimuat. Coba kembali.",
        );
      const body: unknown = await r.json(),
        parsed = auditSnapshot.safeParse(object(body).data);
      if (!parsed.success || parsed.data.domain !== (domain || null))
        throw Error("Hasil riwayat belum valid. Coba kembali.");
      if (mounted.current) {
        setData(parsed.data);
        setCursors(nextCursors);
      }
    } catch (e) {
      if (mounted.current)
        setMessage(
          e instanceof Error &&
            e.name !== "AbortError" &&
            !(e instanceof TypeError) &&
            !(e instanceof SyntaxError)
            ? e.message
            : "Riwayat belum dapat dimuat. Periksa koneksi dan coba kembali.",
        );
    } finally {
      clearTimeout(timer);
      active.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section
      aria-label="Finalisasi dan jejak perubahan"
      className="min-w-0 space-y-5 rounded-xl border bg-card p-4 sm:p-6"
    >
      <div>
        <h2 className="text-xl font-semibold">
          Finalisasi dan jejak perubahan
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tinjau tindakan yang tercatat beserta pelaku, waktu WIB, dan perubahan
          yang tersedia. Riwayat hanya dapat dibaca oleh Admin.
        </p>
      </div>
      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer rounded text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
          Aturan status dan koreksi data
        </summary>
        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
          {finalizationMatrix.map((v) => (
            <article
              key={v.domain}
              className="min-w-0 rounded-lg bg-muted p-3 text-sm"
            >
              <h3 className="font-semibold">{v.domain}</h3>
              <p className="mt-2 font-medium">{v.states}</p>
              <p className="mt-2">{v.authority}</p>
              <p className="mt-2 text-muted-foreground">{v.correction}</p>
            </article>
          ))}
        </div>
      </details>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
        className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end"
      >
        <label className="min-w-0 flex-1 text-sm font-medium">
          Modul riwayat
          <select
            className={controlClass}
            value={domain}
            disabled={busy}
            onChange={(e) => {
              setDomain(e.target.value);
              setData(null);
              setCursors([null]);
              setMessage("");
            }}
          >
            <option value="">Semua modul</option>
            {domains.options.map((v) => (
              <option key={v} value={v}>
                {domainLabels[v]}
              </option>
            ))}
          </select>
        </label>
        <Button disabled={busy}>
          {busy ? "Memuat riwayat…" : "Muat riwayat"}
        </Button>
      </form>
      <div
        ref={feedback}
        tabIndex={-1}
        className="rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
      >
        {message && <Status tone="error">{message}</Status>}
      </div>
      {busy ? (
        <Status tone="pending">Memuat riwayat…</Status>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">
          Pilih modul, lalu muat riwayat untuk meninjau aktivitas.
        </p>
      ) : (
        <div className="space-y-4">
          {!data.rows.length ? (
            <p className="rounded-lg border border-dashed p-6 text-sm">
              Belum ada aktivitas tercatat untuk pilihan ini.
            </p>
          ) : (
            <ol aria-label="Daftar riwayat" className="space-y-3">
              {data.rows.map((row) => (
                <li key={row.id} className="min-w-0 rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-medium">
                        {auditAction(row.action)}
                      </p>
                      <time
                        dateTime={row.at}
                        className="mt-1 block text-sm text-muted-foreground"
                      >
                        {time(row.at)} WIB
                      </time>
                      <p className="mt-2 break-all text-xs">
                        {row.actorKind === "user"
                          ? `Pelaku: ${row.actorLabel ?? row.actorId}`
                          : row.actorKind === "system"
                            ? "Sistem"
                            : "Migrasi"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      aria-label={
                        "Lihat rincian " +
                        auditAction(row.action) +
                        " " +
                        row.id
                      }
                      onClick={(e) => {
                        trigger.current = e.currentTarget;
                        setDetail(row);
                      }}
                    >
                      Lihat rincian
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <nav
            aria-label="Pagination riwayat"
            className="flex flex-wrap items-center gap-3"
          >
            <Button
              variant="outline"
              disabled={busy || cursors.length <= 1}
              onClick={() => void load(cursors.slice(0, -1))}
            >
              Riwayat sebelumnya
            </Button>
            <span className="text-sm">Halaman {cursors.length}</span>
            <Button
              variant="outline"
              disabled={busy || !data.next}
              onClick={() => void load([...cursors, data.next])}
            >
              Riwayat berikutnya
            </Button>
          </nav>
        </div>
      )}
      <Dialog
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        title="Rincian perubahan"
        description="Riwayat bersifat baca saja. Catatan pribadi dan isian sensitif tidak ditampilkan."
        returnFocusRef={trigger}
      >
        {detail && (
          <div className="min-w-0 space-y-5 text-sm">
            <p className="font-medium">{auditAction(detail.action)}</p>
            <dl className="space-y-3">
              {[
                ["Waktu", time(detail.at) + " WIB"],
                ["Pelaku", detail.actorLabel ?? detail.actorKind],
                ["ID pelaku", detail.actorId ?? detail.actorKind],
                ["ID data", detail.entityId ?? "Tidak tercatat"],
                ["ID permintaan", detail.requestId],
                [
                  "Alasan",
                  object(detail.metadata.command).reasonProvided === true ||
                  detail.metadata.reasonProvided === true
                    ? "Alasan diisi pada transaksi sumber. Teks bebas disunting dari jejak perubahan."
                    : "Tidak tercatat sebagai isian alasan; lihat jenis tindakan.",
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="font-medium">{k}</dt>
                  <dd className="mt-1 break-all text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
            {(
              [
                ["Konteks tindakan", detail.metadata.command],
                ["Sebelum", detail.metadata.before],
                ["Sesudah", detail.metadata.after],
              ] as const
            ).map(([title, value]) => (
              <section key={title} className="space-y-2">
                <h3 className="font-medium">{title}</h3>
                {auditValues(value).length ? (
                  <dl className="grid min-w-0 gap-2 sm:grid-cols-2">
                    {auditValues(value).map((v) => (
                      <div
                        key={v.field}
                        className="min-w-0 rounded bg-muted p-2"
                      >
                        <dt>{v.field}</dt>
                        <dd className="mt-1 break-all font-medium">
                          {v.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-muted-foreground">
                    Rincian terstruktur tidak tersedia pada catatan ini.
                  </p>
                )}
              </section>
            ))}
            <ScoreChanges
              key={detail.id}
              before={detail.metadata.before}
              after={detail.metadata.after}
            />
            <Button variant="outline" onClick={() => setDetail(null)}>
              Tutup rincian
            </Button>
          </div>
        )}
      </Dialog>
    </section>
  );
}
