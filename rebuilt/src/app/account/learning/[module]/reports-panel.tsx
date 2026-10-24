"use client";
import { AcademicContextBar } from "@/components/academic/academic-context";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TableRegion } from "@/components/ui/data-table";
import { controlClass } from "@/components/domain-controls";
import { useDomainMutation } from "@/lib/education/use-mutation";
import { commands } from "@/lib/learning/validation";
import {
  reportsSnapshot,
  reportFilters,
  reportKinds,
  reportSnapshot,
  reportReady,
  reportValue,
  type ReportsSnapshot,
  type ReportKind,
} from "@/lib/learning/reports";
import { grade } from "@/lib/learning/grade";
import { formatAcademicYear, semesterPeriod } from "@/lib/academic/period";
const api = "/api/learning/reports";
export function ReportsPanel({ initial }: { initial: ReportsSnapshot }) {
  const [data, setData] = useState(initial),
    [filters, setFilters] = useState<Record<string, string>>({
      semester: String(initial.semester),
    }),
    [classId, setClassId] = useState(""),
    [semester, setSemester] = useState(String(initial.semester)),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<string[]>([]),
    [kind, setKind] = useState<ReportKind>("combined"),
    [reading, setReading] = useState(false),
    [downloading, setDownloading] = useState(false),
    [notice, setNotice] = useState(""),
    [confirm, setConfirm] = useState(false),
    [ack, setAck] = useState(false);
  const lock = useRef(false),
    mounted = useRef(true),
    controller = useRef<AbortController | null>(null),
    trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  const query = (f = filters) => new URLSearchParams(f).toString();
  const { busy, blocked, message, feedbackRef, clear, mutate } =
    useDomainMutation(
      api + "?" + query(),
      reportsSnapshot,
      "data",
      (next) => {
        setData(next);
        setSelected([]);
        setConfirm(false);
        setAck(false);
      },
      { confirmed: true, commandSchema: commands.reports },
    );
  const disabled = reading || downloading || busy || blocked;
  const currentClass = data.classes.find((c) => c.id === filters.classId),
    period = semesterPeriod(currentClass?.year, filters.semester);
  const filtered = data.rows.filter(
    (r) =>
      (r.name + " " + (reportSnapshot(r)?.student.username ?? ""))
        .toLocaleLowerCase("id-ID")
        .includes(search.trim().toLocaleLowerCase("id-ID")) &&
      (status === "all" ||
        (status === "published"
          ? !!r.published
          : status === "ready"
            ? reportReady(r)
            : !r.published && !reportReady(r))),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10)),
    visible = filtered.slice(
      (Math.min(page, pages) - 1) * 10,
      Math.min(page, pages) * 10,
    );
  const targets = data.rows.filter((r) => selected.includes(r.student_id)),
    publishable =
      targets.length > 0 && targets.length <= 500 && targets.every(reportReady);
  async function load(
    e?: FormEvent<HTMLFormElement>,
    override?: Record<string, string>,
  ) {
    e?.preventDefault();
    if (lock.current || disabled) return;
    lock.current = true;
    setReading(true);
    setNotice("");
    clear();
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 30000);
    try {
      const next = override ?? { ...(classId ? { classId } : {}), semester };
      reportFilters.parse(next);
      const r = await fetch(api + "?" + query(next), {
        cache: "no-store",
        signal: abort.signal,
      });
      if (!r.ok) throw Error();
      const parsed = reportsSnapshot.parse((await r.json()).data);
      if (
        (next.classId && !parsed.classes.some((c) => c.id === next.classId)) ||
        parsed.extra.scope?.classId !== next.classId ||
        parsed.semester !== Number(next.semester)
      )
        throw Error();
      if (mounted.current) {
        setData(parsed);
        setFilters(next);
        setClassId(next.classId ?? "");
        setSemester(next.semester!);
        setSelected([]);
        setSearch("");
        setStatus("all");
        setPage(1);
        setNotice(
          parsed.rows.length
            ? "Data rapor diperbarui."
            : "Tidak ada rapor sesuai filter dan hak akses Anda.",
        );
      }
    } catch {
      if (mounted.current)
        setNotice(
          "Data rapor belum dapat dimuat. Periksa koneksi lalu coba kembali.",
        );
    } finally {
      clearTimeout(timer);
      lock.current = false;
      if (mounted.current) setReading(false);
    }
  }
  async function download(ids: string[]) {
    if (lock.current || disabled || !ids.length) return;
    lock.current = true;
    setDownloading(true);
    setNotice("Menyiapkan PDF…");
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 60000);
    try {
      const r = await fetch(
        api +
          "?" +
          new URLSearchParams({
            ...filters,
            kind,
            format: "pdf",
            ...(ids.length > 500 && ids.length === data.rows.length
              ? {}
              : { selected: ids.join(",") }),
          }),
        { cache: "no-store", signal: abort.signal },
      );
      if (!r.ok || !r.headers.get("content-type")?.includes("application/pdf"))
        throw Error();
      const blob = await r.blob();
      if (!mounted.current) return;
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "rapor.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("PDF berhasil disiapkan.");
    } catch {
      if (mounted.current)
        setNotice("PDF belum dapat diunduh. Periksa pilihan dan coba kembali.");
    } finally {
      clearTimeout(timer);
      lock.current = false;
      if (mounted.current) setDownloading(false);
    }
  }
  function toggle(id: string) {
    setSelected((v) =>
      v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
    );
  }
  return (
    <div className="reports-panel min-w-0 space-y-5">
      <AcademicContextBar
        current={{
          year: currentClass?.year ?? null,
          classId: filters.classId ?? null,
          semester: Number(filters.semester),
        }}
        catalog={{
          years: data.classes.map((c) => c.year),
          classes: data.classes,
        }}
        requiresClass
        disabled={disabled || confirm}
        onApply={(value) => {
          if (
            (selected.length ||
              classId !== (filters.classId ?? "") ||
              semester !== filters.semester) &&
            !window.confirm("Buang pilihan rapor sebelum mengganti konteks?")
          )
            return;
          return load(undefined, {
            classId: value.classId!,
            semester: String(value.semester),
          });
        }}
      />
      <p className="text-sm text-muted-foreground">
        Tinjau nilai siswa per kelas dan semester. Rapor terbit mempertahankan
        nilai dan KKM saat diterbitkan.
      </p>
      <form
        onSubmit={load}
        className="grid min-w-0 gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] lg:items-end"
        aria-busy={reading}
      >
        <label className="min-w-0 space-y-2">
          <span className="text-sm font-medium">Kelas / tahun ajaran</span>
          <select
            className={controlClass}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={disabled}
          >
            <option value="">Pilih kelas</option>
            {initial.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {formatAcademicYear(c.year)}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 space-y-2">
          <span className="text-sm font-medium">Semester</span>
          <select
            className={controlClass}
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            disabled={disabled}
          >
            <option value="1">Ganjil (Juli–Desember)</option>
            <option value="2">Genap (Januari–Juni)</option>
          </select>
        </label>
        <Button id="reports-filter" disabled={disabled}>
          {reading ? "Memuat…" : "Tampilkan"}
        </Button>
      </form>
      {notice && (
        <p role="status" className="rounded-lg border p-3 text-sm">
          {notice}
        </p>
      )}
      {message && (
        <div
          role="status"
          tabIndex={-1}
          ref={feedbackRef}
          className="rounded-lg border p-3 text-sm"
        >
          {message}
          {blocked && (
            <Button
              type="button"
              variant="outline"
              className="mt-3 block"
              onClick={() => window.location.reload()}
            >
              Muat ulang halaman
            </Button>
          )}
        </div>
      )}
      {period && (
        <p className="text-sm font-medium">
          {currentClass?.name} · {period.label}
        </p>
      )}
      {!filters.classId ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          Pilih kelas dan semester untuk melihat rapor.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Siswa", data.rows.length],
              ["Terbit", data.rows.filter((r) => r.published).length],
              ["Draf siap terbit", data.rows.filter(reportReady).length],
            ].map(([label, count]) => (
              <div key={label} className="rounded-xl border bg-card p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{count}</p>
              </div>
            ))}
          </div>
          <section
            aria-label="Kontrol rapor"
            className="space-y-4 rounded-xl border bg-card p-4"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="min-w-0">
                Cari siswa
                <input
                  className={controlClass}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Nama atau username"
                  disabled={disabled}
                />
              </label>
              <label className="min-w-0">
                Status
                <select
                  className={controlClass}
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                  disabled={disabled}
                >
                  <option value="all">Semua status</option>
                  <option value="published">Terbit</option>
                  <option value="ready">Draf siap terbit</option>
                  <option value="incomplete">Belum lengkap / tersedia</option>
                </select>
              </label>
              <label className="min-w-0">
                Jenis rapor
                <select
                  className={controlClass}
                  value={kind}
                  onChange={(e) => setKind(e.target.value as ReportKind)}
                  disabled={disabled}
                >
                  {reportKinds.map((k) => (
                    <option key={k} value={k}>
                      {k === "combined" ? "Gabungan" : k}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-sm text-muted-foreground">
              Gabungan: PH 20% + ATS 30% + ASAS 50%. Praktik ditampilkan
              terpisah. Nilai yang belum lengkap masih sementara.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={disabled || !visible.length}
                onClick={() =>
                  setSelected((v) => [
                    ...new Set([
                      ...v,
                      ...visible
                        .filter((r) => reportSnapshot(r)?.subjects.length)
                        .map((r) => r.student_id),
                    ]),
                  ])
                }
              >
                Pilih halaman ini
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={disabled || !selected.length}
                onClick={() => setSelected([])}
              >
                Hapus pilihan
              </Button>
              <span className="text-sm" aria-live="polite">
                {selected.length} siswa dipilih
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={disabled || !selected.length || selected.length > 500}
                onClick={() => void download(selected)}
              >
                {downloading ? "Menyiapkan PDF…" : "Unduh PDF pilihan"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={
                  disabled ||
                  !filtered.length ||
                  (filtered.length > 500 &&
                    filtered.length !== data.rows.length) ||
                  filtered.some((r) => !reportSnapshot(r)?.subjects.length)
                }
                onClick={() => void download(filtered.map((r) => r.student_id))}
              >
                Unduh PDF hasil filter
              </Button>
              {data.extra.canPublish && (
                <Button
                  type="button"
                  disabled={disabled || !publishable}
                  onClick={(e) => {
                    trigger.current = e.currentTarget;
                    setAck(false);
                    setConfirm(true);
                  }}
                >
                  Terbitkan pilihan
                </Button>
              )}
            </div>
            {data.extra.canPublish && (
              <p className="text-sm text-muted-foreground">
                Pilih maksimal 500 draf dengan PH, ATS, dan ASAS lengkap untuk
                diterbitkan. Rapor yang sudah terbit tidak dapat ditimpa.
              </p>
            )}
          </section>
          {!filtered.length && (
            <div className="rounded-xl border border-dashed p-8 text-center">
              Tidak ada rapor sesuai filter dan hak akses Anda.
            </div>
          )}
          {visible.map((r) => {
            const s = reportSnapshot(r);
            return (
              <section
                key={r.student_id}
                aria-label={"Rapor " + r.name}
                className="min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <label className="flex min-w-0 items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-5 shrink-0 accent-primary"
                      checked={selected.includes(r.student_id)}
                      onChange={() => toggle(r.student_id)}
                      disabled={disabled || !s?.subjects.length}
                    />
                    <span className="min-w-0 break-words">
                      <strong className="block">{r.name}</strong>
                      <span className="text-sm text-muted-foreground">
                        {s?.student.username ?? "Identitas belum tersedia"}
                      </span>
                    </span>
                  </label>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                    {r.published
                      ? "Terbit"
                      : !s
                        ? "Tidak tersedia"
                        : reportReady(r)
                          ? "Draf siap terbit"
                          : "Draf belum lengkap"}
                  </span>
                </div>
                {!s?.subjects.length ? (
                  <p className="text-sm text-muted-foreground">
                    Nilai rapor belum tersedia sesuai hak akses Anda.
                  </p>
                ) : (
                  <>
                    <TableRegion
                      label={
                        "Nilai " +
                        r.name +
                        " — gulir untuk melihat seluruh kolom"
                      }
                    >
                      <table className="w-full text-left text-sm">
                        <caption className="sr-only">
                          Rapor {r.name},{" "}
                          {kind === "combined" ? "gabungan" : kind}
                        </caption>
                        <thead>
                          <tr>
                            {(kind === "combined"
                              ? [
                                  "Mata pelajaran",
                                  "PH",
                                  "ATS",
                                  "ASAS",
                                  "Praktik",
                                  "Rapor",
                                  "KKM",
                                  "Predikat",
                                ]
                              : ["Mata pelajaran", kind, "KKM", "Predikat"]
                            ).map((x) => (
                              <th scope="col" className="p-3" key={x}>
                                {x}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {s.subjects.map((v) => {
                            const value = reportValue(v, kind);
                            return (
                              <tr key={v.subject_id}>
                                <th
                                  scope="row"
                                  className="min-w-40 max-w-72 break-words border-t p-3 font-medium"
                                >
                                  {v.name}
                                  {!v.complete && (
                                    <span className="block text-xs font-normal text-muted-foreground">
                                      Belum lengkap
                                    </span>
                                  )}
                                </th>
                                {(kind === "combined"
                                  ? [
                                      v.ph,
                                      v.ats,
                                      v.asas,
                                      v.practice,
                                      v.final,
                                      v.kkm,
                                      v.grade,
                                    ]
                                  : [
                                      value,
                                      v.kkm,
                                      value == null
                                        ? "—"
                                        : grade(Number(value), v.kkm),
                                    ]
                                ).map((n, i) => (
                                  <td
                                    key={i}
                                    className="border-t p-3 tabular-nums"
                                  >
                                    {n == null
                                      ? "—"
                                      : typeof n === "number"
                                        ? new Intl.NumberFormat("id-ID", {
                                            maximumFractionDigits: 2,
                                          }).format(n)
                                        : String(n)}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </TableRegion>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={disabled}
                      aria-label={"Unduh rapor " + r.name}
                      onClick={() => void download([r.student_id])}
                    >
                      Unduh rapor siswa
                    </Button>
                  </>
                )}
              </section>
            );
          })}
          {filtered.length > 0 && (
            <nav
              aria-label="Pagination rapor"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <span className="text-sm">
                {filtered.length} siswa · Halaman {Math.min(page, pages)} dari{" "}
                {pages}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled || page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Sebelumnya
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled || page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            </nav>
          )}
        </>
      )}
      <Dialog
        open={confirm}
        onOpenChange={(open) => {
          if (!busy && !blocked) setConfirm(open);
        }}
        title="Terbitkan rapor pilihan"
        description="Pastikan identitas dan seluruh komponen nilai benar. Rapor terbit menjadi arsip yang tidak dapat ditimpa."
        returnFocusRef={trigger}
        className="reports-dialog"
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (lock.current || disabled || !publishable || !ack) return;
            lock.current = true;
            try {
              await mutate(data.revision, {
                type: "publish",
                classId: filters.classId,
                semester: Number(filters.semester),
                studentIds: targets.map((r) => r.student_id),
              });
            } finally {
              lock.current = false;
            }
          }}
        >
          <p className="font-medium">
            {targets.length} rapor · {currentClass?.name} · {period?.label}
          </p>
          <ul
            tabIndex={0}
            aria-label="Siswa yang akan diterbitkan"
            className="max-h-40 space-y-1 overflow-y-auto text-sm"
          >
            {targets.map((r) => (
              <li key={r.student_id} className="break-words">
                {r.name}
              </li>
            ))}
          </ul>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0"
              required
              checked={ack}
              disabled={busy || blocked}
              onChange={(e) => setAck(e.target.checked)}
            />
            <span>
              Saya telah memeriksa komponen nilai dan identitas siswa.
            </span>
          </label>
          {message && <p role="status">{message}</p>}
          {blocked && (
            <Button type="button" onClick={() => window.location.reload()}>
              Muat ulang untuk memeriksa hasil
            </Button>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy || blocked}
              onClick={() => setConfirm(false)}
            >
              Batal
            </Button>
            <Button disabled={disabled || !ack || !publishable}>
              {busy ? "Menerbitkan…" : "Konfirmasi penerbitan"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
