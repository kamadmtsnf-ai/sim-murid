"use client";
import { ImportReport } from "@/components/imports/import-report";
import { importQuality } from "@/lib/spreadsheets/templates";
import { confirmAction } from "@/components/ui/confirm-action";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Status } from "@/components/ui/status";
import { TableRegion } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/collection-controls";
import { controlClass } from "@/components/domain-controls";
import { useWriteGuard } from "@/lib/forms/use-write-guard";
import {
  bulkCatalog,
  type BulkCatalog,
  bulkInput,
  bulkResult,
  headers,
  outcomeLabels,
  type BulkDomain,
  type BulkResult,
} from "@/lib/bulk/validation";
import { fileBase64 } from "@/lib/spreadsheets/client";
import { z } from "zod";
import { FloatingLabel } from "@/components/ui/floating-label";

const titles = {
  enrollment: "Impor penempatan siswa",
  schedules: "Impor jadwal KBM",
  grades: "Impor nilai",
};
type Phase = "editing" | "ready" | "uncertain" | "saved" | "blocked";
export function BulkImport({
  domain,
  classes,
  subjectId,
  semester,
  subjectLabel,
  onFinished,
  disabled = false,
}: {
  domain: BulkDomain;
  classes: { id: string; label: string }[];
  subjectId?: string;
  semester?: 1 | 2;
  subjectLabel?: string | undefined;
  onFinished: () => void;
  disabled?: boolean;
}) {
  const [catalog, setCatalog] = useState<BulkCatalog | null>(null),
    [referenceSearch, setReferenceSearch] = useState("");
  const [open, setOpen] = useState(false),
    [workbook, setWorkbook] = useState(""),
    [classId, setClassId] = useState(""),
    [date, setDate] = useState(""),
    [kind, setKind] = useState<"PH" | "ATS" | "ASAS" | "Praktik">("PH");
  const [requestId, setRequestId] = useState(""),
    [result, setResult] = useState<BulkResult | null>(null),
    [phase, setPhase] = useState<Phase>("editing"),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [checked, setChecked] = useState(false),
    [missing, setMissing] = useState(false),
    [page, setPage] = useState(1);
  const active = useRef<AbortController | null>(null),
    mounted = useRef(false),
    feedback = useRef<HTMLDivElement>(null),
    opener = useRef<HTMLButtonElement>(null),
    fileRead = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.abort();
    };
  }, []);
  useWriteGuard(
    () => !!active.current,
    () => open && !!workbook && phase !== "saved",
  );
  const [preview, setPreview] = useState<{
    rows: Record<string, unknown>[];
    issues: { row: number; code: string }[];
    count: number;
    error: string;
  } | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const options = {
    classId,
    ...(domain !== "schedules" ? { date } : {}),
    ...(domain === "grades" ? { subjectId, kind, semester } : {}),
  };
  function edit() {
    setPhase("editing");
    setResult(null);
    setChecked(false);
    setMissing(false);
    setMessage("");
    setRequestId(crypto.randomUUID());
    setPage(1);
  }
  function reset() {
    fileRead.current++;
    setFileLoading(false);
    setWorkbook("");
    setPreview(null);
    setClassId(classes.length === 1 ? classes[0]!.id : "");
    setDate("");
    setKind("PH");
    edit();
  }
  async function changeOpen(value: boolean) {
    if (active.current) return;
    if (!value && phase === "saved") {
      fileRead.current++;
      setWorkbook("");
      setPreview(null);
      setOpen(false);
      onFinished();
      return;
    }
    if (
      !value &&
      workbook &&
      phase !== "saved" &&
      !(await confirmAction(
        phase === "uncertain"
          ? "Hasil belum dipastikan. Simpan ID permintaan dan periksa hasil sebelum mengulang. Tutup dan hapus isian?"
          : "Tutup dan hapus isian impor yang belum disimpan?",
      ))
    )
      return;
    if (value) reset();
    else {
      fileRead.current++;
      setWorkbook("");
      setPreview(null);
      setResult(null);
    }
    setOpen(value);
  }
  function template() {
    const a = document.createElement("a");
    a.href = "/api/bulk-input/workbook?" + new URLSearchParams({ domain });
    a.download = `template-${domain}.xlsx`;
    a.click();
  }
  async function file(file: File | undefined) {
    const epoch = ++fileRead.current;
    setWorkbook("");
    setPreview(null);
    setFileLoading(false);
    edit();
    if (!file) return;
    if (file.size > 1048576 || !file.name.toLowerCase().endsWith(".xlsx")) {
      setMessage("Pilih Excel .xlsx maksimal 1 MiB.");
      return;
    }
    setFileLoading(true);
    try {
      const workbook = await fileBase64(file);
      const r = await fetch("/api/bulk-input/workbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, workbook }),
        signal: AbortSignal.timeout(30000),
      });
      const b = await r.json();
      if (!mounted.current || fileRead.current !== epoch) return;
      if (!r.ok) {
        setMessage(
          typeof b.message === "string" ? b.message : "Excel tidak valid.",
        );
        return;
      }
      const parsed = z
        .object({
          rows: z.array(z.record(z.string(), z.unknown())).max(100),
          issues: z
            .array(
              z.object({
                row: z.number().int().min(2).max(101),
                code: z.string(),
              }),
            )
            .max(100),
          count: z.number().int().min(1).max(100),
        })
        .refine(v=>v.rows.length+new Set(v.issues.map(i=>i.row)).size===v.count && v.issues.every(i=>i.row<=v.count+1), "Ringkasan pemeriksaan Excel tidak konsisten.")
        .parse(b.preview);
      setWorkbook(workbook);
      setPreview({ ...parsed, error: "" });
      edit();
    } catch {
      if (mounted.current && fileRead.current === epoch)
        setMessage(
          "Berkas Excel belum dapat diperiksa. Gunakan template dan coba lagi.",
        );
    } finally {
      if (mounted.current && fileRead.current === epoch) setFileLoading(false);
    }
  }
  async function send(action: "preview" | "commit" | "status") {
    if (active.current || fileLoading) return;
    if (
      action !== "status" &&
      (!preview || preview.error || preview.issues.length)
    ) {
      setMessage("Perbaiki seluruh baris Excel sebelum melanjutkan.");
      return;
    }
    if (
      action === "commit" &&
      phase !== "uncertain" &&
      (!checked || phase !== "ready")
    )
      return;
    const input =
      action === "status"
        ? null
        : bulkInput.safeParse({
            action,
            requestId,
            domain,
            options,
            workbook,
            ...(action === "commit" ? { revision: result?.revision } : {}),
          });
    if (input && !input.success) {
      setMessage(input.error.issues[0]?.message ?? "Periksa konteks impor.");
      return;
    }
    const c = new AbortController();
    active.current = c;
    setPending(true);
    setMessage("");
    const timer = setTimeout(() => c.abort("timeout"), 35000);
    try {
      const response = await fetch(
        action === "status"
          ? "/api/bulk-input?" + new URLSearchParams({ requestId })
          : "/api/bulk-input",
        {
          ...(action !== "status"
            ? {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input && input.success ? input.data : {}),
              }
            : {}),
          cache: "no-store",
          signal: c.signal,
        },
      );
      if (!mounted.current || c.signal.aborted) return;
      if (response.status === 401 || response.status === 403) {
        setWorkbook("");
        setPreview(null);
        setResult(null);
        setPhase("blocked");
        setMessage(
          "Sesi atau akses berubah. Masuk kembali dan periksa hak akses sebelum mengimpor.",
        );
        return;
      }
      if (action === "status" && !response.ok) throw Error("Unconfirmed");
      const body = await response.json();
      if (!body.result) {
        if (action === "commit" || action === "status")
          throw Error("Unconfirmed");
        setPhase("editing");
        setMessage(
          typeof body.message === "string"
            ? body.message
            : "Pratinjau ditolak. Tidak ada data disimpan.",
        );
        return;
      }
      const fresh = bulkResult.parse(body.result);
      if (
        (fresh.code === "saved" || fresh.code === "ready") &&
        (fresh.requestId !== requestId || fresh.rows?.length !== preview?.count)
      )
        throw Error("Unconfirmed");
      if (!response.ok && ["ready", "saved"].includes(fresh.code))
        throw Error("Unconfirmed");
      if (
        (fresh.code === "ready" && action !== "preview") ||
        (action === "status" && !["saved", "not_found"].includes(fresh.code))
      )
        throw Error("Unconfirmed");
      if (fresh.code !== "not_found") setResult(fresh);
      setPage(1);
      if (fresh.code === "saved") {
        setPhase("saved");
        setMessage(
          "Seluruh batch tersimpan. Periksa hasil per baris sebelum menutup.",
        );
      } else if (fresh.code === "ready" && action === "preview") {
        setPhase("ready");
        setChecked(false);
        setMessage(
          "Validasi sumber berhasil. Belum ada data disimpan; periksa pratinjau sebelum konfirmasi.",
        );
      } else if (fresh.code === "not_found" && action === "status") {
        setPhase("uncertain");
        setMissing(true);
        setMessage(
          "Belum ada hasil tersimpan. Anda dapat memeriksa lagi atau mencoba penyimpanan dengan ID dan isian yang sama.",
        );
      } else {
        setPhase("editing");
        setChecked(false);
        setMessage(
          outcomeLabels[fresh.code] ??
            "Batch ditolak. Tidak ada data disimpan.",
        );
      }
      requestAnimationFrame(() => {
        const node = feedback.current;
        if (!node) return;
        // Native focus scrolling can also scroll the overflow-hidden dialog shell.
        node.focus({ preventScroll: true });
        const body = node.closest<HTMLElement>(".dialog-body");
        if (body) body.scrollTop += node.getBoundingClientRect().top - body.getBoundingClientRect().top - 16;
      });
    } catch {
      if (mounted.current) {
        if (action === "commit" || action === "status") {
          setPhase("uncertain");
          setMissing(false);
          setMessage(
            "Hasil penyimpanan belum dapat dipastikan. Isian dan ID permintaan dipertahankan. Periksa hasil; jangan mengunggah ulang sebagai batch baru.",
          );
        } else {
          setPhase("editing");
          setMessage(
            "Pratinjau belum tersedia. Tidak ada data disimpan; coba validasi kembali.",
          );
        }
      }
    } finally {
      clearTimeout(timer);
      if (active.current === c) active.current = null;
      if (mounted.current) setPending(false);
    }
  }
  async function references() {
    if (active.current || !classId) return;
    const c = new AbortController();
    active.current = c;
    setPending(true);
    setMessage("");
    const timer = setTimeout(() => c.abort(), 20000);
    try {
      const r = await fetch(
        "/api/bulk-input?" +
          new URLSearchParams({
            catalog: "1",
            domain,
            classId,
            ...(subjectId ? { subjectId } : {}),
          }),
        { cache: "no-store", signal: c.signal },
      );
      if (!mounted.current || c.signal.aborted) return;
      if (r.status === 401 || r.status === 403) {
        setCatalog(null);
        setWorkbook("");
        setPreview(null);
        setResult(null);
        setPhase("blocked");
        setMessage(
          "Sesi atau akses berubah. Periksa hak akses sebelum melanjutkan.",
        );
        return;
      }
      if (!r.ok) throw Error();
      const fresh = bulkCatalog.parse((await r.json()).catalog);
      if (fresh.classId !== classId || fresh.domain !== domain) throw Error();
      setCatalog(fresh);
      setReferenceSearch("");
    } catch {
      if (mounted.current)
        setMessage("Referensi belum dapat dimuat. Tidak ada data disimpan.");
    } finally {
      clearTimeout(timer);
      if (active.current === c) active.current = null;
      if (mounted.current) setPending(false);
    }
  }
  const frozen =
    pending ||
    phase === "uncertain" ||
    phase === "saved" ||
    phase === "blocked";
  const count = preview?.count ?? 0,
    pages = Math.max(1, Math.ceil(count / 10)),
    current = Math.min(page, pages);
  return (
    <>
      <Button
        ref={opener}
        type="button"
        variant="outline"
        disabled={disabled || !classes.length}
        onClick={async () => await changeOpen(true)}
      >
        {titles[domain]}
      </Button>
      <Dialog
        open={open}
        onOpenChange={changeOpen}
        returnFocusRef={opener}
        closeDisabled={pending}
        title={titles[domain]}
        description="Unggah → validasi → pratinjau → konfirmasi → hasil per baris. Seluruh batch dibatalkan bila ada isian yang salah."
      >
        <div className="min-w-0 space-y-5">
          <ol
            aria-label="Tahapan impor"
            className="flex flex-wrap gap-2 text-xs text-muted-foreground"
          >
            {[
              "1 Unggah",
              "2 Validasi",
              "3 Pratinjau",
              "4 Konfirmasi",
              "5 Hasil",
            ].map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">
            Excel .xlsx, maksimal 1 MiB dan 100 baris. Pertahankan sheet Data
            serta username berformat Text. Username adalah teks persis, termasuk
            nol awal dan minus. Atur kolom username sebagai teks di spreadsheet.
            Akun baru tidak dibuat melalui impor ini.{" "}
            {domain === "grades"
              ? "Nilai kosong berbeda dari 0. Impor hanya membuat penilaian baru, bukan koreksi atau penimpaan."
              : domain === "enrollment"
                ? "Siswa yang sudah ditempatkan pada tahun ajaran ini ditolak; pemindahan tetap melalui alur penempatan existing."
                : "Gunakan kode mapel resmi (misalnya IPS); waktu selesai termasuk JTM dan istirahat."}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={pending || phase !== "editing" || !classId}
            onClick={() => void references()}
          >
            Tampilkan referensi kelas
          </Button>
          {catalog?.classId === classId ? (
            <details className="rounded-lg border p-3">
              <summary className="min-h-11 cursor-pointer text-sm font-medium">
                Referensi username dan kode mapel
              </summary>
              <p className="text-xs text-muted-foreground">
                Maksimal 500 akun aktif dan 100 mapel; validasi akhir tetap
                memeriksa data sumber lengkap.
              </p>
              <div className="mt-3 block text-sm"><FloatingLabel label={<>Cari referensi
                </>}><input placeholder=" "
                  type="search"
                  className={controlClass}
                  value={referenceSearch}
                  maxLength={100}
                  onChange={(e) => setReferenceSearch(e.target.value)}
                /></FloatingLabel>
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {catalog.people
                  .filter((p) =>
                    `${p.username} ${p.name}`
                      .toLowerCase()
                      .includes(referenceSearch.toLowerCase()),
                  )
                  .slice(0, 20)
                  .map((p) => (
                    <li className="[overflow-wrap:anywhere]" key={p.username}>
                      <code>{p.username}</code> · {p.name}
                    </li>
                  ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Menampilkan hingga 20 akun sesuai pencarian.
              </p>
              {catalog.subjects.length ? (
                <ul className="mt-3 space-y-1 text-sm">
                  {catalog.subjects.map((s) => (
                    <li key={s.code}>
                      <code>{s.code}</code> · {s.name}
                    </li>
                  ))}
                </ul>
              ) : null}
            </details>
          ) : null}
          <Button type="button" variant="outline" onClick={template}>
            Unduh template Excel
          </Button>
          <fieldset
            disabled={frozen}
            className="grid min-w-0 gap-4 sm:grid-cols-2"
          >
            <legend className="sr-only">Konteks dan berkas impor</legend>
            <label className="min-w-0 text-sm">
              Kelas dan tahun ajaran
              <select
                className={controlClass}
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  edit();
                }}
              >
                <option value="">Pilih kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            {subjectId ? (
              <p className="self-center text-sm">
                Mata pelajaran: {subjectLabel ?? "Sesuai filter penilaian"} ·
                Semester {semester === 1 ? "Ganjil" : "Genap"}
              </p>
            ) : null}
            {domain !== "schedules" ? (
              <div className="text-sm"><FloatingLabel label={<>{domain === "enrollment"
                  ? "Tanggal mulai penempatan"
                  : "Tanggal penilaian"}</>}><input placeholder=" "
                  className={controlClass}
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    edit();
                  }}
                /></FloatingLabel>
              </div>
            ) : null}
            {domain === "grades" ? (
              <label className="text-sm">
                Jenis penilaian
                <select
                  className={controlClass}
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value as typeof kind);
                    edit();
                  }}
                >
                  {["PH", "ATS", "ASAS", "Praktik"].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="min-w-0 text-sm sm:col-span-2">
              Unggah Excel (.xlsx)
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className={controlClass}
                onChange={(e) => void file(e.target.files?.[0])}
              />
            </label>
            {fileLoading && <p role="status">Memeriksa berkas Excel…</p>}
          </fieldset>
          {message ? (
            <div ref={feedback} tabIndex={-1}>
              <Status
                tone={
                  phase === "saved"
                    ? "success"
                    : phase === "ready"
                      ? "info"
                      : "error"
                }
              >
                {message}
              </Status>
            </div>
          ) : null}
          {pending ? (
            <p role="status">
              {phase === "ready"
                ? "Menyimpan seluruh batch…"
                : "Memeriksa permintaan…"}
            </p>
          ) : null}
          {preview?.error ? (
            <Status tone="error">{preview.error}</Status>
          ) : null}
          {preview && preview.count > 0 ? <p role="status" className="text-sm">Pemeriksaan Excel: {importQuality(preview.count, preview.issues.map(i=>i.row)).valid}/{preview.count} baris valid ({importQuality(preview.count, preview.issues.map(i=>i.row)).percentage}%). Pemeriksaan referensi dan izin dilakukan pada validasi sumber; belum ada data disimpan oleh pemeriksaan Excel.</p> : null}
          {preview?.issues.length ? <ImportReport name={`kesalahan-${domain}.xlsx`} label="Unduh daftar kesalahan" headers={["baris_excel", "keterangan"]} rows={preview.issues.map(i=>[i.row,i.code])} disabled={pending||fileLoading}/> : null}
          {result?.rows?.length ? <ImportReport name={`hasil-${domain}.xlsx`} label="Unduh laporan impor" headers={["baris_excel", "hasil", "status_batch"]} rows={result.rows.map(r=>[r.row,outcomeLabels[r.code]??"Tidak disimpan; periksa referensi dan izin", phase==="uncertain"?"Hasil penyimpanan belum dapat dipastikan":outcomeLabels[result.code]??"Belum tersimpan"])} disabled={pending||fileLoading} instructions={["Seluruh batch disimpan secara atomik. Hasil validasi per baris bukan bukti tersimpan.", "Jika status batch belum pasti, periksa hasil menggunakan permintaan yang sama sebelum mencoba kembali."]}/> : null}
          {preview?.issues.length ? (
            <ul aria-label="Masalah Excel" className="space-y-2 text-sm">
              {preview.issues.map((i) => (
                <li key={i.row}>
                  Baris {i.row}: {i.code}. Tidak disimpan.
                </li>
              ))}
            </ul>
          ) : null}
          {preview && !preview.error && !preview.issues.length ? (
            <>
              <h3 className="font-semibold">Pratinjau · {count} baris</h3>
              <p className="text-sm text-muted-foreground">
                Kelas:{" "}
                {classes.find((c) => c.id === classId)?.label ??
                  "Belum dipilih"}
                {domain !== "schedules"
                  ? ` · Tanggal: ${date || "Belum diisi"}`
                  : ""}
                {domain === "grades" ? ` · ${kind}` : ""}.{" "}
                {result?.code !== "saved"
                  ? "Tampilan ini belum merupakan bukti penyimpanan."
                  : ""}
              </p>
              <TableRegion label="Pratinjau dan hasil impor">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="p-2">Baris</th>
                      {headers[domain].map((h) => (
                        <th className="p-2" key={h}>
                          {h}
                        </th>
                      ))}
                      <th className="p-2">Hasil sumber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows
                      .slice((current - 1) * 10, current * 10)
                      .map((r, index) => {
                        const n = (current - 1) * 10 + index + 2;
                        const outcome = result?.rows?.find((x) => x.row === n);
                        return (
                          <tr key={n}>
                            <td className="p-2">{n}</td>
                            {headers[domain].map((h) => (
                              <td
                                key={h}
                                className="max-w-60 whitespace-pre-wrap p-2 [overflow-wrap:anywhere]"
                              >
                                {r[h] === null ? "Kosong" : String(r[h] ?? "")}
                              </td>
                            ))}
                            <td className="p-2">
                              {outcome
                                ? (outcomeLabels[outcome.code] ??
                                  "Tidak disimpan; periksa data sumber")
                                : "Belum divalidasi sumber"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </TableRegion>
              {pages > 1 ? (
                <Pagination
                  label="Halaman pratinjau impor"
                  page={current}
                  pageCount={pages}
                  disabled={pending}
                  onPageChange={setPage}
                />
              ) : null}
            </>
          ) : null}
          {phase === "ready" ? (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="size-5 shrink-0"
                checked={checked}
                disabled={pending}
                onChange={(e) => setChecked(e.target.checked)}
              />
              Saya sudah memeriksa kelas, periode, isi dan seluruh hasil
              validasi; simpan seluruh batch.
            </label>
          ) : null}
          {phase === "uncertain" ? (
            <p className="break-all text-xs">
              ID permintaan: {requestId}. Isian dikunci sampai hasil diperiksa.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {phase === "editing" ? (
              <Button
                type="button"
                disabled={
                  pending ||
                  fileLoading ||
                  !workbook ||
                  !!preview?.error ||
                  !!preview?.issues.length
                }
                onClick={() => void send("preview")}
              >
                Validasi dan pratinjau
              </Button>
            ) : null}
            {phase === "ready" ? (
              <Button
                type="button"
                disabled={pending || !checked}
                onClick={() => void send("commit")}
              >
                Konfirmasi simpan batch
              </Button>
            ) : null}
            {phase === "uncertain" ? (
              <>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => void send("status")}
                >
                  Periksa hasil
                </Button>
                {missing ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => void send("commit")}
                  >
                    Coba simpan dengan ID sama
                  </Button>
                ) : null}
              </>
            ) : null}
            {phase === "saved" ? (
              <Button
                type="button"
                onClick={() => {
                  setWorkbook("");
                  setPreview(null);
                  setOpen(false);
                  onFinished();
                }}
              >
                Selesai dan perbarui tampilan
              </Button>
            ) : null}
          </div>
        </div>
      </Dialog>
    </>
  );
}
