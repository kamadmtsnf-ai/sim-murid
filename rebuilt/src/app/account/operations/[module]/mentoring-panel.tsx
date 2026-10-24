"use client";
import { Pagination, FilterBar } from "@/components/ui/collection-controls";
import { EmptyState } from "@/components/ui/content-state";
import { listenForUnsavedChanges } from "@/lib/forms/leave-guard";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TableRegion } from "@/components/ui/data-table";
import {
  controlClass,
  SelectField,
  TextField,
} from "@/components/domain-controls";
import { useDomainMutation } from "@/lib/education/use-mutation";
import { commandSchemas } from "@/lib/operations/validation";
import {
  mentoringFilters,
  mentoringSnapshot,
  type MentoringSnapshot,
} from "@/lib/operations/mentoring";
const api = "/api/operations/mentoring";
type Report = MentoringSnapshot["rows"][number];
export function MentoringPanel({ initial }: { initial: MentoringSnapshot }) {
  const [data, setData] = useState(initial),
    [filters, setFilters] = useState<Record<string, string>>({
      year: initial.today.slice(0, 4),
    }),
    [reading, setReading] = useState(false),
    [notice, setNotice] = useState("");
  const [mode, setMode] = useState<"report" | "assign" | null>(null),
    [edit, setEdit] = useState<Report | null>(null),
    [dirty, setDirty] = useState(false),
    [teacher, setTeacher] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [search, setSearch] = useState("");
  const [kind, setKind] = useState<"memorization" | "development">(
      "memorization",
    ),
    [catalog, setCatalog] = useState("");
  const lock = useRef(false),
    mounted = useRef(true),
    trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const params = (overrides: Record<string, string> = {}) =>
    new URLSearchParams({ ...filters, ...overrides }).toString();
  const { busy, blocked, message, phase, feedbackRef, clear, fail, mutate } =
    useDomainMutation(
      api + "?" + params(),
      mentoringSnapshot,
      "data",
      (next) => {
        if (
          (edit && !next.rows.some((row) => row.id === edit.id)) ||
          !next.canManage ||
          (mode === "assign" && !next.extra.canAssign)
        ) {
          trigger.current = document.getElementById("mentoring-filter");
        }
        setData(next);
        setMode(null);
        setEdit(null);
        setDirty(false);
        setNotice("");
      },
      { confirmed: true, commandSchema: commandSchemas.mentoring },
    );
  const disabled = reading || busy || blocked;
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty || busy) e.preventDefault();
    };
    const stopUnloadGuard = listenForUnsavedChanges(leave);
    return () => stopUnloadGuard();
  }, [dirty, busy]);
  const students = initial.people.filter((p) => p.role_code === "student"),
    teachers = initial.people.filter((p) => p.role_code === "teacher");
  // A replacement always includes the complete current assignment set, regardless of history/search.
  const candidates = [
    ...students.map((p) => ({
      id: p.id,
      name: p.full_name,
      username: p.username,
      active: true,
    })),
    ...data.extra.assignments
      .filter(
        (a) =>
          a.teacher_id === teacher &&
          !students.some((p) => p.id === a.student_id),
      )
      .map((a) => ({
        id: a.student_id,
        name: a.name,
        username: "Tidak ada dalam katalog siswa aktif",
        active: false,
      })),
  ];
  const reportStudents = students.filter(
    (p) =>
      data.isAdmin || data.extra.assignments.some((a) => a.student_id === p.id),
  );
  const visible = candidates.filter((p) =>
    (p.name + " " + p.username)
      .toLocaleLowerCase("id-ID")
      .includes(search.trim().toLocaleLowerCase("id-ID")),
  );
  function open(
    next: "report" | "assign",
    element: HTMLElement,
    row: Report | null = null,
  ) {
    if (disabled) return;
    trigger.current = element;
    setMode(next);
    setEdit(row);
    setDirty(false);
    setTeacher("");
    setSelected([]);
    setSearch("");
    setKind(row?.kind ?? "memorization");
    setCatalog(row?.catalog_id ?? "");
    clear();
  }
  function close() {
    if (busy) return;
    if (!dirty || window.confirm("Buang perubahan yang belum disimpan?")) {
      setMode(null);
      setEdit(null);
      setDirty(false);
      clear();
    }
  }
  function chooseTeacher(value: string) {
    if (
      dirty &&
      !window.confirm(
        "Ganti guru dan buang perubahan penugasan yang belum disimpan?",
      )
    )
      return;
    setTeacher(value);
    setSelected(
      data.extra.assignments
        .filter((a) => a.teacher_id === value)
        .map((a) => a.student_id),
    );
    setDirty(false);
    setSearch("");
    clear();
  }
  async function load(next: Record<string, string>) {
    if (lock.current || disabled || mode) return;
    lock.current = true;
    setReading(true);
    clear();
    setNotice("Memuat laporan…");
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 30000);
    try {
      const checked = mentoringFilters.parse(next);
      const response = await fetch(
        api +
          "?" +
          new URLSearchParams(
            Object.entries(checked).map(([k, v]) => [k, String(v)]),
          ),
        { cache: "no-store", signal: controller.signal },
      );
      if (!response.ok) throw Error("Unavailable");
      const snapshot = mentoringSnapshot.parse((await response.json()).data);
      if (mounted.current) {
        setData(snapshot);
        setFilters(next);
        setNotice("Laporan diperbarui.");
      }
    } catch {
      if (mounted.current)
        setNotice(
          "Laporan belum dapat dimuat. Periksa tanggal, akses, dan koneksi, lalu coba lagi.",
        );
    } finally {
      clearTimeout(timer);
      lock.current = false;
      if (mounted.current) setReading(false);
    }
  }
  async function save(command: unknown) {
    if (lock.current || disabled) return;
    const result = commandSchemas.mentoring.safeParse(command);
    if (!result.success) {
      fail(result.error.issues[0]?.message ?? "Periksa isian.");
      return;
    }
    lock.current = true;
    try {
      await mutate(data.revision, result.data);
    } finally {
      lock.current = false;
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      get = (k: string) => String(f.get(k) ?? "");
    if (mode === "assign") {
      if (!teacher) {
        fail("Pilih Guru Wali.");
        return;
      }
      if (
        selected.some((id) => {
          const assignment = data.extra.assignments.find(
            (a) => a.student_id === id,
          );
          return assignment && assignment.teacher_id !== teacher;
        })
      ) {
        fail("Lepaskan penugasan siswa pada guru sebelumnya terlebih dahulu.");
        return;
      }
      if (
        !selected.length &&
        !window.confirm("Kosongkan seluruh siswa bimbingan guru ini?")
      )
        return;
      void save({
        type: "assign",
        teacherId: teacher,
        studentIds: selected,
        assignTask: f.has("assignTask"),
      });
    } else {
      if (get("date") > data.today) {
        fail("Tanggal laporan tidak boleh melewati hari ini.");
        return;
      }
      if (
        catalog &&
        kind === "memorization" &&
        !data.extra.catalog.some((c) => c.id === catalog)
      ) {
        fail(
          "Master hafalan tidak aktif. Pilih master aktif atau Hafalan lainnya.",
        );
        return;
      }
      void save({
        type: "report",
        id: edit?.id ?? null,
        studentId: get("studentId"),
        date: get("date"),
        kind,
        catalogId: kind === "memorization" ? catalog || null : null,
        subject: get("subject"),
        predicate: kind === "memorization" ? get("predicate") : "",
        notes: get("notes"),
        ...(edit ? { reason: get("reason") } : {}),
      });
    }
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
        "Laporan dan penugasan ditampilkan sesuai hak akses Anda."}
      {blocked && (
        <Button
          className="mt-2"
          type="button"
          variant="outline"
          onClick={() => window.location.reload()}
        >
          Muat ulang data
        </Button>
      )}
    </div>
  );
  return (
    <div className="mentoring-panel min-w-0 space-y-6">
      {!mode && feedback}
      <section
        className="rounded-xl border bg-card p-4 sm:p-5"
        aria-labelledby="mentoring-actions"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="mentoring-actions" className="text-lg font-semibold">
              Bimbingan dan perkembangan siswa
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Guru Wali mendampingi siswa bimbingannya; penugasannya terpisah
              dari Wali Kelas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.canManage && (
              <Button
                disabled={disabled}
                onClick={(e) => open("report", e.currentTarget)}
              >
                Input laporan bimbingan
              </Button>
            )}
            {data.extra.canAssign && (
              <Button
                disabled={disabled}
                variant="outline"
                onClick={(e) => open("assign", e.currentTarget)}
              >
                Atur penugasan Guru Wali
              </Button>
            )}
          </div>
        </div>
      </section>
      <section
        className="rounded-xl border bg-card p-4 sm:p-5"
        aria-labelledby="mentoring-assignments"
      >
        <h2 id="mentoring-assignments" className="text-lg font-semibold">
          Penugasan Guru Wali
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.extra.assignments.length} siswa dalam penugasan yang dapat Anda
          lihat.
        </p>
        {data.extra.assignments.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.extra.assignments.map((a) => (
              <div key={a.id} className="min-w-0 rounded-lg border p-3">
                <h3 className="break-words font-medium">{a.name}</h3>
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  Guru Wali: {a.teacher_name}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed p-4 text-sm">
            Belum ada penugasan yang dapat ditampilkan.
          </p>
        )}
      </section>
      <section
        className="rounded-xl border bg-card p-4 sm:p-5"
        aria-labelledby="mentoring-filter"
      >
        <h2
          id="mentoring-filter"
          tabIndex={-1}
          className="text-lg font-semibold"
        >
          Filter laporan
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void load({
              ...Object.fromEntries(
                [...f]
                  .filter(([, v]) => String(v))
                  .map(([k, v]) => [k, String(v)]),
              ),
              page: "1",
            });
          }}
        >
          <FilterBar label="Filter laporan bimbingan" className="">
            <fieldset
              disabled={disabled}
              className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <label className="text-sm">
                Tahun kalender
                <input
                  className={controlClass}
                  name="year"
                  type="number"
                  min="2000"
                  max="2100"
                  defaultValue={filters.year}
                  required
                />
              </label>
              <TextField name="start" label="Dari tanggal" type="date" />
              <TextField name="end" label="Sampai tanggal" type="date" />
              <SelectField label="Siswa" name="studentId">
                <option value="">Semua siswa sesuai izin</option>
                {students.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} — {p.username}
                  </option>
                ))}
              </SelectField>
              <Button className="sm:col-span-2 lg:col-span-4" type="submit">
                {reading ? "Memuat…" : "Terapkan filter"}
              </Button>
            </fieldset>
          </FilterBar>
        </form>
      </section>
      <section className="min-w-0 space-y-3" aria-busy={reading}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">
            Riwayat laporan ({data.total})
          </h2>
          <div className="flex flex-wrap gap-3">
            <a
              className="inline-flex min-h-11 items-center underline"
              href={api + "?" + params({ format: "xlsx" })}
            >
              Ekspor Excel
            </a>
            <a
              className="inline-flex min-h-11 items-center underline"
              href={api + "?" + params({ format: "pdf" })}
            >
              Ekspor PDF
            </a>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Ekspor mengikuti periode, siswa, dan hak akses yang sama. Maksimal
          10.000 laporan; persempit periode bila diperlukan.
        </p>
        <TableRegion label="Laporan bimbingan — gulir untuk melihat seluruh kolom">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Laporan sesuai filter dan hak akses
            </caption>
            <thead>
              <tr>
                {[
                  "Tanggal",
                  "Siswa / Guru Wali",
                  "Jenis",
                  "Hafalan / aspek",
                  "Predikat",
                  "Catatan / perkembangan",
                  "Tindakan",
                ].map((h) => (
                  <th scope="col" key={h} className="border-b p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap border-b p-3">{r.date}</td>
                  <td className="min-w-40 max-w-64 break-words border-b p-3">
                    <p className="font-medium">{r.name}</p>
                    <p className="mt-1 text-muted-foreground">
                      {r.teacher_name}
                    </p>
                  </td>
                  <td className="border-b p-3">
                    {r.kind === "memorization"
                      ? "Setoran hafalan"
                      : "Perkembangan"}
                  </td>
                  <td className="max-w-56 break-words border-b p-3">
                    {r.subject}
                  </td>
                  <td className="border-b p-3">{r.predicate || "—"}</td>
                  <td className="max-w-xs whitespace-pre-wrap break-words border-b p-3">
                    {r.notes || "—"}
                  </td>
                  <td className="border-b p-3">
                    {r.can_edit ? (
                      <Button
                        variant="outline"
                        disabled={disabled}
                        onClick={(e) => open("report", e.currentTarget, r)}
                      >
                        Koreksi
                      </Button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
        {!data.rows.length && (
          <EmptyState title="Belum ada hasil">
            Belum ada laporan sesuai filter dan hak akses Anda.
          </EmptyState>
        )}
        <Pagination
          label="Halaman laporan bimbingan"
          page={data.page}
          pageCount={Math.max(1, Math.ceil(data.total / data.pageSize))}
          disabled={disabled}
          onPageChange={(page) => void load({ ...filters, page: String(page) })}
        />
      </section>
      <Dialog
        open={!!mode}
        onOpenChange={(value) => {
          if (!value) close();
        }}
        returnFocusRef={trigger}
        title={
          mode === "assign"
            ? "Penugasan Guru Wali"
            : edit
              ? "Koreksi laporan"
              : "Input laporan bimbingan"
        }
        description={
          mode === "assign"
            ? "Penyimpanan mengganti seluruh daftar siswa guru yang dipilih."
            : "Isi laporan sesuai jenis bimbingan. Koreksi dan pembatalan memerlukan alasan."
        }
        className="mentoring-dialog"
      >
        {mode && (
          <form
            key={mode + "-" + (edit?.id ?? "new")}
            onSubmit={submit}
            onChange={() => setDirty(true)}
            className="space-y-4"
          >
            <fieldset disabled={disabled} className="min-w-0 space-y-4">
              {mode === "assign" ? (
                <>
                  <label className="block text-sm">
                    Guru Wali
                    <select
                      className={controlClass}
                      value={teacher}
                      required
                      onChange={(e) => {
                        e.stopPropagation();
                        chooseTeacher(e.target.value);
                      }}
                    >
                      <option value="">Pilih Guru Wali</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {teacher && (
                    <>
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input
                          key={teacher}
                          type="checkbox"
                          name="assignTask"
                        />{" "}
                        Tetapkan juga tugas Guru Wali bila belum aktif
                      </label>
                      <label className="block text-sm">
                        Cari siswa
                        <input
                          className={controlClass}
                          value={search}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSearch(e.target.value);
                          }}
                          placeholder="Nama atau username"
                        />
                      </label>
                      <p className="text-sm">
                        {selected.length} siswa dipilih dari seluruh daftar.
                        Pencarian tidak mengubah pilihan.
                      </p>
                      <div className="space-y-2">
                        {visible.map((p) => {
                          const other = data.extra.assignments.find(
                            (a) =>
                              a.student_id === p.id && a.teacher_id !== teacher,
                          );
                          return (
                            <label
                              key={p.id}
                              className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm"
                            >
                              <input
                                className="mt-1 shrink-0"
                                type="checkbox"
                                checked={selected.includes(p.id)}
                                disabled={!!other}
                                onChange={(e) =>
                                  setSelected((prev) =>
                                    e.target.checked
                                      ? [...prev, p.id]
                                      : prev.filter((id) => id !== p.id),
                                  )
                                }
                              />
                              <span className="min-w-0 break-words">
                                {p.name}
                                <span className="mt-1 block text-muted-foreground">
                                  {other
                                    ? "Sudah dibimbing " + other.teacher_name
                                    : p.username}
                                  {!p.active
                                    ? " — periksa status siswa sebelum menyimpan"
                                    : ""}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      {!visible.length && (
                        <p className="text-sm">
                          Tidak ada siswa sesuai pencarian.
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Siswa yang masih ditugaskan kepada guru lain harus
                        dilepaskan terlebih dahulu. Maksimal 500 siswa per guru.
                        Pilihan siswa di luar katalog aktif tetap ditampilkan
                        agar tidak terlepas tanpa sengaja.
                      </p>
                    </>
                  )}
                </>
              ) : (
                <>
                  <SelectField
                    label="Siswa"
                    name="studentId"
                    value={edit?.student_id}
                    required
                  >
                    <option value="">Pilih siswa</option>
                    {reportStudents.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} — {p.username}
                      </option>
                    ))}
                    {edit &&
                      !reportStudents.some((p) => p.id === edit.student_id) && (
                        <option value={edit.student_id}>
                          {edit.name} (catatan lama)
                        </option>
                      )}
                  </SelectField>
                  <label className="block text-sm">
                    Tanggal laporan
                    <input
                      name="date"
                      type="date"
                      className={controlClass}
                      min="2000-01-01"
                      max={data.today}
                      defaultValue={edit?.date ?? data.today}
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    Jenis laporan
                    <select
                      className={controlClass}
                      value={kind}
                      onChange={(e) => {
                        setKind(e.target.value as typeof kind);
                        setCatalog("");
                      }}
                    >
                      <option value="memorization">Setoran hafalan</option>
                      <option value="development">Laporan perkembangan</option>
                    </select>
                  </label>
                  {kind === "memorization" && (
                    <label className="block text-sm">
                      Master hafalan
                      <select
                        className={controlClass}
                        value={catalog}
                        onChange={(e) => setCatalog(e.target.value)}
                      >
                        <option value="">Hafalan lainnya</option>
                        {data.extra.catalog.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                        {catalog &&
                          !data.extra.catalog.some((c) => c.id === catalog) && (
                            <option value={catalog}>
                              Master tidak aktif — pilih ulang
                            </option>
                          )}
                      </select>
                    </label>
                  )}
                  {(kind === "development" || !catalog) && (
                    <TextField
                      label={
                        kind === "development"
                          ? "Aspek perkembangan"
                          : "Nama hafalan lainnya"
                      }
                      name="subject"
                      value={edit?.subject}
                      required
                      max={200}
                    />
                  )}{" "}
                  {kind === "memorization" && (
                    <TextField
                      label="Predikat hafalan"
                      name="predicate"
                      value={edit?.predicate}
                      required
                      max={100}
                    />
                  )}
                  <label className="block text-sm">
                    {kind === "development"
                      ? "Deskripsi perkembangan"
                      : "Catatan hafalan"}
                    <textarea
                      className={controlClass}
                      name="notes"
                      defaultValue={edit?.notes ?? ""}
                      required={kind === "development"}
                      maxLength={4000}
                      rows={4}
                    />
                  </label>
                  {edit && (
                    <label className="block text-sm">
                      Alasan koreksi / pembatalan
                      <input
                        className={controlClass}
                        name="reason"
                        minLength={3}
                        maxLength={2000}
                        required
                      />
                    </label>
                  )}
                </>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={
                    mode === "assign" && (!teacher || selected.length > 500)
                  }
                >
                  {busy
                    ? "Menyimpan…"
                    : mode === "assign"
                      ? "Simpan penugasan"
                      : edit
                        ? "Simpan koreksi"
                        : "Simpan laporan"}
                </Button>
                {edit && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={(e) => {
                      const form = e.currentTarget.closest("form");
                      if (!form) return;
                      const reason = String(
                        new FormData(form).get("reason") ?? "",
                      ).trim();
                      if (reason.length < 3) {
                        fail("Isi alasan pembatalan minimal 3 karakter.");
                        return;
                      }
                      if (window.confirm("Batalkan laporan ini?"))
                        void save({ type: "void", id: edit.id, reason });
                    }}
                  >
                    Batalkan laporan
                  </Button>
                )}
              </div>
            </fieldset>
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
