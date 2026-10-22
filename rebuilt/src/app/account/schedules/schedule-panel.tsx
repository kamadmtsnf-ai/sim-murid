"use client";
import { formatAcademicYear } from "@/lib/academic/period";
import { Tabs } from "radix-ui";
import { Dialog } from "@/components/ui/dialog";
import { TableRegion } from "@/components/ui/data-table";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { SelectField, controlClass } from "@/components/domain-controls";
import {
  classSnapshot,
  scheduleSnapshot,
  scheduleCommand,
  clock,
  endMinute,
  weekdays,
} from "@/lib/education/validation";
import { useDomainMutation } from "@/lib/education/use-mutation";
type Schedule = z.infer<typeof scheduleSnapshot>;
type Classes = z.infer<typeof classSnapshot>;
type Lesson = Schedule["lessons"][number];
export function SchedulePanel({
  initial,
  classes,
  filters,
  initialTab = "kbm",
}: {
  initialTab?: "kbm" | "piket";
  initial: Schedule;
  classes: Classes;
  filters: {
    year?: string;
    classId?: string;
    weekday?: number;
    personal?: boolean;
  };
}) {
  const [data, setData] = useState(initial),
    [editing, setEditing] = useState<string | null>(null),
    [selectedLessons, setSelectedLessons] = useState<string[]>([]),
    [selectedDuties, setSelectedDuties] = useState<string[]>([]),
    [dutyClass, setDutyClass] = useState("");
  const dirty = useRef(false),
    saving = useRef(false),
    returnFocusRef = useRef<HTMLElement | null>(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [modal, setModal] = useState<"lesson" | "duty" | null>(null);
  const [draftEpoch, setDraftEpoch] = useState(0);
  const [filterYear, setFilterYear] = useState(filters.year ?? "");
  const [filterClass, setFilterClass] = useState(filters.classId ?? "");
  const discard = () => {
    if (!dirty.current) return true;
    if (!window.confirm("Tinggalkan perubahan yang belum disimpan?"))
      return false;
    dirty.current = false;
    setDraftEpoch((n) => n + 1);
    return true;
  };
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const query = new URLSearchParams({
    ...(filters.year ? { year: filters.year } : {}),
    ...(filters.classId ? { class: filters.classId } : {}),
    ...(filters.weekday ? { day: String(filters.weekday) } : {}),
    ...(filters.personal ? { personal: "1" } : {}),
  }).toString();
  const { busy, message, mutate, blocked, phase, feedbackRef, clear } =
    useDomainMutation(
      `/api/schedules?${query}`,
      scheduleSnapshot,
      "schedules",
      (next) => {
        dirty.current = false;
        setData(next);
        setEditing(null);
        setModal(null);
        setSelectedLessons([]);
        setSelectedDuties([]);
      },
      { confirmed: true, commandSchema: scheduleCommand },
    );
  const locked = busy || blocked;
  const available = classes.classes.filter(
      (c) =>
        !c.archived &&
        c.year_id ===
          (filters.year ?? classes.years.find((y) => y.is_active)?.id),
    ),
    writable = available.filter((c) => c.can_schedule),
    current = data.lessons.find((l) => l.id === editing),
    duty = available.find((c) => c.id === dutyClass);
  const totalSelected =
    activeTab === "kbm" ? selectedLessons.length : selectedDuties.length;
  const toggle = (array: string[], id: string) =>
    array.includes(id)
      ? array.filter((x) => x !== id)
      : array.length < 500
        ? [...array, id]
        : array;
  const closeModal = () => {
    if (saving.current || busy || !discard()) return;
    setModal(null);
    setEditing(null);
  };
  const openModal = (
    kind: "lesson" | "duty",
    trigger: HTMLElement,
    id: string | null = null,
  ) => {
    if (locked) return;
    returnFocusRef.current = trigger;
    dirty.current = false;
    clear();
    setEditing(id);
    setDutyClass(
      writable.some((c) => c.id === filters.classId)
        ? filters.classId!
        : writable.length === 1
          ? writable[0]!.id
          : "",
    );
    setDraftEpoch((n) => n + 1);
    setModal(kind);
  };
  async function save(command: unknown) {
    if (saving.current || locked) return;
    saving.current = true;
    try {
      await mutate(data.revision, command);
    } finally {
      saving.current = false;
    }
  }
  const feedback = message ? (
    <div
      ref={feedbackRef}
      tabIndex={-1}
      role={phase === "error" || blocked ? "alert" : "status"}
      className="rounded-lg border bg-muted/40 p-4 text-sm"
    >
      {message}
    </div>
  ) : null;
  return (
    <div className="schedules-panel min-w-0 space-y-6" aria-busy={busy}>
      <div className="grid grid-cols-2 gap-3" aria-label="Ringkasan jadwal">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Pelajaran sesuai filter
          </p>
          <p className="mt-1 text-2xl font-semibold">{data.lessons.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Penugasan piket</p>
          <p className="mt-1 text-2xl font-semibold">{data.duties.length}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Waktu selesai dihitung dari durasi × JTM + istirahat. Jadwal yang
        bertabrakan untuk kelas atau guru ditolak. Penggantian piket tidak
        mengubah jadwal pelajaran.
      </p>
      {!modal && feedback}
      <form
        action="/account/schedules"
        method="get"
        onSubmit={(e) => {
          if (locked || !discard()) e.preventDefault();
        }}
        className="grid gap-3 rounded border p-4 sm:grid-cols-3"
      >
        <input type="hidden" name="view" value={activeTab} />
        <label className="block text-sm">
          Tahun ajaran
          <select
            name="year"
            className={controlClass}
            value={filterYear}
            disabled={locked}
            onChange={(e) => {
              setFilterYear(e.target.value);
              setFilterClass("");
            }}
          >
            <option value="">Tahun aktif</option>
            {classes.years.map((y) => (
              <option key={y.id} value={y.id}>
                {formatAcademicYear(y.start_year)}
                {y.is_active ? " (Aktif)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Kelas
          <select
            name="class"
            className={controlClass}
            value={filterClass}
            disabled={locked}
            onChange={(e) => setFilterClass(e.target.value)}
          >
            <option value="">Semua kelas yang dapat diakses</option>
            {classes.classes
              .filter(
                (c) =>
                  !c.archived &&
                  c.year_id ===
                    (filterYear || classes.years.find((y) => y.is_active)?.id),
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (
                  {formatAcademicYear(
                    classes.years.find((y) => y.id === c.year_id)?.start_year,
                  )}
                  )
                </option>
              ))}
          </select>
        </label>
        <SelectField
          name="day"
          label="Hari"
          value={String(filters.weekday ?? "")}
        >
          <option value="">Semua hari</option>
          {weekdays.slice(1).map((d, i) => (
            <option value={i + 1} key={d}>
              {d}
              {i + 1 === data.today ? " (Hari ini WIB)" : ""}
            </option>
          ))}
        </SelectField>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="personal"
            value="1"
            defaultChecked={filters.personal}
          />
          Untuk Guru: hanya pelajaran yang saya ajar
        </label>
        <Button disabled={locked} type="submit">
          Terapkan filter
        </Button>
      </form>
      <Tabs.Root
        value={activeTab}
        onValueChange={(value) => {
          if (busy) return;
          setActiveTab(value === "piket" ? "piket" : "kbm");
          setSelectedLessons([]);
          setSelectedDuties([]);
        }}
      >
        <Tabs.List
          aria-label="Jenis jadwal"
          className="schedule-tabs grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-1"
        >
          <Tabs.Trigger value="kbm" disabled={busy}>
            Jadwal KBM
          </Tabs.Trigger>
          <Tabs.Trigger value="piket" disabled={busy}>
            Jadwal Piket
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="kbm" className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Daftar pelajaran sesuai tahun ajaran, kelas, dan hari.
            </p>
            {writable.length > 0 && (
              <Button
                disabled={locked}
                onClick={(e) => openModal("lesson", e.currentTarget)}
              >
                Input Jadwal KBM
              </Button>
            )}
          </div>
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Jadwal pelajaran</h2>
            </CardHeader>
            <CardContent>
              {data.lessons.length === 0 ? (
                <p>Belum ada pelajaran sesuai filter dan hak akses.</p>
              ) : (
                <TableRegion label="Tabel data — gulir untuk melihat seluruh kolom">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">
                      Daftar jadwal pelajaran
                    </caption>
                    <thead>
                      <tr>
                        {[
                          "Pilih",
                          "Hari / waktu",
                          "Kelas / mapel",
                          "Guru / durasi",
                          "Tindakan",
                        ].map((h) => (
                          <th key={h} scope="col" className="p-2">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.lessons.map((l) => (
                        <tr key={l.id} className="border-t">
                          <td className="p-2">
                            <input
                              type="checkbox"
                              aria-label={`Pilih ${l.subject} ${l.class_name} ${weekdays[l.weekday]}`}
                              disabled={locked || !l.can_manage}
                              checked={selectedLessons.includes(l.id)}
                              onChange={() =>
                                setSelectedLessons((a) => toggle(a, l.id))
                              }
                            />
                          </td>
                          <td className="whitespace-nowrap p-2">
                            {weekdays[l.weekday]}
                            <p>
                              {clock(l.start_minute)}–{clock(l.end_minute)}
                            </p>
                          </td>
                          <td className="p-2">
                            {l.class_name}
                            <p>{l.subject}</p>
                          </td>
                          <td className="p-2">
                            {l.teacher_name}
                            <p>
                              {l.duration_minutes} menit × {l.jtm} JTM +
                              istirahat {l.break_minutes} menit
                            </p>
                          </td>
                          <td className="p-2">
                            {l.can_manage && (
                              <Button
                                disabled={locked}
                                variant="outline"
                                onClick={(e) =>
                                  openModal("lesson", e.currentTarget, l.id)
                                }
                              >
                                Edit
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableRegion>
              )}
            </CardContent>
          </Card>
        </Tabs.Content>
        <Tabs.Content value="piket" className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Penugasan piket siswa sesuai filter yang diterapkan.
            </p>
            {writable.length > 0 && (
              <Button
                disabled={locked}
                onClick={(e) => openModal("duty", e.currentTarget)}
              >
                Input Jadwal Piket
              </Button>
            )}
          </div>
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Piket siswa</h2>
            </CardHeader>
            <CardContent>
              {data.duties.length === 0 ? (
                <p>Belum ada piket sesuai filter dan hak akses.</p>
              ) : (
                <ul className="divide-y">
                  {data.duties.map((d) => (
                    <li
                      key={d.id}
                      className="flex min-w-0 items-center gap-3 py-2"
                    >
                      <input
                        type="checkbox"
                        aria-label={`Pilih piket ${d.student_name} ${weekdays[d.weekday]}`}
                        disabled={locked || !d.can_manage}
                        checked={selectedDuties.includes(d.id)}
                        onChange={() =>
                          setSelectedDuties((a) => toggle(a, d.id))
                        }
                      />
                      <span className="min-w-0 break-words">
                        {weekdays[d.weekday]} · {d.class_name} ·{" "}
                        {d.student_name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </Tabs.Content>
      </Tabs.Root>
      {totalSelected >= 500 && (
        <p role="status">Maksimal 500 jadwal dapat dipilih sekaligus.</p>
      )}
      {totalSelected > 0 && (
        <Button
          variant="outline"
          disabled={locked}
          onClick={() => {
            if (
              discard() &&
              window.confirm(
                "Hapus jadwal terpilih? Seluruh pilihan diperiksa izinnya dan riwayat tetap disimpan.",
              )
            )
              void save({
                type: "schedule_delete",
                lessonIds: activeTab === "kbm" ? selectedLessons : [],
                dutyIds: activeTab === "piket" ? selectedDuties : [],
              });
          }}
        >
          Hapus {totalSelected} jadwal terpilih
        </Button>
      )}
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
        returnFocusRef={returnFocusRef}
        className="schedules-dialog schedules-panel"
        title={
          modal === "duty"
            ? "Input Jadwal Piket"
            : current
              ? "Edit Jadwal KBM"
              : "Input Jadwal KBM"
        }
        description={
          modal === "duty"
            ? "Atur piket kelas untuk seluruh minggu. Menyimpan mengganti pilihan pada semua hari."
            : "Pilih kelas, mata pelajaran, guru, dan waktu. Waktu selesai dihitung termasuk istirahat."
        }
      >
        <div className="space-y-4" aria-busy={busy}>
          {feedback}
          {modal === "lesson" && (
            <LessonForm
              key={`${editing}-${draftEpoch}`}
              current={current}
              defaultClassId={filters.classId}
              classes={writable}
              data={data}
              busy={locked}
              onCancel={closeModal}
              onSubmit={(command) => void save(command)}
              onDirty={() => {
                dirty.current = true;
              }}
            />
          )}
          {modal === "duty" && (
            <>
              <label className="block text-sm">
                Kelas untuk piket
                <select
                  value={dutyClass}
                  className={controlClass}
                  disabled={locked}
                  onChange={(e) => {
                    if (discard()) setDutyClass(e.target.value);
                  }}
                >
                  <option value="">Pilih kelas…</option>
                  {writable.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {duty ? (
                <DutyForm
                  key={`${duty.id}-${draftEpoch}`}
                  data={data}
                  classroom={duty}
                  busy={locked}
                  onSubmit={(command) => void save(command)}
                  onDirty={() => {
                    dirty.current = true;
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Pilih kelas untuk menampilkan siswa dan jadwal piket seluruh
                  minggu.
                </p>
              )}
              <Button disabled={busy} variant="outline" onClick={closeModal}>
                Batal
              </Button>
            </>
          )}
          {blocked && (
            <Button
              variant="outline"
              onClick={() => {
                if (discard()) window.location.reload();
              }}
            >
              Muat ulang
            </Button>
          )}
        </div>
      </Dialog>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => {
          if (discard()) window.location.reload();
        }}
      >
        Muat ulang
      </Button>
    </div>
  );
}
function LessonForm({
  current,
  defaultClassId,
  classes,
  data,
  busy,
  onCancel,
  onSubmit,
  onDirty,
}: {
  current: Lesson | undefined;
  defaultClassId?: string | undefined;
  classes: Classes["classes"];
  data: Schedule;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (command: unknown) => void;
  onDirty: () => void;
}) {
  const [start, setStart] = useState(
      current ? clock(current.start_minute) : "07:00",
    ),
    [duration, setDuration] = useState(current?.duration_minutes ?? 40),
    [jtm, setJtm] = useState(current?.jtm ?? 2),
    [rest, setRest] = useState(current?.break_minutes ?? 0);
  const end = endMinute(start, duration, jtm, rest);
  const validEnd =
    /^([01]\d|2[0-3]):[0-5]\d$/.test(start) &&
    Number.isFinite(end) &&
    end > 0 &&
    end < 1440;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onSubmit({
      type: "lesson",
      id: current?.id ?? null,
      classId: String(f.get("classId")),
      subjectId: String(f.get("subjectId")),
      teacherId: String(f.get("teacherId")),
      weekday: Number(f.get("weekday")),
      start,
      durationMinutes: duration,
      jtm,
      breakMinutes: rest,
    });
  }
  return (
    <form onSubmit={submit} onChange={onDirty}>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-3">
        <SelectField
          name="classId"
          label="Kelas"
          value={
            current?.class_id ??
            (classes.some((c) => c.id === defaultClassId) ? defaultClassId : "")
          }
          required
        >
          <option value="">Pilih…</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          name="subjectId"
          label="Mata pelajaran"
          value={
            data.subjects.some((s) => s.id === current?.subject_id && s.active)
              ? current?.subject_id
              : ""
          }
          required
        >
          <option value="">
            {current &&
            !data.subjects.some((s) => s.id === current.subject_id && s.active)
              ? `${current.subject} tidak aktif; pilih mapel aktif…`
              : "Pilih mapel aktif…"}
          </option>
          {data.subjects.map((s) => (
            <option key={s.id} value={s.id} disabled={!s.active}>
              {s.name}
              {!s.active ? " (Nonaktif)" : ""}
            </option>
          ))}
        </SelectField>
        <SelectField
          name="teacherId"
          label="Guru pengajar"
          value={
            data.teachers.some((p) => p.id === current?.teacher_id)
              ? current?.teacher_id
              : ""
          }
          required
        >
          <option value="">Pilih…</option>
          {current &&
            !data.teachers.some((p) => p.id === current.teacher_id) && (
              <option value="" disabled>
                {current.teacher_name} (Tidak tersedia; pilih guru aktif)
              </option>
            )}
          {data.teachers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          name="weekday"
          label="Hari"
          value={String(current?.weekday ?? 1)}
        >
          {weekdays.slice(1).map((d, i) => (
            <option value={i + 1} key={d}>
              {d}
            </option>
          ))}
        </SelectField>
        <label>
          Waktu mulai
          <input
            className={controlClass}
            type="time"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Menit per JTM
          <input
            className={controlClass}
            type="number"
            min={1}
            max={240}
            required
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </label>
        <label>
          Jumlah JTM
          <input
            className={controlClass}
            type="number"
            min={1}
            max={12}
            required
            value={jtm}
            onChange={(e) => setJtm(Number(e.target.value))}
          />
        </label>
        <label>
          Istirahat (menit)
          <input
            className={controlClass}
            type="number"
            min={0}
            max={240}
            required
            value={rest}
            onChange={(e) => setRest(Number(e.target.value))}
          />
        </label>
        <p className="self-center" role="status">
          Selesai:{" "}
          <strong>{validEnd ? clock(end) : "Melewati batas hari"}</strong>
        </p>
        <div className="flex flex-wrap gap-2 sm:col-span-3">
          <Button disabled={!validEnd} type="submit">
            Simpan pelajaran
          </Button>
          <Button variant="outline" type="button" onClick={onCancel}>
            Batal
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
function DutyForm({
  data,
  classroom,
  busy,
  onSubmit,
  onDirty,
}: {
  data: Schedule;
  classroom: Classes["classes"][number];
  busy: boolean;
  onSubmit: (command: unknown) => void;
  onDirty: () => void;
}) {
  const unavailable = data.duty_roster.filter(
    (d) =>
      d.class_id === classroom.id &&
      !classroom.students.some(
        (p) => p.id === d.student_id && p.status === "active",
      ),
  ).length;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const items = f.getAll("assignment").map((v) => {
      const [day, studentId] = String(v).split(":");
      return { weekday: Number(day), studentId };
    });
    if (
      window.confirm(
        "Ganti seluruh piket aktif kelas ini dengan pilihan pada semua hari?",
      )
    )
      onSubmit({ type: "duties", classId: classroom.id, items });
  }
  return (
    <form onSubmit={submit} onChange={onDirty}>
      <fieldset disabled={busy} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Pilih siswa untuk setiap hari. Menyimpan tanpa pilihan akan
          mengosongkan piket kelas. Siswa nonaktif tidak dapat ditugaskan.
        </p>
        {!classroom.students.some((p) => p.status === "active") && (
          <p role="status">Belum ada siswa aktif di kelas ini.</p>
        )}
        {unavailable > 0 && (
          <p role="status" className="rounded-md border p-3 text-sm">
            {unavailable} penugasan lama untuk siswa nonaktif atau tidak lagi
            terdaftar akan dibersihkan saat piket disimpan.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {weekdays.slice(1).map((day, i) => (
            <fieldset
              key={day}
              className="max-h-56 overflow-auto rounded border p-3"
            >
              <legend>{day}</legend>
              {classroom.students
                .filter((p) => p.status === "active")
                .map((p) => (
                  <label
                    key={p.id}
                    className="flex min-h-11 min-w-0 items-center gap-2 py-2"
                  >
                    <input
                      type="checkbox"
                      name="assignment"
                      value={`${i + 1}:${p.id}`}
                      defaultChecked={data.duty_roster.some(
                        (d) =>
                          d.class_id === classroom.id &&
                          d.weekday === i + 1 &&
                          d.student_id === p.id,
                      )}
                    />
                    <span className="min-w-0 break-words">{p.name}</span>
                  </label>
                ))}
            </fieldset>
          ))}
        </div>
        <Button type="submit">Simpan seluruh piket kelas</Button>
      </fieldset>
    </form>
  );
}
