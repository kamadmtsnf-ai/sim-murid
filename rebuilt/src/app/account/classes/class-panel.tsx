"use client";
import {confirmAction} from "@/components/ui/confirm-action";
import { BulkImport } from "@/components/bulk/bulk-import";
import { FilterBar } from "@/components/ui/collection-controls";
import { AcademicContextBar } from "@/components/academic/academic-context";
import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import { formatAcademicYear, semesterPeriod } from "@/lib/academic/period";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
  SelectField,
  TextField,
  controlClass,
} from "@/components/domain-controls";
import { Status } from "@/components/ui/status";
import { classCommand, classSnapshot } from "@/lib/education/validation";
import { useDomainMutation } from "@/lib/education/use-mutation";
type Snapshot = z.infer<typeof classSnapshot>;
export function ClassPanel({
  initial,
  bulkAvailable = false,
}: {
  initial: Snapshot;
  bulkAvailable?: boolean;
}) {
  const classOpener = useRef<HTMLButtonElement>(null),
    rosterHeading = useRef<HTMLHeadingElement>(null);
  const [data, setData] = useState(initial),
    [year, setYear] = useState(
      initial.years.find((y) => y.is_active)?.id ?? initial.years[0]?.id ?? "",
    );
  const [classOpen, setClassOpen] = useState(false),
    [dirty, setDirty] = useState(false),
    [editing, setEditing] = useState<string | null>(null);
  const [roster, setRoster] = useState(""),
    [search, setSearch] = useState(""),
    [studentSearch, setStudentSearch] = useState("");
  const [chosen, setChosen] = useState<string[]>([]),
    [startsOn, setStartsOn] = useState("");
  function clearPlacement() {
    setChosen([]);
    setStartsOn("");
    setStudentSearch("");
  }
  const mutation = useDomainMutation(
    "/api/classes",
    classSnapshot,
    "classes",
    (next, raw) => {
      const command = classCommand.parse(raw);
      setData(next);
      setClassOpen(false);
      setEditing(null);
      setDirty(false);
      if (command.type === "year") {
        setYear(
          next.years.find((y) => y.start_year === command.startYear)?.id ?? "",
        );
        setRoster("");
        clearPlacement();
      } else if (year && !next.years.some((y) => y.id === year)) {
        setYear(next.years[0]?.id ?? "");
        setRoster("");
        clearPlacement();
      }
      if (command.type === "enrollment" || !next.can_manage) clearPlacement();
    },
    { confirmed: true, commandSchema: classCommand },
  );
  const { busy, message, phase, blocked, feedbackRef, fail, clear, mutate } =
    mutation;
  const disabled = busy || blocked,
    current = data.classes.find((c) => c.id === editing),
    selected = data.classes.find((c) => c.id === roster);
  const classes = data.classes.filter(
    (c) =>
      (!year || c.year_id === year) &&
      c.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const yearLabel = (id: string) => {
    const y = data.years.find((y) => y.id === id);
    return y ? formatAcademicYear(y.start_year) : "—";
  };
  useEffect(() => {
    if (roster) {
      rosterHeading.current?.focus();
      rosterHeading.current?.scrollIntoView({
        block: "start",
        behavior: "instant",
      });
    }
  }, [roster]);
  async function leavePlacement() {
    return (
      (!chosen.length && !startsOn) ||
      await confirmAction(
        "Abaikan pilihan siswa dan tanggal penempatan yang belum disimpan?",
      )
    );
  }
  function openClass(id: string | null, button: HTMLButtonElement) {
    classOpener.current = button;
    setEditing(id);
    setDirty(false);
    clear();
    setClassOpen(true);
  }
  async function closeClass(open: boolean) {
    if (busy) return;
    if (
      !open &&
      dirty &&
      !await confirmAction(
        "Tutup formulir dan abaikan perubahan kelas yang belum disimpan?",
      )
    )
      return;
    setClassOpen(open);
    if (!open) {
      setEditing(null);
      setDirty(false);
    }
  }
  async function showRoster(id: string) {
    if (id !== roster) {
      if (!await leavePlacement()) return;
      clearPlacement();
      setRoster(id);
    } else {
      rosterHeading.current?.focus();
      rosterHeading.current?.scrollIntoView({
        block: "start",
        behavior: "instant",
      });
    }
  }
  const selectedYear = data.years.find((y) => y.id === year);
  const feedback = message ? (
    <div
      ref={feedbackRef}
      tabIndex={-1}
      className="rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Status
        tone={
          phase === "success"
            ? "success"
            : phase === "pending"
              ? "info"
              : "error"
        }
      >
        {message}
        {blocked && (
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => window.location.reload()}
            >
              Muat ulang data
            </Button>
          </div>
        )}
      </Status>
    </div>
  ) : null;
  const candidates = data.students.filter(
    (p) =>
      !selected?.students.some((s) => s.id === p.id) &&
      `${p.name} ${p.username ?? ""}`
        .toLowerCase()
        .includes(studentSearch.trim().toLowerCase()),
  );
  return (
    <div className="classes-panel space-y-6" aria-busy={busy}>
      {data.can_manage && bulkAvailable ? (
        <BulkImport
          domain="enrollment"
          disabled={disabled || classOpen || !!chosen.length || !!startsOn}
          classes={data.classes
            .filter((c) => !c.archived && c.year_id === year)
            .map((c) => ({
              id: c.id,
              label: `${c.name} · ${formatAcademicYear(data.years.find((y) => y.id === c.year_id)!.start_year)}`,
            }))}
          onFinished={() => {
            void (async () => {
              try {
                const r = await fetch(
                  "/api/classes?" + new URLSearchParams({ year }),
                  { cache: "no-store" },
                );
                if (!r.ok) throw Error();
                setData(classSnapshot.parse((await r.json()).classes));
                clearPlacement();
              } catch {
                fail(
                  "Impor tersimpan. Tampilan belum diperbarui; muat ulang halaman sebelum mengubah data lain.",
                );
              }
            })();
          }}
        />
      ) : null}
      <AcademicContextBar
        current={{
          year: selectedYear?.start_year ?? null,
          classId: selected?.year_id === year ? roster || null : null,
        }}
        catalog={{
          years: data.years.map((y) => y.start_year),
          classes: data.classes.map((c) => ({
            id: c.id,
            name: c.name,
            year: data.years.find((y) => y.id === c.year_id)!.start_year,
          })),
        }}
        disabled={disabled || classOpen}
        onApply={async (value) => {
          if (!await leavePlacement()) return;
          setYear(data.years.find((y) => y.start_year === value.year)!.id);
          setRoster(value.classId ?? "");
          clearPlacement();
          setSearch("");
        }}
      />
      {!classOpen && feedback}
      {selectedYear && (
        <Status>
          Tahun ajaran {formatAcademicYear(selectedYear.start_year)}:{" "}
          {semesterPeriod(selectedYear.start_year, 1)?.label};{" "}
          {semesterPeriod(selectedYear.start_year, 2)?.label}.
        </Status>
      )}
      <FilterBar label="Filter kelas dan siswa" className="classes-filters">
        <label className="block text-sm">
          Tahun ajaran
          <select
            className={controlClass}
            value={year}
            disabled={disabled}
            onChange={async (e) => {
const retainedEvalue=e.target.value;

              if (!await leavePlacement()) return;
              setYear(retainedEvalue);
              setRoster("");
              clearPlacement();
            }}
          >
            <option value="">Semua tahun ajaran</option>
            {data.years.map((y) => (
              <option value={y.id} key={y.id}>
                {formatAcademicYear(y.start_year)}
                {y.is_active ? " (Aktif)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Cari kelas
          <input
            className={controlClass}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </FilterBar>
      {data.can_manage && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Tahun ajaran</h2>
            <p className="text-sm text-muted-foreground">
              Tahun baru tersimpan sebagai riwayat sampai diaktifkan.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              onSubmit={async (e) => {
const retainedEcurrentTarget=e.currentTarget;

                e.preventDefault();
                if (!await leavePlacement()) return;
                const f = new FormData(retainedEcurrentTarget);
                void mutate(data.revision, {
                  type: "year",
                  academicYear: String(f.get("academicYear")),
                });
              }}
            >
              <fieldset
                disabled={disabled}
                className="classes-year-fields flex flex-wrap items-end gap-3"
              >
                <label className="block min-w-0 flex-1 text-sm">
                  Tahun ajaran (misalnya 2026/2027)
                  <input
                    className={controlClass}
                    name="academicYear"
                    type="text"
                    placeholder="2026/2027"
                    maxLength={9}
                    pattern="[0-9]{4}(/[0-9]{4}|-[0-9]{4})"
                    required
                  />
                </label>
                <Button type="submit">Tambah tahun ajaran</Button>
              </fieldset>
            </form>
            <Button
              disabled={
                disabled ||
                !year ||
                data.years.some((y) => y.id === year && y.is_active)
              }
              variant="outline"
              onClick={async () => {
                if (
                  await confirmAction(
                    "Aktifkan tahun ajaran terpilih? Tahun lain tetap tersimpan sebagai riwayat.",
                  )
                )
                  void mutate(data.revision, {
                    type: "year_activate",
                    id: year,
                  });
              }}
            >
              Jadikan tahun terpilih aktif
            </Button>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-muted-foreground">
          {classes.length} kelas ditampilkan
        </p>
        {data.can_manage && (
          <Button
            disabled={disabled || !year}
            onClick={(e) => openClass(null, e.currentTarget)}
          >
            Tambah kelas
          </Button>
        )}
      </div>
      {data.can_manage && (
        <Dialog
          className="classes-dialog"
          returnFocusRef={classOpener}
          open={classOpen}
          onOpenChange={closeClass}
          title={current ? "Edit kelas" : "Tambah kelas"}
          description="Isi nama, tingkat, dan wali kelas. Tanda * wajib diisi."
        >
          <div className="space-y-4">
            {feedback}
            <p className="text-sm text-muted-foreground">
              Tahun ajaran {yearLabel(current?.year_id ?? year)}
            </p>
            <form
              key={`${editing}-${year}-${data.revision}`}
              onChangeCapture={() => setDirty(true)}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  teacherId = String(f.get("teacherId"));
                if (
                  teacherId &&
                  !data.teachers.some((t) => t.id === teacherId)
                ) {
                  fail(
                    "Wali kelas sebelumnya tidak lagi tersedia. Pilih guru aktif atau Belum ditetapkan sebelum menyimpan.",
                  );
                  return;
                }
                void mutate(data.revision, {
                  type: "class",
                  id: current?.id ?? null,
                  yearId: current?.year_id ?? year,
                  level: Number(f.get("level")),
                  name: String(f.get("name")),
                  teacherId: teacherId || null,
                });
              }}
            >
              <fieldset disabled={disabled || !year} className="classes-fields">
                <TextField
                  name="name"
                  label="Nama kelas"
                  value={current?.name}
                  required
                  max={50}
                />
                <SelectField
                  name="level"
                  label="Tingkat"
                  value={String(current?.level ?? 7)}
                >
                  {[7, 8, 9].map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  name="teacherId"
                  label="Wali kelas"
                  value={current?.teacher_id ?? ""}
                >
                  <option value="">Belum ditetapkan</option>
                  {current?.teacher_id &&
                    !data.teachers.some((p) => p.id === current.teacher_id) && (
                      <option value={current.teacher_id}>
                        {current.teacher_name ?? "Wali kelas sebelumnya"} (tidak
                        tersedia)
                      </option>
                    )}
                  {data.teachers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.username})
                    </option>
                  ))}
                </SelectField>
              </fieldset>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button type="submit" disabled={disabled || !year}>
                  {busy ? "Menyimpan…" : "Simpan kelas"}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  disabled={busy}
                  onClick={async () => await closeClass(false)}
                >
                  Batal
                </Button>
              </div>
            </form>
          </div>
        </Dialog>
      )}
      {classes.length === 0 ? (
        <Status>
          {search.trim()
            ? "Tidak ada kelas yang cocok. Ubah pencarian atau tahun ajaran."
            : "Belum ada kelas yang dapat diakses pada tahun ajaran ini."}
        </Status>
      ) : (
        <ul className="classes-grid">
          {classes.map((c) => (
            <li
              key={c.id}
              className="min-w-0 space-y-4 rounded-xl border bg-card p-4 shadow-xs"
            >
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {yearLabel(c.year_id)} · Tingkat {c.level}
                  {c.archived ? " · Arsip" : ""}
                </p>
                <h2 id={`class-${c.id}`} className="text-xl font-semibold">
                  {c.name}
                </h2>
                <p className="text-sm">
                  Wali kelas: {c.teacher_name ?? "belum ditetapkan"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {c.students.length} siswa dapat diakses
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  aria-describedby={`class-${c.id}`}
                  onClick={async () => await showRoster(c.id)}
                >
                  Daftar siswa
                </Button>
                {data.can_manage && !c.archived && (
                  <>
                    <Button
                      variant="outline"
                      disabled={disabled}
                      aria-describedby={`class-${c.id}`}
                      onClick={(e) => openClass(c.id, e.currentTarget)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      disabled={disabled}
                      aria-describedby={`class-${c.id}`}
                      onClick={async () => {
                        if (
                          await confirmAction(
                            `Arsipkan kelas ${c.name}? Riwayat tetap tersimpan.`,
                          )
                        )
                          void mutate(data.revision, {
                            type: "class_archive",
                            id: c.id,
                          });
                      }}
                    >
                      Arsipkan
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <Card>
          <CardHeader>
            <h2
              ref={rosterHeading}
              tabIndex={-1}
              className="scroll-mt-6 text-xl font-semibold"
            >
              Siswa kelas {selected.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {yearLabel(selected.year_id)} · {selected.students.length} siswa
              dapat diakses
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {selected.students.length === 0 ? (
              <Status>Belum ada siswa yang dapat diakses.</Status>
            ) : (
              <ul className="divide-y">
                {selected.students.map((p) => (
                  <li key={p.id} className="classes-student">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.username} · mulai {p.starts_on}
                        {p.status !== "active" ? " · akun nonaktif" : ""}
                      </p>
                    </div>
                    {data.can_manage && !selected.archived && (
                      <Button
                        variant="outline"
                        disabled={disabled}
                        aria-label={`Keluarkan ${p.name}`}
                        onClick={async () => {
                          if (
                            await confirmAction(
                              `Keluarkan ${p.name} dari penempatan kelas ini? Riwayat tetap tersimpan.`,
                            )
                          )
                            void mutate(data.revision, {
                              type: "enrollment",
                              classId: selected.id,
                              studentIds: [p.id],
                              startsOn: p.starts_on,
                              remove: true,
                            });
                        }}
                      >
                        Keluarkan
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {data.can_manage && !selected.archived && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const command = {
                    type: "enrollment" as const,
                    classId: selected.id,
                    studentIds: chosen,
                    startsOn,
                    remove: false,
                  };
                  if (!classCommand.safeParse(command).success) {
                    fail("Pilih 1–500 siswa dan tanggal mulai yang valid.");
                    return;
                  }
                  if (
                    await confirmAction(
                      `Tempatkan ${chosen.length} siswa di kelas ${selected.name}? Penempatan sebelumnya pada tahun yang sama akan diakhiri; riwayat tetap tersimpan.`,
                    )
                  )
                    void mutate(data.revision, command);
                }}
              >
                <fieldset disabled={disabled} className="space-y-4">
                  <legend className="mb-3 text-lg font-semibold">
                    Tambah atau pindahkan siswa
                  </legend>
                  <p className="text-sm text-muted-foreground">
                    Wali kelas berbeda dari Guru Wali. Perpindahan tetap
                    menyimpan riwayat kelas.
                  </p>
                  <label className="block text-sm">
                    Tanggal mulai penempatan
                    <input
                      className={controlClass}
                      type="date"
                      name="startsOn"
                      value={startsOn}
                      onChange={(e) => setStartsOn(e.target.value)}
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    Cari siswa
                    <input
                      className={controlClass}
                      type="search"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                    />
                  </label>
                  <p role="status" className="text-sm">
                    {chosen.length} siswa dipilih · maksimum 500
                  </p>
                  <fieldset className="classes-picker">
                    <legend>Pilih siswa untuk ditambah / dipindahkan</legend>
                    {candidates.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Tidak ada siswa yang tersedia sesuai pencarian.
                      </p>
                    ) : (
                      candidates.map((p) => (
                        <label key={p.id} className="classes-check">
                          <input
                            type="checkbox"
                            name="students"
                            value={p.id}
                            checked={chosen.includes(p.id)}
                            disabled={
                              !chosen.includes(p.id) && chosen.length >= 500
                            }
                            onChange={(e) =>
                              setChosen((old) =>
                                e.target.checked
                                  ? [...old, p.id]
                                  : old.filter((id) => id !== p.id),
                              )
                            }
                          />
                          <span>
                            {p.name} ({p.username})
                          </span>
                        </label>
                      ))
                    )}
                  </fieldset>
                  <Button
                    type="submit"
                    disabled={disabled || chosen.length === 0}
                  >
                    Tempatkan siswa terpilih
                  </Button>
                </fieldset>
              </form>
            )}
          </CardContent>
        </Card>
      )}
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => window.location.reload()}
      >
        Muat ulang
      </Button>
    </div>
  );
}
