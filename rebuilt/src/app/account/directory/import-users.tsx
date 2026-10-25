"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Status } from "@/components/ui/status";
import { TableRegion } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/collection-controls";
import { confirmAction } from "@/components/ui/confirm-action";
import { useWriteGuard } from "@/lib/forms/use-write-guard";
import { fileBase64 } from "@/lib/spreadsheets/client";
import { importUserRow, createUserDraft } from "@/lib/users/import";
import { userRoles, type NewUser } from "@/lib/users/validation";
type Entry = {
  payload: NewUser;
  status: "pending" | "created" | "failed" | "uncertain" | "rate_limited";
  message: string;
};
const labels = {
  pending: "Belum diproses",
  created: "Berhasil dibuat",
  failed: "Gagal; perlu perbaikan",
  uncertain: "Belum dapat dipastikan",
  rate_limited: "Menunggu batas waktu",
};
export function ImportUsers() {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [running, setRunning] = useState(false),
    [entries, setEntries] = useState<Entry[]>([]),
    [issues, setIssues] = useState<{ row: number; message: string }[]>([]),
    [message, setMessage] = useState(""),
    [checked, setChecked] = useState(false),
    [backedUp, setBackedUp] = useState(false),
    [started, setStarted] = useState(false),
    [page, setPage] = useState(1);
  const current = useRef<Entry[]>([]),
    active = useRef(false),
    mounted = useRef(true),
    epoch = useRef(0),
    stop = useRef(false),
    abort = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abort.current?.abort();
    };
  }, []);
  useWriteGuard(
    () => active.current,
    () =>
      open && entries.length > 0 && entries.some((e) => e.status !== "created"),
  );
  function update(values: Entry[]) {
    current.current = values;
    if (mounted.current) setEntries(values);
  }
  function change(id: string, status: Entry["status"], message = "") {
    update(
      current.current.map((e) =>
        e.payload.requestId === id ? { ...e, status, message } : e,
      ),
    );
  }
  async function changeOpen(next: boolean) {
    if (active.current) return;
    if (
      !next &&
      entries.length &&
      !(await confirmAction(
        "Tutup impor? Kredensial dan status hanya tersedia pada sesi halaman ini. Simpan berkas kredensial dan periksa akun yang belum pasti sebelum memulai impor baru.",
      ))
    )
      return;
    if (next) {
      update([]);
      setIssues([]);
      setMessage("");
      setChecked(false);
      setBackedUp(false);
      setStarted(false);
      setPage(1);
    }
    epoch.current++;
    setOpen(next);
    if (!next) {
      update([]);
      router.refresh();
    }
  }
  async function read(file: File | undefined) {
    if (active.current || started) return;
    const version = ++epoch.current;
    update([]);
    setIssues([]);
    setChecked(false);
    setBackedUp(false);
    setMessage("");
    setPage(1);
    if (!file) return;
    if (file.size > 1048576 || !file.name.toLowerCase().endsWith(".xlsx")) {
      setMessage("Pilih Excel .xlsx maksimal 1 MiB.");
      return;
    }
    active.current = true;
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const workbook = await fileBase64(file);
      const r = await fetch("/api/directory/users/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workbook }),
        signal: controller.signal,
      });
      const b = await r.json();
      if (!mounted.current || epoch.current !== version) return;
      if (!r.ok) {
        setMessage(
          typeof b.message === "string"
            ? b.message
            : "Berkas belum dapat diperiksa.",
        );
        const i = z
          .array(
            z.object({
              row: z.number().int().min(2).max(101),
              message: z.string(),
            }),
          )
          .max(100)
          .safeParse(b.issues);
        if (i.success) setIssues(i.data);
        return;
      }
      const rows = z.array(importUserRow).min(1).max(100).parse(b.rows);
      update(
        rows.map((row) => ({
          payload: createUserDraft(row),
          status: "pending",
          message: "",
        })),
      );
      setMessage(
        "Pratinjau valid. Belum ada akun dibuat. Unduh kredensial dan periksa data sebelum melanjutkan.",
      );
    } catch {
      if (mounted.current && epoch.current === version)
        setMessage(
          "Berkas belum dapat diperiksa. Gunakan template dan coba kembali.",
        );
    } finally {
      clearTimeout(timer);
      abort.current = null;
      active.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function credentials() {
    if (active.current || !entries.length) return;
    active.current = true;
    setBusy(true);
    const version = epoch.current;
    const snapshot = [...current.current];
    try {
      const { downloadExcel } = await import("@/lib/spreadsheets/write");
      await downloadExcel(
        "kredensial-impor-pengguna.xlsx",
        [
          "username",
          "full_name",
          "role",
          "temporary_password",
          "request_id",
          "status",
        ],
        snapshot.map((e) => [
          e.payload.username,
          e.payload.fullName,
          e.payload.role,
          e.payload.password,
          e.payload.requestId,
          labels[e.status],
        ]),
        [
          "Berkas rahasia: simpan pribadi, jangan unggah ke grup atau repository.",
          "Status belum diproses/belum pasti bukan bukti akun sudah dibuat. Periksa hasil sebelum membagikan kredensial.",
          "Pengguna wajib mengganti kata sandi sementara saat masuk pertama. Berkas ini bukan template impor.",
        ],
      );
      if (mounted.current && epoch.current === version) setBackedUp(true);
    } catch {
      if (mounted.current)
        setMessage(
          "Kredensial belum dapat diunduh. Jangan mulai impor sebelum berkas tersimpan.",
        );
    } finally {
      active.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function run() {
    if (active.current || !entries.length || !checked || !backedUp) return;
    const admins = entries.filter(
      (e) =>
        e.payload.role === "admin" &&
        e.status !== "created" &&
        e.status !== "failed",
    ).length;
    if (
      admins &&
      !(await confirmAction(
        `Batch ini akan membuat ${admins} akun Admin dengan kewenangan penuh. Pastikan penetapan peran sudah benar. Lanjutkan?`,
      ))
    )
      return;
    if (active.current) return;
    active.current = true;
    stop.current = false;
    setBusy(true);
    setRunning(true);
    setStarted(true);
    setMessage("Memproses akun satu per satu secara aman…");
    let paused = false;
    try {
      for (const entry of [...current.current]) {
        if (stop.current) {
          paused = true;
          break;
        }
        if (["created", "failed"].includes(entry.status)) continue;
        const controller = new AbortController();
        abort.current = controller;
        const timer = setTimeout(() => controller.abort(), 30000);
        try {
          const r = await fetch("/api/directory/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entry.payload),
            signal: controller.signal,
            cache: "no-store",
          });
          const b = await r.json();
          if (!mounted.current) return;
          if (
            r.ok &&
            b.created === true &&
            b.username === entry.payload.username
          ) {
            change(entry.payload.requestId, "created");
            continue;
          }
          if (r.status === 429) {
            change(
              entry.payload.requestId,
              "rate_limited",
              "Batas 20 akun per 15 menit atau batas layanan tercapai. Tunggu sebelum melanjutkan.",
            );
            paused = true;
            break;
          }
          if (r.status >= 500 || b.retryable !== false) {
            change(
              entry.payload.requestId,
              "uncertain",
              "Periksa/lanjutkan dengan permintaan dan kredensial yang sama. Akun tidak digandakan.",
            );
            paused = true;
            break;
          }
          change(
            entry.payload.requestId,
            "failed",
            typeof b.message === "string" ? b.message : "Permintaan ditolak.",
          );
          paused = true;
          break;
        } catch {
          if (!mounted.current) return;
          change(
            entry.payload.requestId,
            "uncertain",
            "Koneksi terputus atau respons belum pasti. Lanjutkan dengan isian yang sama.",
          );
          paused = true;
          break;
        } finally {
          clearTimeout(timer);
          abort.current = null;
        }
      }
      if (mounted.current)
        setMessage(
          paused
            ? "Impor dijeda. Akun yang sudah berhasil tidak dikirim ulang. Periksa status dan lanjutkan secara eksplisit bila sudah siap."
            : "Proses selesai. Periksa hasil setiap baris; baris gagal tidak diulang otomatis.",
        );
    } finally {
      active.current = false;
      abort.current = null;
      if (mounted.current) {
        setBusy(false);
        setRunning(false);
        router.refresh();
      }
    }
  }
  const created = entries.filter((e) => e.status === "created").length,
    failed = entries.filter((e) => e.status === "failed").length,
    remaining = entries.filter(
      (e) => !["created", "failed"].includes(e.status),
    ).length;
  return (
    <Dialog
      open={open}
      onOpenChange={changeOpen}
      title="Impor pengguna dari Excel"
      description="Unggah, periksa, simpan kredensial, lalu buat akun. Tidak menimpa pengguna yang sudah ada."
      className="max-w-5xl"
      trigger={
        <Button type="button" variant="outline">
          Impor pengguna Excel
        </Button>
      }
    >
      <div className="min-w-0 space-y-5" aria-busy={busy}>
        <p className="text-sm text-muted-foreground">
          Maksimal 100 baris dan 1 MiB. Username wajib berformat Text. Batas
          existing 20 pembuatan akun per 15 menit tetap berlaku; lanjutkan pada
          halaman yang sama setelah jeda. Kelas, penugasan dan relasi keluarga
          diatur terpisah.
        </p>
        <a
          href="/api/directory/users/import"
          download="template-pengguna.xlsx"
          className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium"
        >
          Unduh template Excel
        </a>
        <label className="block space-y-2 text-sm font-medium">
          Unggah Excel pengguna
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="block min-h-11 w-full min-w-0 rounded-md border p-2"
            disabled={busy || started}
            onChange={(e) => void read(e.target.files?.[0])}
          />
        </label>
        {message && <Status>{message}</Status>}
        {issues.length > 0 && (
          <ul aria-label="Masalah impor pengguna" className="space-y-2 text-sm">
            {issues.map((i) => (
              <li key={i.row}>
                Baris {i.row}: {i.message}
              </li>
            ))}
          </ul>
        )}
        {entries.length > 0 && (
          <>
            <p role="status">
              {created}/{entries.length} berhasil · {failed} gagal · {remaining}{" "}
              belum selesai
            </p>
            <TableRegion label="Pratinjau impor pengguna">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Data dan status per baris</caption>
                <thead>
                  <tr>
                    {[
                      "Baris",
                      "Username",
                      "Nama",
                      "Peran",
                      "Email",
                      "Status",
                    ].map((h) => (
                      <th key={h} scope="col" className="p-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.slice((page - 1) * 20, page * 20).map((e, i) => (
                    <tr key={e.payload.requestId}>
                      {[
                        String((page - 1) * 20 + i + 2),
                        e.payload.username,
                        e.payload.fullName,
                        userRoles[e.payload.role],
                        e.payload.contactEmail || "—",
                        labels[e.status] + (e.message ? " · " + e.message : ""),
                      ].map((v, j) => (
                        <td
                          key={j}
                          className="border-b p-2 [overflow-wrap:anywhere]"
                        >
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableRegion>
            {entries.length > 20 && (
              <Pagination
                page={page}
                pageCount={Math.ceil(entries.length / 20)}
                onPageChange={setPage}
                label="Halaman pratinjau pengguna"
                disabled={false}
              />
            )}
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void credentials()}
            >
              Unduh kredensial sementara
            </Button>
            <p className="text-sm text-muted-foreground">
              Berkas kredensial bersifat rahasia. Simpan secara pribadi sebelum
              mulai; jangan membagikan kredensial baris yang belum
              terkonfirmasi. Status hanya tersimpan pada halaman ini. Jangan
              muat ulang atau menutup tab selama proses.
            </p>
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0"
                checked={checked}
                disabled={busy}
                onChange={(e) => setChecked(e.target.checked)}
              />
              <span>
                Saya sudah menyimpan berkas kredensial secara pribadi dan
                memeriksa username, nama, peran serta email setiap baris.
              </span>
            </label>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={busy || !checked || !backedUp || remaining === 0}
                onClick={() => void run()}
              >
                {started
                  ? "Lanjutkan baris belum selesai"
                  : "Mulai impor pengguna"}
              </Button>
              {running && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    stop.current = true;
                    setMessage(
                      "Akan berhenti setelah permintaan saat ini selesai.",
                    );
                  }}
                >
                  Hentikan setelah baris ini
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
