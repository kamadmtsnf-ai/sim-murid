"use client";
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
  attendanceFilters,
  attendanceMonth,
  attendanceSnapshot,
  attendanceStatuses,
  calendarSnapshot,
  calendarStatus,
  type AttendanceSnapshot,
} from "@/lib/operations/attendance";
const api = "/api/operations/attendance";
const labels: Record<string, string> = {
  effectiveDays: "Hari efektif",
  effectiveStudentDays: "Hari efektif × siswa terdaftar",
  recorded: "Absensi tercatat",
  present: "Hadir",
  sick: "Sakit",
  excused: "Izin",
  absent: "Alpha",
  recordedPercent: "Hadir / absensi tercatat (%)",
  effectivePercent: "Hadir / hari efektif siswa (%)",
  studentCount: "Siswa dalam pilihan",
};
type Entry = { status: string; notes: string };
type RecordRow = AttendanceSnapshot["rows"][number];
export function AttendancePanel({ initial }: { initial: AttendanceSnapshot }) {
  const [data, setData] = useState(initial),
    [filters, setFilters] = useState<Record<string, string>>({
      year: initial.today.slice(0, 4),
    }),
    [reading, setReading] = useState(false),
    [notice, setNotice] = useState("");
  const [classId, setClassId] = useState(""),
    [date, setDate] = useState(initial.today),
    [entries, setEntries] = useState<Record<string, Entry>>({}),
    [formVersion, setFormVersion] = useState(0);
  const [edit, setEdit] = useState<RecordRow | null>(null),
    [dirty, setDirty] = useState(false);
  const [calendar, setCalendar] = useState<{
      data: AttendanceSnapshot;
      month: string;
      name: string;
    } | null>(null),
    [calendarBusy, setCalendarBusy] = useState(false),
    [calendarError, setCalendarError] = useState("");
  const readLock = useRef(false),
    calendarLock = useRef(false),
    mounted = useRef(true),
    editTrigger = useRef<HTMLElement | null>(null),
    formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // The unfiltered initial catalog is independent of history/calendar selections.
  const people = initial.people.filter((p) => p.role_code === "student"),
    selected = people.filter((p) => p.class_id === classId);
  const params = (overrides: Record<string, string> = {}) =>
    new URLSearchParams({ ...filters, ...overrides }).toString();
  const {
    busy: writeBusy,
    blocked,
    message,
    phase,
    feedbackRef,
    clear,
    mutate,
    fail,
  } = useDomainMutation(
    api + "?" + params(),
    attendanceSnapshot,
    "data",
    (next, command) => {
      setData(next);
      const saved = commandSchemas.attendance.parse(command);
      if (saved.type === "batch") {
        setEntries({});
        setFormVersion((v) => v + 1);
      }
      setEdit(null);
      setDirty(false);
      setCalendar(null);
      setNotice("");
    },
    { confirmed: true, commandSchema: commandSchemas.attendance },
  );
  const busy = reading || writeBusy,
    disabled = busy || blocked || calendarBusy;
  const draft = Object.values(entries).some((e) => e.status || e.notes);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (draft || dirty || writeBusy) {
        e.preventDefault();
      }
    };
    const stopUnloadGuard = listenForUnsavedChanges(leave);
    return () => stopUnloadGuard();
  }, [draft, dirty, writeBusy]);
  function discard() {
    return (
      !(draft || dirty) ||
      window.confirm("Isian belum disimpan. Buang perubahan?")
    );
  }
  function entry(id: string, patch: Partial<Entry>) {
    setEntries((prev) => ({
      ...prev,
      [id]: {
        status: prev[id]?.status ?? "",
        notes: prev[id]?.notes ?? "",
        ...patch,
      },
    }));
  }
  async function load(next: Record<string, string>) {
    if (readLock.current || calendarLock.current || disabled) return;
    readLock.current = true;
    setReading(true);
    setNotice("Memuat riwayat…");
    clear();
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const parsed = attendanceFilters.parse(next);
      const response = await fetch(
        api +
          "?" +
          new URLSearchParams(
            Object.entries(parsed).map(([k, v]) => [k, String(v)]),
          ),
        { cache: "no-store", signal: controller.signal },
      );
      if (!response.ok)
        throw Error("Riwayat belum dapat dimuat. Periksa sesi dan coba lagi.");
      const result = attendanceSnapshot.parse((await response.json()).data);
      if (mounted.current) {
        setData(result);
        setFilters(next);
        setNotice("Riwayat diperbarui.");
      }
    } catch {
      if (mounted.current)
        setNotice(
          "Riwayat belum dapat dimuat. Periksa rentang tanggal dan koneksi, lalu coba lagi.",
        );
    } finally {
      clearTimeout(timeout);
      readLock.current = false;
      if (mounted.current) setReading(false);
    }
  }
  async function save(command: unknown) {
    if (readLock.current || calendarLock.current || disabled) return;
    setNotice("");
    readLock.current = true;
    try {
      await mutate(data.revision, command);
    } finally {
      readLock.current = false;
    }
  }
  function batch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const items = selected
      .filter((p) => entries[p.id]?.status)
      .map((p) => ({
        studentId: p.id,
        classId,
        date,
        status: entries[p.id]?.status,
        notes: entries[p.id]?.notes ?? "",
      }));
    if (!items.length) {
      fail("Pilih sedikitnya satu status kehadiran.");
      return;
    }
    if (date > data.today || new Date(date + "T12:00:00Z").getUTCDay() === 0) {
      fail("Pilih tanggal sekolah sampai hari ini.");
      return;
    }
    void save({ type: "batch", items });
  }
  async function showCalendar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (calendarLock.current || readLock.current || disabled) return;
    const values = new FormData(e.currentTarget),
      month = String(values.get("month")),
      studentId = String(values.get("studentId"));
    calendarLock.current = true;
    setCalendarBusy(true);
    setCalendar(null);
    setCalendarError("");
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 30000);
    try {
      attendanceMonth(month);
      const response = await fetch(
        api + "?" + new URLSearchParams({ calendar: month, studentId }),
        { cache: "no-store", signal: controller.signal },
      );
      if (!response.ok) throw Error("Calendar unavailable");
      const snapshot = calendarSnapshot(
        (await response.json()).data,
        studentId,
        month,
      );
      if (mounted.current)
        setCalendar({
          data: snapshot,
          month,
          name: people.find((p) => p.id === studentId)?.full_name ?? "Siswa",
        });
    } catch {
      if (mounted.current)
        setCalendarError(
          "Kalender belum dapat dimuat. Periksa koneksi dan akses siswa, lalu coba lagi.",
        );
    } finally {
      clearTimeout(timeout);
      calendarLock.current = false;
      if (mounted.current) setCalendarBusy(false);
    }
  }
  function closeEdit() {
    if (writeBusy) return;
    if (
      !dirty ||
      window.confirm("Buang perubahan koreksi yang belum disimpan?")
    ) {
      setEdit(null);
      setDirty(false);
    }
  }
  const feedback = (
    <div
      ref={edit ? undefined : feedbackRef}
      tabIndex={-1}
      role={phase === "error" || blocked ? "alert" : "status"}
      className="rounded-lg border bg-muted/30 p-3 text-sm outline-offset-4"
      aria-live="polite"
    >
      {message ||
        notice ||
        "Pilih periode untuk melihat riwayat dan ringkasan kehadiran."}
      {blocked && (
        <Button
          type="button"
          variant="outline"
          className="ml-2"
          onClick={() => window.location.reload()}
        >
          Muat ulang data
        </Button>
      )}
    </div>
  );
  return (
    <div className="attendance-panel min-w-0 space-y-6">
      {feedback}
      <section
        className="rounded-xl border bg-card p-4 sm:p-5"
        aria-labelledby="attendance-history-filter"
      >
        <h2 id="attendance-history-filter" className="text-lg font-semibold">
          Filter riwayat
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (disabled) return;
            const next = Object.fromEntries(
              [...new FormData(e.currentTarget)]
                .filter(([, v]) => String(v))
                .map(([k, v]) => [k, String(v)]),
            );
            void load({ ...next, page: "1" });
          }}
        >
          <fieldset
            disabled={disabled}
            className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <label className="text-sm">
              Tahun kalender
              <input
                name="year"
                type="number"
                min="2000"
                max="2100"
                defaultValue={filters.year}
                required
                className={controlClass}
              />
            </label>
            <TextField label="Dari tanggal" name="start" type="date" />
            <TextField label="Sampai tanggal" name="end" type="date" />
            <SelectField label="Kelas" name="classId">
              <option value="">Semua kelas sesuai izin</option>
              {initial.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
            <SelectField label="Siswa" name="studentId">
              <option value="">Semua siswa sesuai izin</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} — {p.username}
                </option>
              ))}
            </SelectField>
            <SelectField label="Status" name="status">
              <option value="">Semua status</option>
              {attendanceStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </SelectField>
            <Button className="sm:col-span-2 lg:col-span-3" type="submit">
              {reading ? "Memuat…" : "Terapkan filter"}
            </Button>
          </fieldset>
        </form>
      </section>
      <section
        aria-label="Ringkasan kehadiran"
        className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-5"
      >
        {Object.entries(data.summary).map(([key, value]) => (
          <div key={key} className="min-w-0 rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              {labels[key] ?? key}
            </p>
            <p className="mt-2 break-words text-2xl font-semibold tabular-nums">
              {new Intl.NumberFormat("id-ID", {
                maximumFractionDigits: 2,
              }).format(Number(value))}
            </p>
          </div>
        ))}
      </section>
      <p className="text-sm text-muted-foreground">
        Persentase tercatat memakai jumlah absensi; persentase hari efektif
        memakai hari sekolah selama siswa terdaftar. Minggu dan hari libur
        dikecualikan. Tanggal tanpa absensi tidak otomatis menjadi Alpha.
      </p>
      {data.extra.trend.length > 0 && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Tren jumlah hadir</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {data.extra.trend.map((t) => (
              <div key={t.month}>
                <p className="text-sm">
                  {t.month} · {t.value} hadir
                </p>
                <meter
                  className="w-full"
                  aria-label={"Jumlah hadir " + t.month}
                  min={0}
                  max={Math.max(1, ...data.extra.trend.map((t) => t.value))}
                  value={t.value}
                />
              </div>
            ))}
          </div>
        </section>
      )}
      {data.canManage && (
        <section
          className="rounded-xl border bg-card p-4 sm:p-5"
          aria-labelledby="attendance-input"
        >
          <h2 id="attendance-input" className="text-lg font-semibold">
            Input absensi per kelas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Daftar memakai kelas aktif saat ini. Keanggotaan pada tanggal
            absensi dan izin piket diperiksa kembali saat menyimpan. Status
            kosong tidak disimpan.
          </p>
          <form
            ref={formRef}
            key={formVersion}
            onSubmit={batch}
            className="mt-4"
          >
            <fieldset disabled={disabled} className="min-w-0 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  Tanggal absensi
                  <input
                    type="date"
                    required
                    min="2000-01-01"
                    max={data.today}
                    value={date}
                    onChange={(e) => {
                      if (discard()) {
                        setDate(e.target.value);
                        setEntries({});
                      }
                    }}
                    className={controlClass}
                  />
                </label>
                <label className="text-sm">
                  Kelas untuk input
                  <select
                    className={controlClass}
                    required
                    value={classId}
                    onChange={(e) => {
                      if (discard()) {
                        setClassId(e.target.value);
                        setEntries({});
                      }
                    }}
                  >
                    <option value="">Pilih kelas</option>
                    {initial.classes
                      .filter((c) => people.some((p) => p.class_id === c.id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              {classId && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setEntries((prev) =>
                          Object.fromEntries(
                            selected.map((p) => [
                              p.id,
                              {
                                status: "Hadir",
                                notes: prev[p.id]?.notes ?? "",
                              },
                            ]),
                          ),
                        )
                      }
                    >
                      Tandai semua Hadir
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setEntries((prev) =>
                          Object.fromEntries(
                            selected.map((p) => [
                              p.id,
                              { status: "", notes: prev[p.id]?.notes ?? "" },
                            ]),
                          ),
                        )
                      }
                    >
                      Kosongkan status
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {selected.filter((p) => entries[p.id]?.status).length} /{" "}
                      {selected.length} siswa dipilih
                    </span>
                  </div>
                  <div className="space-y-3">
                    {selected.map((p) => (
                      <div
                        key={p.id}
                        className="grid min-w-0 gap-3 rounded-lg border p-3 sm:grid-cols-3"
                      >
                        <div className="min-w-0">
                          <p className="break-words font-medium">
                            {p.full_name}
                          </p>
                          <p className="break-words text-sm text-muted-foreground">
                            {p.username}
                          </p>
                        </div>
                        <label className="min-w-0 text-sm">
                          Status {p.full_name}
                          <select
                            className={controlClass}
                            value={entries[p.id]?.status ?? ""}
                            onChange={(e) =>
                              entry(p.id, { status: e.target.value })
                            }
                          >
                            <option value="">Tidak diinput</option>
                            {attendanceStatuses.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </label>
                        <label className="min-w-0 text-sm">
                          Keterangan {p.full_name}
                          <input
                            className={controlClass}
                            maxLength={2000}
                            value={entries[p.id]?.notes ?? ""}
                            onChange={(e) =>
                              entry(p.id, { notes: e.target.value })
                            }
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <Button type="submit" disabled={!classId || !selected.length}>
                {writeBusy ? "Menyimpan…" : "Simpan absensi"}
              </Button>
            </fieldset>
          </form>
        </section>
      )}
      <section
        className="rounded-xl border bg-card p-4 sm:p-5"
        aria-labelledby="attendance-calendar"
      >
        <h2 id="attendance-calendar" className="text-lg font-semibold">
          Kalender kehadiran siswa
        </h2>
        <form onSubmit={showCalendar} className="mt-4">
          <fieldset
            disabled={calendarBusy || disabled}
            className="grid min-w-0 items-end gap-3 sm:grid-cols-3"
          >
            <label className="min-w-0 text-sm">
              Bulan kalender
              <input
                className={controlClass}
                name="month"
                type="month"
                min="2000-01"
                max="2100-12"
                defaultValue={data.today.slice(0, 7)}
                required
              />
            </label>
            <SelectField label="Siswa / anak" name="studentId" required>
              <option value="">Pilih siswa</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </SelectField>
            <Button type="submit">
              {calendarBusy ? "Memuat kalender…" : "Tampilkan kalender"}
            </Button>
          </fieldset>
        </form>
        {calendarError && (
          <p role="alert" className="mt-3 text-sm">
            {calendarError}
          </p>
        )}
        {calendar && (
          <>
            <h3 className="mt-5 break-words font-medium">
              {calendar.name} · {calendar.month}
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {Array.from(
                {
                  length: Number(attendanceMonth(calendar.month).end.slice(8)),
                },
                (_, i) => {
                  const day =
                    calendar.month + "-" + String(i + 1).padStart(2, "0");
                  return (
                    <div key={day} className="min-w-0 rounded-lg border p-3">
                      <time dateTime={day} className="text-sm font-medium">
                        {i + 1}
                      </time>
                      <p className="mt-1 break-words text-sm">
                        {calendarStatus(calendar.data, day)}
                      </p>
                    </div>
                  );
                },
              )}
            </div>
          </>
        )}
      </section>
      <section className="min-w-0 space-y-3" aria-busy={reading}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">
            Riwayat absensi ({data.total})
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
          Ekspor mengikuti filter dan hak akses yang sama, maksimal 10.000
          catatan. Persempit periode bila batas terlampaui.
        </p>
        <TableRegion label="Riwayat absensi — gulir untuk melihat seluruh kolom">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Absensi sesuai filter dan hak akses
            </caption>
            <thead>
              <tr>
                {[
                  "Tanggal",
                  "Siswa",
                  "Kelas",
                  "Status",
                  "Keterangan",
                  "Tindakan",
                ].map((h) => (
                  <th key={h} scope="col" className="border-b p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap border-b p-3">
                    <time dateTime={r.date}>{r.date}</time>
                  </td>
                  <td className="min-w-40 max-w-64 break-words border-b p-3">
                    {r.name}
                  </td>
                  <td className="border-b p-3">{r.class_name}</td>
                  <td className="border-b p-3">
                    <span className="rounded-md border bg-muted/40 px-2 py-1 font-medium">
                      {r.status}
                    </span>
                  </td>
                  <td className="max-w-xs whitespace-pre-wrap break-words border-b p-3">
                    {r.notes || "—"}
                  </td>
                  <td className="border-b p-3">
                    {r.can_edit ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        onClick={(e) => {
                          editTrigger.current = e.currentTarget;
                          setEdit(r);
                          setDirty(false);
                          clear();
                        }}
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
          <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
            Belum ada absensi sesuai filter dan hak akses Anda.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={disabled || data.page <= 1}
            onClick={() =>
              void load({ ...filters, page: String(data.page - 1) })
            }
          >
            Sebelumnya
          </Button>
          <span className="text-sm">
            Halaman {data.page} dari{" "}
            {Math.max(1, Math.ceil(data.total / data.pageSize))}
          </span>
          <Button
            variant="outline"
            disabled={disabled || data.page * data.pageSize >= data.total}
            onClick={() =>
              void load({ ...filters, page: String(data.page + 1) })
            }
          >
            Berikutnya
          </Button>
        </div>
      </section>
      <Dialog
        open={!!edit}
        onOpenChange={(open) => {
          if (!open) closeEdit();
        }}
        returnFocusRef={editTrigger}
        title="Koreksi absensi"
        description="Perubahan dan pembatalan catatan memerlukan alasan."
        className="attendance-dialog"
      >
        {edit && (
          <form
            key={edit.id}
            onChange={() => setDirty(true)}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void save({
                type: "edit",
                id: edit.id,
                status: f.get("status"),
                notes: f.get("notes"),
                reason: f.get("reason"),
              });
            }}
            className="space-y-4"
          >
            <p className="break-words font-medium">
              {edit.name} · {edit.date}
            </p>
            <fieldset disabled={disabled} className="space-y-4">
              <SelectField
                label="Status"
                name="status"
                value={edit.status}
                required
              >
                {attendanceStatuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </SelectField>
              <TextField
                label="Keterangan"
                name="notes"
                value={edit.notes}
                max={2000}
              />
              <label className="block text-sm">
                Alasan koreksi / pembatalan
                <input
                  name="reason"
                  className={controlClass}
                  minLength={3}
                  maxLength={2000}
                  required
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">Simpan koreksi</Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={(e) => {
                    const form = e.currentTarget.closest("form");
                    if (!form || !form.reportValidity()) return;
                    const reason = String(
                      new FormData(form).get("reason") ?? "",
                    ).trim();
                    if (reason.length < 3) {
                      fail("Isi alasan minimal 3 karakter.");
                      return;
                    }
                    if (window.confirm("Batalkan catatan absensi ini?"))
                      void save({ type: "void", id: edit.id, reason });
                  }}
                >
                  Batalkan catatan
                </Button>
              </div>
            </fieldset>
            {message && (
              <div
                ref={feedbackRef}
                tabIndex={-1}
                role={phase === "error" || blocked ? "alert" : "status"}
                className="text-sm"
              >
                {message}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={writeBusy}
              onClick={closeEdit}
            >
              Tutup
            </Button>
            {blocked && (
              <Button type="button" onClick={() => window.location.reload()}>
                Muat ulang data
              </Button>
            )}
          </form>
        )}
      </Dialog>
    </div>
  );
}
