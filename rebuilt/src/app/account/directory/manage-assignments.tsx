"use client";
import { Guidance } from "@/components/ui/guidance";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Status } from "@/components/ui/status";
import { confirmAction } from "@/components/ui/confirm-action";
import { useWriteGuard } from "@/lib/forms/use-write-guard";
import {
  assignmentCommand,
  assignmentRows,
  teacherTasks,
} from "@/lib/education/teacher-assignments";
import {
  directoryToday,
  directoryAssignmentState,
  assignmentLabel,
} from "@/lib/education/directory";
import type { z } from "zod";
type Command = z.infer<typeof assignmentCommand>;
export function ManageAssignments({ target }: { target: string }) {
  const router = useRouter(),
    active = useRef(false);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [rows, setRows] = useState<z.infer<typeof assignmentRows>>([]),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState<Command | null>(null),
    [reason, setReason] = useState("");
  useWriteGuard(
    () => active.current,
    () => pending !== null,
  );
  async function changeOpen(next: boolean) {
    if (active.current) return;
    if (
      !next &&
      pending &&
      !(await confirmAction(
        "Hasil perubahan belum pasti. Periksa penugasan sebelum membuat permintaan baru. Tutup dialog?",
      ))
    )
      return;
    setOpen(next);
    if (next) {
      setPending(null);
      setMessage("");
      setLoaded(false);
      setReason("");
      await load();
    }
  }
  async function load() {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setLoaded(false);
    try {
      const r = await fetch(`/api/directory/${target}/assignments`, {
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
      const b = await r.json();
      if (!r.ok) throw Error();
      setRows(assignmentRows.parse(b.rows));
      setLoaded(true);
    } catch {
      setMessage("Penugasan belum dapat dimuat. Coba muat ulang.");
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  async function send(command: Command) {
    if (active.current) return;
    if (
      command.action === "assign" &&
      command.code === "school_head" &&
      !(await confirmAction(
        "Tugas Kepala Madrasah memberikan akses luas ke data madrasah. Pastikan penetapannya benar. Lanjutkan?",
      ))
    )
      return;
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setPending(command);
    setMessage("Menyimpan perubahan…");
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 30000);
    try {
      const r = await fetch(`/api/directory/${target}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
        signal: controller.signal,
      });
      const b = await r.json();
      if (!r.ok) {
        if (b.retryable === false) setPending(null);
        setMessage(
          typeof b.message === "string"
            ? b.message
            : "Perubahan belum dapat dipastikan. Coba kembali.",
        );
        return;
      }
      if (b.saved !== true) throw Error();
      setRows(assignmentRows.parse(b.rows));
      setLoaded(true);
      setPending(null);
      setReason("");
      setMessage(
        "Perubahan tugas tambahan berhasil disimpan. Izin mengikuti masa berlaku penugasan.",
      );
      router.refresh();
    } catch {
      setMessage(
        "Hasil belum dapat dipastikan. Klik Coba kembali untuk memakai permintaan yang sama.",
      );
    } finally {
      clearTimeout(timer);
      active.current = false;
      setBusy(false);
    }
  }
  function submit(form: HTMLFormElement) {
    const f = new FormData(form);
    const parsed = assignmentCommand.safeParse({
      requestId: crypto.randomUUID(),
      action: "assign",
      code: f.get("code"),
      validFrom: f.get("from"),
      validUntil: f.get("until") || null,
    });
    if (!parsed.success) {
      setMessage(
        "Pilih tugas dan tanggal yang valid. Tanggal akhir tidak boleh mendahului tanggal mulai.",
      );
      return;
    }
    void send(parsed.data);
  }
  return (
    <Dialog
      open={open}
      onOpenChange={changeOpen}
      title="Kelola tugas tambahan"
      description="Tetapkan atau cabut penugasan guru. Setiap perubahan dicatat dalam riwayat audit."
      closeDisabled={busy}
      trigger={
        <Button type="button" variant="outline">
          Kelola Tugas Tambahan
        </Button>
      }
    >
      <div className="min-w-0 space-y-5" aria-busy={busy}>
        <Guidance summary="Panduan penugasan guru">
          <p className="text-sm text-muted-foreground">
            Seorang guru dapat memiliki beberapa tugas. Wali kelas ditetapkan pada
            Kelas dan siswa; Guru Piket melalui jadwal Guru Piket. Penugasan di
            sini berlaku untuk tingkat madrasah.
          </p>
        </Guidance>
        {message && <Status>{message}</Status>}
        {!loaded && !busy && (
          <Button type="button" onClick={() => void load()}>
            Muat ulang penugasan
          </Button>
        )}
        {busy && <p role="status">Memproses…</p>}
        {loaded && (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(e.currentTarget);
              }}
              className="space-y-4"
            >
              <fieldset
                disabled={busy || pending !== null}
                className="space-y-4"
              >
                <legend className="font-semibold">Tambah penugasan</legend>
                <label className="block text-sm">
                  Tugas tambahan
                  <select
                    name="code"
                    className="mt-1 min-h-11 w-full rounded-md border bg-background p-2"
                  >
                    {Object.entries(teacherTasks).map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="min-w-0 text-sm">
                    Tanggal mulai
                    <input
                      required
                      type="date"
                      name="from"
                      min="1900-01-01"
                      max="2199-12-31"
                      defaultValue={directoryToday()}
                      className="mt-1 min-h-11 w-full min-w-0 rounded-md border p-2"
                    />
                  </label>
                  <label className="min-w-0 text-sm">
                    Tanggal akhir (opsional)
                    <input
                      type="date"
                      name="until"
                      min="1900-01-01"
                      max="2199-12-31"
                      className="mt-1 min-h-11 w-full min-w-0 rounded-md border p-2"
                    />
                  </label>
                </div>
                <Button type="submit">Simpan penugasan</Button>
              </fieldset>
            </form>
            <section className="space-y-3">
              <h2 className="font-semibold">Daftar penugasan dan riwayat</h2>
              <label className="block text-sm">
                Alasan pencabutan
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={busy || !!pending}
                  minLength={5}
                  maxLength={500}
                  className="mt-1 min-h-20 w-full rounded-md border p-2"
                  placeholder="Isi minimal 5 karakter sebelum mencabut tugas"
                />
              </label>
              {!rows.length && <p>Belum ada penugasan yang dapat dikelola.</p>}
              <ul className="space-y-3">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="min-w-0 rounded-lg border p-3 [overflow-wrap:anywhere]"
                  >
                    <p className="font-medium">{assignmentLabel(row.code)}</p>
                    <p className="text-sm">
                      {directoryAssignmentState(row, directoryToday())} ·{" "}
                      {row.valid_from} –{" "}
                      {row.valid_until ?? "Tanpa batas tanggal"}
                    </p>
                    {!row.revoked_at && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy || !!pending || reason.trim().length < 5}
                        onClick={async () => {
                          if (
                            await confirmAction(
                              `Cabut tugas ${assignmentLabel(row.code)}? Akses dari penugasan ini akan berhenti.`,
                              {title:"Cabut tugas tambahan?",confirmLabel:"Cabut tugas",tone:"danger"},
                            )
                          )
                            void send({
                              requestId: crypto.randomUUID(),
                              action: "revoke",
                              id: row.id,
                              reason: reason.trim(),
                            });
                        }}
                      >
                        Cabut tugas
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
        {pending && !busy && (
          <Button type="button" onClick={() => void send(pending)}>
            Coba kembali dengan permintaan yang sama
          </Button>
        )}
      </div>
    </Dialog>
  );
}
