"use client";
import { BulkImport } from "@/components/bulk/bulk-import";
import { Pagination } from "@/components/ui/collection-controls";
import { listenForUnsavedChanges } from "@/lib/forms/leave-guard";
import { AcademicContextBar } from "@/components/academic/academic-context";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TableRegion } from "@/components/ui/data-table";
import { controlClass } from "@/components/domain-controls";
import { useDomainMutation } from "@/lib/education/use-mutation";
import { commands } from "@/lib/learning/validation";
import {
  gradesSnapshot,
  gradeFilters,
  gradeInputScore,
  gradeRoster,
  gradeDraft,
  type GradesSnapshot,
  type Assessment,
  type EntryPerson,
} from "@/lib/learning/grades";
import {
  formatAcademicYear,
  semesterLabel,
  semesterPeriod,
  defaultSemesterDate,
} from "@/lib/academic/period";
const api = "/api/learning/grades",
  kinds = ["PH", "ATS", "ASAS", "Praktik"] as const;
type Scope = { classId: string; subjectId: string; semester: number };
export function GradesPanel({
  initial,
  bulkAvailable = false,
}: {
  initial: GradesSnapshot;
  bulkAvailable?: boolean;
}) {
  const [data, setData] = useState(initial),
    [filters, setFilters] = useState<Record<string, string>>({
      semester: String(initial.semester),
    }),
    [reading, setReading] = useState(false),
    [notice, setNotice] = useState("");
  const [mode, setMode] = useState<"batch" | "kkm" | "void" | null>(null),
    [edit, setEdit] = useState<Assessment | null>(null),
    [target, setTarget] = useState<Assessment | null>(null),
    [scope, setScope] = useState<Scope | null>(null),
    [context, setContext] = useState<GradesSnapshot | null>(null),
    [contextBusy, setContextBusy] = useState(false),
    [contextError, setContextError] = useState(""),
    [dirty, setDirty] = useState(false);
  const [kind, setKind] = useState<Assessment["kind"]>("PH"),
    [date, setDate] = useState(""),
    [roster, setRoster] = useState<EntryPerson[]>([]),
    [draft, setDraft] = useState<
      Record<string, { value: string; notes: string }>
    >({}),
    [entrySearch, setEntrySearch] = useState(""),
    [entryPage, setEntryPage] = useState(1);
  const [historyKind, setHistoryKind] = useState(""),
    [ph, setPh] = useState(""),
    [historySearch, setHistorySearch] = useState(""),
    [historyPage, setHistoryPage] = useState(1);
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
  const { busy, blocked, message, phase, feedbackRef, clear, fail, mutate } =
    useDomainMutation(
      api + "?" + query(),
      gradesSnapshot,
      "data",
      (next) => {
        setData(next);
        setMode(null);
        setEdit(null);
        setTarget(null);
        setDirty(false);
        setHistoryPage(1);
        trigger.current = document.getElementById("grades-filter");
      },
      { confirmed: true, commandSchema: commands.grades },
    );
  const disabled = busy || reading || contextBusy || blocked;
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty || busy) e.preventDefault();
    };
    const stopUnloadGuard = listenForUnsavedChanges(leave);
    return () => stopUnloadGuard();
  }, [dirty, busy]);
  const selectedClass = data.classes.find((c) => c.id === filters.classId),
    selectedPeriod = semesterPeriod(selectedClass?.year, filters.semester);
  const entryClass = context?.classes.find((c) => c.id === scope?.classId),
    period = semesterPeriod(entryClass?.year, scope?.semester),
    entryAllowed =
      !!context?.canWrite &&
      !entryClass?.archived_at &&
      (!target || target.can_edit);
  const visibleRoster = roster.filter((p) =>
      (p.full_name + " " + p.username)
        .toLocaleLowerCase("id-ID")
        .includes(entrySearch.trim().toLocaleLowerCase("id-ID")),
    ),
    entryRows = visibleRoster.slice((entryPage - 1) * 20, entryPage * 20);
  const visibleScores = (r: Assessment) =>
    r.scores.filter(
      (s) => !filters.studentId || s.student_id === filters.studentId,
    );
  const scopedRows = data.rows.filter(
    (r) =>
      !filters.studentId ||
      r.scores.some((s) => s.student_id === filters.studentId),
  );
  const history = scopedRows.filter(
    (r) =>
      (!historyKind || r.kind === historyKind) &&
      (!ph || String(r.ph_number) === ph) &&
      (
        r.subject_name +
        " " +
        r.kind +
        " " +
        visibleScores(r)
          .map((s) => s.name)
          .join(" ")
      )
        .toLocaleLowerCase("id-ID")
        .includes(historySearch.trim().toLocaleLowerCase("id-ID")),
  );
  function hydrate(
    ctx: GradesSnapshot,
    row: Assessment | null,
    activeKind: Assessment["kind"],
  ) {
    const people = gradeRoster(ctx, row);
    setTarget(row);
    setRoster(people);
    setDraft(gradeDraft(people, row));
    setKind(activeKind);
    setDate(
      row?.assessment_date ??
        defaultSemesterDate(
          ctx.classes.find((c) => c.id === ctx.extra.scope?.classId)?.year,
          ctx.semester,
          ctx.today,
        ),
    );
    setEntryPage(1);
    setEntrySearch("");
  }
  async function prepare(next: Scope, row: Assessment | null) {
    if (lock.current) return;
    lock.current = true;
    setContextBusy(true);
    setContextError("");
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 30000);
    try {
      const reuse =
        data.extra.scope?.classId === next.classId &&
        data.extra.scope?.subjectId === next.subjectId &&
        data.semester === next.semester;
      let ctx = data;
      if (!reuse) {
        const r = await fetch(
          api +
            "?" +
            query({
              classId: next.classId,
              subjectId: next.subjectId,
              semester: String(next.semester),
            }),
          { cache: "no-store", signal: abort.signal },
        );
        if (!r.ok) throw Error();
        ctx = gradesSnapshot.parse((await r.json()).data);
      }
      if (
        ctx.revision !== data.revision ||
        ctx.semester !== next.semester ||
        ctx.extra.scope?.classId !== next.classId ||
        ctx.extra.scope?.subjectId !== next.subjectId
      )
        throw Error("Context changed");
      const current = row ? ctx.rows.find((r) => r.id === row.id) : null;
      if (row && !current) throw Error("Assessment missing");
      if (mounted.current) {
        setContext(ctx);
        hydrate(ctx, current ?? null, current?.kind ?? "PH");
      }
    } catch {
      if (mounted.current)
        setContextError(
          "Konteks penilaian belum dapat dimuat atau sudah berubah. Muat ulang konteks; bila berulang, muat ulang halaman.",
        );
    } finally {
      clearTimeout(timeout);
      controller.current = null;
      lock.current = false;
      if (mounted.current) setContextBusy(false);
    }
  }
  function open(
    next: NonNullable<typeof mode>,
    element: HTMLElement,
    row: Assessment | null = null,
  ) {
    if (disabled || lock.current) return;
    trigger.current = element;
    setMode(next);
    setEdit(row);
    setTarget(null);
    setContext(null);
    setContextError("");
    setDirty(false);
    setRoster([]);
    setDraft({});
    clear();
    if (next === "void") return;
    const contextScope = row
      ? {
          classId: row.class_id,
          subjectId: row.subject_id,
          semester: row.semester,
        }
      : filters.classId && filters.subjectId
        ? {
            classId: filters.classId,
            subjectId: filters.subjectId,
            semester: Number(filters.semester),
          }
        : null;
    setScope(contextScope);
    if (contextScope) void prepare(contextScope, row);
    else
      setContextError(
        "Pilih kelas, mapel dan semester, lalu tampilkan data terlebih dahulu.",
      );
  }
  function close() {
    if (busy) return;
    if (
      !dirty ||
      window.confirm("Buang perubahan nilai yang belum disimpan?")
    ) {
      controller.current?.abort();
      setMode(null);
      setEdit(null);
      setTarget(null);
      setDirty(false);
      clear();
    }
  }
  async function load(next: Record<string, string>) {
    if (lock.current || disabled || mode) return;
    lock.current = true;
    setReading(true);
    setNotice("Memuat penilaian…");
    clear();
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 30000);
    try {
      const f = gradeFilters.parse(next),
        r = await fetch(
          api +
            "?" +
            new URLSearchParams(
              Object.entries(f).map(([k, v]) => [k, String(v)]),
            ),
          { cache: "no-store", signal: abort.signal },
        );
      if (!r.ok) throw Error();
      const value = gradesSnapshot.parse((await r.json()).data);
      if (
        (f.classId && !value.classes.some((c) => c.id === f.classId)) ||
        value.semester !== f.semester ||
        value.extra.scope?.classId !== f.classId ||
        value.extra.scope?.subjectId !== f.subjectId ||
        value.extra.scope?.studentId !== f.studentId
      )
        throw Error("Academic scope not confirmed");
      if (mounted.current) {
        setData(value);
        setFilters(next);
        setHistoryPage(1);
        setNotice("Data penilaian diperbarui.");
      }
    } catch {
      if (mounted.current)
        setNotice(
          "Data belum dapat dimuat. Periksa pilihan, akses dan koneksi. Data sebelumnya tetap ditampilkan.",
        );
    } finally {
      clearTimeout(timeout);
      controller.current = null;
      lock.current = false;
      if (mounted.current) setReading(false);
    }
  }
  function changeKind(next: Assessment["kind"]) {
    if (!context || !scope) return;
    if (
      dirty &&
      !window.confirm(
        "Ganti jenis penilaian dan buang isian yang belum disimpan?",
      )
    )
      return;
    const existing =
      next === "PH"
        ? null
        : (context.rows.find(
            (r) =>
              r.class_id === scope.classId &&
              r.subject_id === scope.subjectId &&
              r.semester === scope.semester &&
              r.kind === next,
          ) ?? null);
    hydrate(context, existing, next);
    setDirty(false);
    clear();
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current || disabled) return;
    const f = new FormData(e.currentTarget),
      reason = String(f.get("reason") ?? "").trim();
    let command: unknown;
    if (mode === "void" && edit) {
      if (reason.length < 3) {
        fail("Isi alasan pembatalan minimal 3 karakter.");
        return;
      }
      if (
        !window.confirm(
          "Batalkan penilaian ini? Nomor PH tidak digunakan kembali dan rapor yang sudah terbit tetap dipertahankan.",
        )
      )
        return;
      command = { type: "void", id: edit.id, reason };
    } else {
      if (!context || !scope || !period || !entryAllowed) {
        fail("Konteks atau izin penulisan belum tersedia.");
        return;
      }
      if (date < period.start || date > period.end) {
        fail("Tanggal harus berada dalam tahun ajaran dan semester penilaian.");
        return;
      }
      if (mode === "kkm") {
        const value = Number(f.get("value"));
        if (
          !window.confirm(
            `Simpan KKM ${value} untuk ${entryClass?.name}, ${semesterLabel(scope.semester)} ${formatAcademicYear(entryClass?.year)}? KKM pada penilaian lama dan rapor terbit tidak diubah. Rapor draf mengikuti KKM periode.`,
          )
        )
          return;
        command = {
          type: "kkm",
          classId: scope.classId,
          subjectId: scope.subjectId,
          date,
          value,
        };
      } else {
        if (!roster.length || roster.length > 500) {
          fail(
            "Pencatatan memerlukan 1–500 siswa. Periksa daftar kelas sebelum menyimpan.",
          );
          return;
        }
        const items = roster.map((p) => ({
          studentId: p.id,
          value:
            (draft[p.id]?.value ?? "").trim() === ""
              ? null
              : Number(draft[p.id]?.value),
          notes: draft[p.id]?.notes ?? "",
        }));
        if (
          items.some(
            (item) =>
              item.value !== null &&
              !gradeInputScore.safeParse(item.value).success,
          )
        ) {
          fail(
            "Gunakan nilai 0–100 dengan maksimal 2 angka desimal pada seluruh siswa, termasuk halaman yang tidak ditampilkan.",
          );
          return;
        }
        if (target && reason.length < 3) {
          fail("Isi alasan koreksi minimal 3 karakter.");
          return;
        }
        if (
          target &&
          !window.confirm(
            "Simpan koreksi " +
              target.kind +
              " ini? Isian yang ditampilkan akan diperbarui, termasuk nilai kosong.",
          )
        )
          return;
        if (
          items.every((i) => i.value === null) &&
          !window.confirm(
            "Semua nilai masih kosong. Simpan penilaian yang belum diisi?",
          )
        )
          return;
        command = {
          type: "batch",
          id: target?.id ?? null,
          classId: scope.classId,
          subjectId: scope.subjectId,
          date,
          kind,
          items,
          ...(target ? { reason } : {}),
        };
      }
    }
    await mutate(data.revision, command);
  }
  const feedback = (
    <div
      ref={feedbackRef}
      tabIndex={-1}
      role={phase === "error" || blocked ? "alert" : "status"}
      className="rounded-lg border bg-muted/30 p-3 text-sm"
    >
      {message ||
        notice ||
        "Penilaian ditampilkan sesuai kelas, mapel, semester dan hak akses Anda."}
      {blocked && (
        <Button
          type="button"
          variant="outline"
          className="mt-2"
          onClick={() => window.location.reload()}
        >
          Muat ulang data
        </Button>
      )}
    </div>
  );
  return (
    <div className="grades-panel min-w-0 space-y-6" aria-busy={reading || busy}>
      <AcademicContextBar
        current={{
          year: selectedClass?.year ?? null,
          classId: filters.classId ?? null,
          semester: Number(filters.semester),
        }}
        catalog={{
          years: data.classes.map((c) => c.year),
          classes: data.classes,
        }}
        requiresClass
        disabled={disabled || !!mode}
        onApply={(value) =>
          load({ classId: value.classId!, semester: String(value.semester) })
        }
      />
      {!mode && feedback}
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">
              Penilaian siswa dan kriteria ketuntasan
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              PH 20% + ATS 30% + ASAS 50%. Praktik disajikan terpisah. Nilai 0
              sah; kosong berarti belum diisi.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.canWrite && filters.classId && filters.subjectId && (
              <>
                <Button
                  disabled={disabled}
                  onClick={(e) => open("batch", e.currentTarget)}
                >
                  Input nilai
                </Button>
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={(e) => open("kkm", e.currentTarget)}
                >
                  Atur KKM
                </Button>
              </>
            )}
          </div>
        </div>
      </section>
      <section
        className="rounded-xl border bg-card p-4 sm:p-5"
        aria-labelledby="grades-filter"
      >
        <h2 id="grades-filter" tabIndex={-1} className="text-lg font-semibold">
          Filter penilaian
        </h2>
        <form
          key={JSON.stringify(filters)}
          onSubmit={(e) => {
            e.preventDefault();
            void load(
              Object.fromEntries(
                [...new FormData(e.currentTarget)]
                  .filter(([, v]) => String(v))
                  .map(([k, v]) => [k, String(v)]),
              ),
            );
          }}
        >
          <fieldset
            disabled={disabled}
            className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <label className="text-sm">
              Kelas / tahun ajaran
              <select
                name="classId"
                className={controlClass}
                defaultValue={filters.classId ?? ""}
              >
                <option value="">Semua sesuai izin</option>
                {data.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {formatAcademicYear(c.year)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Mata pelajaran
              <select
                name="subjectId"
                className={controlClass}
                defaultValue={filters.subjectId ?? ""}
              >
                <option value="">Semua sesuai izin</option>
                {data.extra.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Semester
              <select
                name="semester"
                className={controlClass}
                defaultValue={String(data.semester)}
              >
                <option value="1">Ganjil (Juli–Desember)</option>
                <option value="2">Genap (Januari–Juni)</option>
              </select>
            </label>
            <label className="text-sm">
              Siswa dalam laporan
              <select
                name="studentId"
                className={controlClass}
                defaultValue={filters.studentId ?? ""}
              >
                <option value="">Semua sesuai izin</option>
                {[...new Map(data.people.map((p) => [p.id, p])).values()].map(
                  (p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ),
                )}
              </select>
            </label>
            <Button className="sm:col-span-2 lg:col-span-4" type="submit">
              {reading ? "Memuat…" : "Tampilkan"}
            </Button>
          </fieldset>
        </form>
        <p className="mt-3 text-sm text-muted-foreground">
          {selectedClass && selectedPeriod
            ? `${selectedClass.name} · ${formatAcademicYear(selectedClass.year)} · ${selectedPeriod.label}`
            : "Pilih kelas dan mata pelajaran, lalu tampilkan data untuk melakukan input."}
        </p>
      </section>
      {bulkAvailable && data.canWrite && selectedClass && filters.subjectId ? (
        <BulkImport
          key={`${selectedClass.id}:${filters.subjectId}`}
          domain="grades"
          disabled={disabled || !!mode}
          classes={[
            {
              id: selectedClass.id,
              label: `${selectedClass.name} · ${formatAcademicYear(selectedClass.year)}`,
            },
          ]}
          semester={data.semester === 1 ? 1 : 2}
          subjectId={filters.subjectId}
          subjectLabel={
            data.extra.subjects.find((s) => s.id === filters.subjectId)?.name
          }
          onFinished={() => void load(filters)}
        />
      ) : null}
      <section
        aria-label="Ringkasan penilaian"
        className="grid min-w-0 gap-3 sm:grid-cols-3"
      >
        {[
          ["Penilaian dalam laporan", scopedRows.length],
          [
            "Nilai terisi",
            scopedRows.reduce(
              (n, r) =>
                n + visibleScores(r).filter((s) => s.value !== null).length,
              0,
            ),
          ],
          [
            "Nilai belum diisi",
            scopedRows.reduce(
              (n, r) =>
                n + visibleScores(r).filter((s) => s.value === null).length,
              0,
            ),
          ],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>
      {filters.classId && filters.subjectId && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">
            KKM periode dipilih: {data.extra.kkm ?? 75}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.extra.kkm === null
              ? "Belum ditetapkan; nilai baru memakai KKM bawaan 75."
              : "KKM berlaku untuk penilaian baru dan rapor yang masih draf pada periode ini."}{" "}
            Setiap penilaian mempertahankan KKM saat dibuat; perubahan KKM tidak
            menulis ulang nilai lama atau rapor terbit.
          </p>
        </section>
      )}
      <section className="min-w-0 space-y-4" aria-busy={reading}>
        <h2 className="text-xl font-semibold">Riwayat penilaian</h2>
        <div className="grid min-w-0 gap-3 sm:grid-cols-3">
          <label className="text-sm">
            Cari mapel atau nama siswa
            <input
              value={historySearch}
              onChange={(e) => {
                setHistorySearch(e.target.value);
                setHistoryPage(1);
              }}
              className={controlClass}
              maxLength={100}
            />
          </label>
          <label className="text-sm">
            Jenis penilaian di riwayat
            <select
              value={historyKind}
              onChange={(e) => {
                setHistoryKind(e.target.value);
                setHistoryPage(1);
              }}
              className={controlClass}
            >
              <option value="">Semua</option>
              {kinds.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Nomor PH
            <input
              type="number"
              min={1}
              step={1}
              value={ph}
              onChange={(e) => {
                setPh(e.target.value);
                setHistoryPage(1);
              }}
              className={controlClass}
            />
          </label>
        </div>
        {history.slice((historyPage - 1) * 10, historyPage * 10).map((row) => {
          const cls = data.classes.find((c) => c.id === row.class_id);
          return (
            <article
              key={row.id}
              className="min-w-0 space-y-3 rounded-xl border bg-card p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-semibold">
                    {row.subject_name} · {row.kind}
                    {row.ph_number !== null ? " " + row.ph_number : ""}
                  </h3>
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {cls?.name} · {formatAcademicYear(cls?.year)} ·{" "}
                    {semesterLabel(row.semester)} · {row.assessment_date}
                  </p>
                </div>
                <p className="text-sm">
                  KKM saat dinilai: <strong>{row.kkm_snapshot}</strong>
                  {row.kkm_fallback ? " (bawaan)" : ""}
                </p>
              </div>
              <details>
                <summary className="min-h-11 cursor-pointer py-2 font-medium">
                  Rincian nilai ({visibleScores(row).length} siswa)
                </summary>
                <TableRegion
                  label={
                    "Nilai " +
                    row.kind +
                    " " +
                    row.subject_name +
                    " — gulir untuk seluruh kolom"
                  }
                >
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">
                      Nilai {row.kind} {row.subject_name}
                    </caption>
                    <thead>
                      <tr>
                        {["Siswa", "Nilai", "Catatan"].map((h) => (
                          <th scope="col" key={h} className="border-b p-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleScores(row).map((s) => (
                        <tr key={s.student_id}>
                          <td className="min-w-40 max-w-xs break-words border-b p-3">
                            {s.name}
                          </td>
                          <td className="whitespace-nowrap border-b p-3">
                            {s.value === null ? "Belum diisi" : s.value}
                          </td>
                          <td className="min-w-40 max-w-sm whitespace-pre-wrap break-words border-b p-3">
                            {s.notes || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableRegion>
              </details>
              {row.can_edit && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={disabled}
                    onClick={(e) => open("batch", e.currentTarget, row)}
                  >
                    Koreksi {row.kind}
                    {row.ph_number !== null ? " " + row.ph_number : ""}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={disabled}
                    onClick={(e) => open("void", e.currentTarget, row)}
                  >
                    Batalkan penilaian
                  </Button>
                </div>
              )}
            </article>
          );
        })}
        {!history.length && (
          <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            Belum ada penilaian sesuai pilihan dan hak akses Anda.
          </p>
        )}
        <Pagination
          label="Halaman riwayat penilaian"
          page={historyPage}
          pageCount={Math.max(1, Math.ceil(history.length / 10))}
          onPageChange={setHistoryPage}
          previousLabel="Penilaian sebelumnya"
          nextLabel="Penilaian berikutnya"
        />
      </section>
      <Dialog
        open={mode !== null}
        onOpenChange={(v) => {
          if (!v) close();
        }}
        returnFocusRef={trigger}
        className="grades-dialog"
        title={
          mode === "kkm"
            ? "Atur KKM"
            : mode === "void"
              ? "Batalkan penilaian"
              : target
                ? "Koreksi penilaian"
                : "Input nilai"
        }
        description="Periksa kelas, mapel, semester dan isian sebelum menyimpan. Nilai kosong berbeda dari nilai 0."
      >
        {mode && (
          <form
            onSubmit={(e) => void submit(e)}
            onChange={(e) => {
              if (!(e.target as HTMLElement).hasAttribute("data-view-control"))
                setDirty(true);
            }}
            className="space-y-4"
          >
            <fieldset disabled={disabled} className="min-w-0 space-y-4">
              {mode === "void" ? (
                <>
                  <p className="break-words text-sm">
                    {edit?.subject_name} · {edit?.kind} ·{" "}
                    {edit?.assessment_date}
                  </p>
                  <label className="block text-sm">
                    Alasan pembatalan
                    <textarea
                      name="reason"
                      minLength={3}
                      maxLength={2000}
                      rows={3}
                      className={controlClass}
                      required
                    />
                  </label>
                </>
              ) : (
                <>
                  {context && scope && (
                    <p className="break-words rounded-lg border p-3 text-sm">
                      {entryClass?.name} ·{" "}
                      {target?.subject_name ??
                        context.extra.subjects.find(
                          (s) => s.id === scope.subjectId,
                        )?.name ??
                        "Mapel penilaian"}{" "}
                      · {formatAcademicYear(entryClass?.year)} ·{" "}
                      {semesterLabel(scope.semester)}
                    </p>
                  )}
                  {context && !entryAllowed && (
                    <p role="alert">
                      Penulisan penilaian ini tidak diizinkan atau kelas sudah
                      diarsipkan. Muat ulang data untuk memeriksa hak akses.
                    </p>
                  )}
                  <fieldset
                    disabled={!context || !entryAllowed}
                    className="min-w-0 space-y-4"
                  >
                    <label className="block text-sm">
                      Tanggal penilaian / periode KKM
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        min={period?.start}
                        max={period?.end}
                        className={controlClass}
                        required
                      />
                    </label>
                    {mode === "kkm" ? (
                      <>
                        <label className="block text-sm">
                          KKM (0–100)
                          <input
                            key={
                              context?.revision + "-" + (scope?.classId ?? "")
                            }
                            name="value"
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            defaultValue={context?.extra.kkm ?? 75}
                            className={controlClass}
                            required
                          />
                        </label>
                        <p className="text-sm text-muted-foreground">
                          Perubahan berlaku untuk penilaian baru dan rapor yang
                          masih draf. KKM penilaian lama dan arsip rapor tetap
                          dipertahankan.
                        </p>
                      </>
                    ) : (
                      <>
                        <label className="block text-sm">
                          Jenis penilaian
                          <select
                            value={kind}
                            onChange={(e) =>
                              changeKind(e.target.value as Assessment["kind"])
                            }
                            disabled={!!edit}
                            className={controlClass}
                          >
                            {kinds.map((k) => (
                              <option key={k}>{k}</option>
                            ))}
                          </select>
                        </label>
                        {target && (
                          <p
                            role="status"
                            className="rounded-lg border p-3 text-sm"
                          >
                            {target.kind} sudah ada. Form memuat nilai yang
                            tersimpan; penyimpanan merupakan koreksi dan
                            memerlukan alasan. KKM saat dinilai:{" "}
                            {target.kkm_snapshot}.
                          </p>
                        )}
                        <label className="block text-sm">
                          Cari siswa dalam formulir
                          <input
                            data-view-control="true"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            value={entrySearch}
                            onChange={(e) => {
                              setEntrySearch(e.target.value);
                              setEntryPage(1);
                            }}
                            maxLength={100}
                            className={controlClass}
                          />
                        </label>
                        <p className="text-sm text-muted-foreground">
                          {roster.length} siswa dalam batch. Pencarian dan
                          halaman hanya mengubah tampilan; seluruh isian tetap
                          disimpan. Batas 500 siswa per batch.
                        </p>
                        {entryRows.map((p) => (
                          <div
                            key={p.id}
                            className="grid min-w-0 gap-2 rounded-lg border p-3 sm:grid-cols-2"
                          >
                            <p className="break-words font-medium sm:col-span-2">
                              {p.full_name}
                            </p>
                            <label className="text-sm">
                              Nilai {p.full_name}
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={draft[p.id]?.value ?? ""}
                                onChange={(e) =>
                                  setDraft((d) => ({
                                    ...d,
                                    [p.id]: {
                                      value: e.target.value,
                                      notes: d[p.id]?.notes ?? "",
                                    },
                                  }))
                                }
                                className={controlClass}
                              />
                            </label>
                            <label className="text-sm">
                              Catatan {p.full_name}
                              <input
                                value={draft[p.id]?.notes ?? ""}
                                onChange={(e) =>
                                  setDraft((d) => ({
                                    ...d,
                                    [p.id]: {
                                      value: d[p.id]?.value ?? "",
                                      notes: e.target.value,
                                    },
                                  }))
                                }
                                maxLength={2000}
                                className={controlClass}
                              />
                            </label>
                          </div>
                        ))}
                        {!entryRows.length && (
                          <p className="rounded-lg border border-dashed p-4 text-sm">
                            Belum ada siswa sesuai pencarian atau daftar kelas.
                          </p>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={entryPage <= 1}
                            onClick={() => setEntryPage((p) => p - 1)}
                          >
                            Siswa sebelumnya
                          </Button>
                          <span className="text-sm">
                            Halaman siswa {entryPage} dari{" "}
                            {Math.max(1, Math.ceil(visibleRoster.length / 20))}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={entryPage * 20 >= visibleRoster.length}
                            onClick={() => setEntryPage((p) => p + 1)}
                          >
                            Siswa berikutnya
                          </Button>
                        </div>
                        {target && (
                          <label className="block text-sm">
                            Alasan koreksi
                            <textarea
                              key={target?.id}
                              name="reason"
                              minLength={3}
                              maxLength={2000}
                              rows={2}
                              className={controlClass}
                              required
                            />
                          </label>
                        )}
                      </>
                    )}
                  </fieldset>
                </>
              )}
              <Button
                type="submit"
                disabled={mode !== "void" && (!context || !entryAllowed)}
              >
                {busy
                  ? "Menyimpan…"
                  : mode === "void"
                    ? "Konfirmasi pembatalan"
                    : mode === "kkm"
                      ? "Simpan KKM"
                      : target
                        ? "Simpan koreksi"
                        : "Simpan nilai"}
              </Button>
            </fieldset>
            {contextBusy && (
              <p role="status" className="text-sm">
                Memuat konteks penilaian…
              </p>
            )}
            {contextError && (
              <div role="alert" className="space-y-2 text-sm">
                <p>{contextError}</p>
                {scope && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => void prepare(scope, edit)}
                  >
                    Muat ulang konteks
                  </Button>
                )}
              </div>
            )}
            {feedback}
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={close}
            >
              Tutup
            </Button>
          </form>
        )}
      </Dialog>
    </div>
  );
}
