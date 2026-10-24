"use client";
import { Pagination } from "@/components/ui/collection-controls";
import { listenForUnsavedChanges } from "@/lib/forms/leave-guard";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TableRegion } from "@/components/ui/data-table";
import { controlClass } from "@/components/domain-controls";
import { useDomainMutation } from "@/lib/education/use-mutation";
import { commands } from "@/lib/services/validation";
import {
  disciplineSnapshot,
  disciplineFilters,
  canCancelEvent,
  type DisciplineSnapshot,
} from "@/lib/services/discipline";
type Student = DisciplineSnapshot["rows"][number];
type Event = Student["snapshot"]["events"][number];
type Catalog = DisciplineSnapshot["extra"]["catalog"][number];
const api = "/api/services/discipline";
export function DisciplinePanel({
  initial,
  userId,
}: {
  initial: DisciplineSnapshot;
  userId: string;
}) {
  const [data, setData] = useState(initial),
    [filters, setFilters] = useState<Record<string, string>>({
      month: initial.month,
    }),
    [reading, setReading] = useState(false),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const [mode, setMode] = useState<
      "event" | "catalog" | "settings" | "archive" | "cancel" | null
    >(null),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [cancel, setCancel] = useState<{ row: Student; event: Event } | null>(null),
    [dirty, setDirty] = useState(false);
  const [eventDate, setEventDate] = useState(initial.today),
    [eventCode, setEventCode] = useState("");
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
      disciplineSnapshot,
      "data",
      (next) => {
        setData(next);
        setMode(null);
        setCatalog(null);
        setCancel(null);
        setDirty(false);
        trigger.current = document.getElementById("discipline-filter");
      },
      { confirmed: true, commandSchema: commands.discipline },
    );
  const disabled = busy || reading || blocked;
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty || busy) e.preventDefault();
    };
    const stopUnloadGuard = listenForUnsavedChanges(leave);
    return () => stopUnloadGuard();
  }, [dirty, busy]);
  const students = data.extra.recordingStudents ?? data.rows;
  const filtered = data.rows.filter((r) =>
      (r.name + " " + r.class_name)
        .toLocaleLowerCase("id-ID")
        .includes(search.trim().toLocaleLowerCase("id-ID")),
    ),
    rows = filtered.slice((page - 1) * 10, page * 10);
  const eligible = data.extra.catalog.filter((c) => c.active),
    selected = data.extra.catalog.find((c) => c.code === eventCode);
  function open(
    next: NonNullable<typeof mode>,
    element: HTMLElement,
    item: Catalog | null = null,
    event: { row: Student; event: Event } | null = null,
  ) {
    if (disabled || lock.current) return;
    trigger.current = element;
    setCatalog(item);
    setCancel(event);
    setDirty(false);
    setMode(next);
    setEventDate(
      data.month === data.today.slice(0, 7) + "-01" ? data.today : data.month,
    );
    setEventCode(eligible[0]?.code ?? "");
    clear();
  }
  function close() {
    if (busy) return;
    if (!dirty || window.confirm("Buang perubahan yang belum disimpan?")) {
      setMode(null);
      setDirty(false);
      setCancel(null);
      setCatalog(null);
      clear();
    }
  }
  async function load(next: Record<string, string>) {
    if (lock.current || disabled || mode) return;
    lock.current = true;
    setReading(true);
    setNotice("Memuat poin siswa…");
    clear();
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 30000);
    try {
      const f = disciplineFilters.parse(next),
        r = await fetch(
          api +
            "?" +
            new URLSearchParams(
              Object.entries(f).map(([k, v]) => [k, String(v)]),
            ),
          { cache: "no-store", signal: abort.signal },
        );
      if (!r.ok) throw Error();
      const value = disciplineSnapshot.parse((await r.json()).data);
      if (mounted.current) {
        setData(value);
        setFilters(next);
        setPage(1);
        setNotice("Data poin diperbarui.");
      }
    } catch {
      if (mounted.current)
        setNotice(
          "Data belum dapat dimuat. Periksa periode, akses dan koneksi. Data sebelumnya tetap ditampilkan.",
        );
    } finally {
      clearTimeout(timeout);
      controller.current = null;
      lock.current = false;
      if (mounted.current) setReading(false);
    }
  }
  async function save(command: unknown) {
    if (lock.current || disabled) return;
    await mutate(data.revision, command);
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      get = (k: string) => String(f.get(k) ?? "");
    let command: unknown;
    if (mode === "event") {
      if (eventDate > data.today) {
        fail("Tanggal kejadian tidak boleh melewati hari ini.");
        return;
      }
      command = {
        type: "event",
        studentId: get("studentId"),
        date: eventDate,
        code: eventCode,
        notes: get("notes"),
      };
    } else if (mode === "catalog") {
      command = {
        type: "catalog",
        code: catalog?.code ?? get("code").trim().toUpperCase(),
        category: get("category"),
        description: get("description"),
        points: Number(get("points")),
        consequence: get("consequence"),
        active: f.has("active"),
      };
      if (
        catalog &&
        !window.confirm(
          "Simpan perubahan katalog " +
            catalog.code +
            "? Kejadian lama tetap memakai katalog saat dicatat.",
        )
      )
        return;
    } else if (mode === "settings")
      command = {
        type: "settings",
        email: f.has("email"),
        whatsapp: f.has("whatsapp"),
        threshold: Number(get("threshold")),
        subjectId: get("subjectId") || null,
      };
    else if (mode === "cancel" && cancel) {
      if (
        !window.confirm(
          "Batalkan kejadian ini? Saldo dan urutan kejadian akan dihitung ulang.",
        )
      )
        return;
      command = { type: "cancel", id: cancel.event.id, reason: get("reason") };
    } else if (mode === "archive") {
      const month = get("month") + "-01";
      if (get("type") === "reset" && month >= data.today.slice(0, 7) + "-01") {
        fail("Pilih bulan yang sudah berakhir untuk diarsipkan.");
        return;
      }
      if (
        !window.confirm(
          (get("type") === "reset"
            ? "Arsipkan bulan "
            : "Sinkronkan nilai afektif dari arsip bulan ") +
            get("month") +
            "?",
        )
      )
        return;
      command = { type: get("type"), month };
    } else return;
    void save(command);
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
        "Poin dan riwayat ditampilkan sesuai hak akses Anda."}
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
    <div
      className="discipline-panel min-w-0 space-y-6"
      aria-busy={busy || reading}
    >
      {!mode && feedback}
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">
              Kedisiplinan dan apresiasi siswa
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Saldo awal 50 poin setiap bulan, dengan rentang −50 hingga 100.
              Riwayat lama tetap tersimpan.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.extra.canRecord && (
              <Button
                disabled={disabled}
                onClick={(e) => open("event", e.currentTarget)}
              >
                Catat kejadian
              </Button>
            )}
            {data.isAdmin && (
              <>
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={(e) => open("catalog", e.currentTarget)}
                >
                  Tambah kode poin
                </Button>
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={(e) => open("settings", e.currentTarget)}
                >
                  Pengaturan poin
                </Button>
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={(e) => open("archive", e.currentTarget)}
                >
                  Arsip dan nilai afektif
                </Button>
              </>
            )}
          </div>
        </div>
      </section>
      <section
        aria-labelledby="discipline-filter"
        className="rounded-xl border bg-card p-4 sm:p-5"
      >
        <h2
          id="discipline-filter"
          tabIndex={-1}
          className="text-lg font-semibold"
        >
          Filter poin siswa
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void load({
              month: String(f.get("month")) + "-01",
              ...(f.get("classId")
                ? { classId: String(f.get("classId")) }
                : {}),
            });
          }}
        >
          <fieldset
            disabled={disabled}
            className="mt-4 grid min-w-0 items-end gap-3 sm:grid-cols-3"
          >
            <label className="text-sm">
              Bulan laporan
              <input
                name="month"
                type="month"
                defaultValue={data.month.slice(0, 7)}
                className={controlClass}
                required
              />
            </label>
            <label className="text-sm">
              Kelas
              <select name="classId" className={controlClass}>
                <option value="">Semua sesuai izin</option>
                {initial.classes.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {String(c.name)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit">{reading ? "Memuat…" : "Tampilkan"}</Button>
          </fieldset>
        </form>
        <p className="mt-3 text-sm text-muted-foreground">
          Periode yang ditampilkan: {data.month.slice(0, 7)}. Ekspor mengikuti
          periode dan kelas ini; pencarian nama hanya menyaring tampilan.
        </p>
      </section>
      <section
        aria-label="Ringkasan poin"
        className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {[
          ["Siswa dalam cakupan", data.rows.length],
          [
            "Kejadian pelanggaran",
            data.rows.reduce((n, r) => n + r.snapshot.violations, 0),
          ],
          [
            "Kejadian apresiasi",
            data.rows.reduce((n, r) => n + r.snapshot.good, 0),
          ],
          ["Siswa dengan arsip", data.rows.filter((r) => r.archived).length],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 break-words text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>
      <section className="space-y-4" aria-busy={reading}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Saldo dan riwayat siswa</h2>
          <div className="flex flex-wrap gap-3">
            {[
              ["csv", "CSV"],
              ["xlsx", "Excel"],
              ["pdf", "PDF"],
              ["certificate", "Sertifikat"],
            ].map(([format, label]) => (
              <a
                key={format}
                className="inline-flex min-h-11 items-center underline"
                href={api + "?" + query({ ...filters, format: format! })}
              >
                Unduh {label}
              </a>
            ))}
          </div>
        </div>
        <label className="block text-sm">
          Cari nama atau kelas
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={controlClass}
            placeholder="Nama siswa atau kelas"
          />
        </label>
        <p className="text-sm text-muted-foreground">
          Tingkat 0–5 mengikuti saldo. R02 menandai tindak lanjut wali; R03
          menetapkan saldo 0 pada kejadian tersebut. Penanda ini bukan keputusan
          pengeluaran siswa.
        </p>
        {rows.map((row) => (
          <article
            key={row.student_id + row.class_id}
            className="min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words text-lg font-semibold">
                  {row.name}
                </h3>
                <p className="break-words text-sm text-muted-foreground">
                  {row.class_name} ·{" "}
                  {row.archived
                    ? "Arsip bulanan terkunci"
                    : "Riwayat bulan berjalan / belum diarsipkan"}
                </p>
              </div>
              <p className="text-xl font-semibold">
                {row.snapshot.balance} poin{" "}
                <span className="text-sm font-normal">
                  · Tingkat {row.snapshot.level}
                </span>
              </p>
            </div>
            <p className="text-sm">
              Pelanggaran {row.snapshot.violations} · Apresiasi{" "}
              {row.snapshot.good}
            </p>
            <details>
              <summary className="min-h-11 cursor-pointer py-2 font-medium">
                Riwayat kejadian ({row.snapshot.events.length})
              </summary>
              {row.snapshot.events.length ? (
                <TableRegion
                  label={
                    "Riwayat poin " + row.name + " — gulir untuk seluruh kolom"
                  }
                >
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">
                      Riwayat kejadian {row.name}
                    </caption>
                    <thead>
                      <tr>
                        {[
                          "Tanggal / kode",
                          "Kejadian / keterangan",
                          "Perubahan",
                          "Tindak lanjut",
                          "Tindakan",
                        ].map((h) => (
                          <th key={h} scope="col" className="border-b p-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {row.snapshot.events.map((event) => (
                        <tr key={event.id}>
                          <td className="whitespace-nowrap border-b p-3">
                            {event.event_date}
                            <p>{event.code}</p>
                          </td>
                          <td className="min-w-48 max-w-sm break-words border-b p-3">
                            <p>{event.catalog_snapshot.description}</p>
                            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                              {event.notes || "Tanpa keterangan tambahan"}
                            </p>
                          </td>
                          <td className="whitespace-nowrap border-b p-3">
                            {event.before} → {event.after}
                            <p className="text-xs text-muted-foreground">
                              {event.delta > 0 ? "+" : ""}
                              {event.delta} poin · Pengali {event.multiplier}×
                            </p>
                          </td>
                          <td className="min-w-40 max-w-xs break-words border-b p-3">
                            {event.r03
                              ? "R03 — saldo menjadi 0"
                              : event.r02
                                ? "R02 — tindak lanjut wali"
                                : "—"}
                            <p className="mt-1 text-xs">
                              {event.catalog_snapshot.consequence}
                            </p>
                          </td>
                          <td className="border-b p-3">
                            {canCancelEvent(data, row, event, userId) ? (
                              <Button
                                variant="outline"
                                disabled={disabled}
                                onClick={(e) =>
                                  open("cancel", e.currentTarget, null, {
                                    row,
                                    event,
                                  })
                                }
                              >
                                Batalkan kejadian
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">
                                {row.archived
                                  ? "Arsip terkunci"
                                  : "Hanya pembuat / admin"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableRegion>
              ) : (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Belum ada kejadian pada bulan ini.
                </p>
              )}
            </details>
          </article>
        ))}
        {!rows.length && (
          <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            Belum ada siswa sesuai periode, pencarian dan hak akses Anda.
          </p>
        )}
        <Pagination
          label="Halaman poin siswa"
          page={page}
          pageCount={Math.max(1, Math.ceil(filtered.length / 10))}
          onPageChange={setPage}
          previousLabel="Siswa sebelumnya"
          nextLabel="Siswa berikutnya"
        />
      </section>
      {data.isAdmin && (
        <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
          <h2 className="text-lg font-semibold">Katalog kejadian</h2>
          <p className="text-sm text-muted-foreground">
            Perubahan berlaku untuk pencatatan berikutnya. Riwayat lama
            mempertahankan rincian saat kejadian dicatat.
          </p>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.extra.catalog.map((c) => (
              <div key={c.code} className="min-w-0 rounded-lg border p-3">
                <h3 className="break-words font-medium">
                  {c.code} · {c.category}
                </h3>
                <p className="mt-1 break-words text-sm">{c.description}</p>
                <p className="mt-2 text-sm">
                  {c.points > 0 ? "+" : ""}
                  {c.points} poin · {c.active ? "Aktif" : "Nonaktif"}
                </p>
                <Button
                  className="mt-3"
                  variant="outline"
                  disabled={disabled}
                  onClick={(e) => open("catalog", e.currentTarget, c)}
                >
                  Ubah {c.code}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
      <Dialog
        open={mode !== null}
        onOpenChange={(v) => {
          if (!v) close();
        }}
        returnFocusRef={trigger}
        className="discipline-dialog"
        title={
          mode === "catalog"
            ? catalog
              ? "Ubah kode poin"
              : "Tambah kode poin"
            : mode === "settings"
              ? "Pengaturan poin"
              : mode === "archive"
                ? "Arsip dan nilai afektif"
                : mode === "cancel"
                  ? "Batalkan kejadian"
                  : "Catat kejadian"
        }
        description="Periksa isian sebelum menyimpan. Hak akses, periode, dan perhitungan diperiksa kembali sebelum disimpan."
      >
        {mode && (
          <form
            key={mode + "-" + (catalog?.code ?? cancel?.event.id ?? "new")}
            onSubmit={submit}
            onChange={() => setDirty(true)}
            className="space-y-4"
          >
            <fieldset disabled={disabled} className="min-w-0 space-y-4">
              {mode === "event" ? (
                <>
                  <label className="block text-sm">
                    Siswa
                    <select name="studentId" className={controlClass} required>
                      <option value="">Pilih siswa</option>
                      {students.map((r) => (
                        <option
                          key={r.student_id + ":" + r.class_id}
                          value={r.student_id}
                        >
                          {r.name} — {r.class_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    Tanggal kejadian
                    <input
                      type="date"
                      value={eventDate}
                      max={data.today}
                      className={controlClass}
                      required
                      onChange={(e) => setEventDate(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    Kode kejadian
                    <select
                      value={eventCode}
                      onChange={(e) => setEventCode(e.target.value)}
                      className={controlClass}
                      required
                    >
                      <option value="">Pilih kode</option>
                      {eligible.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.description} ({c.points > 0 ? "+" : ""}
                          {c.points})
                        </option>
                      ))}
                    </select>
                  </label>
                  {selected && (
                    <p className="rounded-lg border p-3 text-sm">
                      {selected.category} · {selected.points} poin dasar.{" "}
                      {selected.consequence ||
                        "Tindak lanjut mengikuti ketentuan madrasah."}{" "}
                      Saldo akhir dan pengali mengikuti urutan kejadian.
                    </p>
                  )}
                  <label className="block text-sm">
                    Keterangan
                    <textarea
                      name="notes"
                      maxLength={2000}
                      className={controlClass}
                      rows={3}
                    />
                  </label>
                  {eventDate.slice(0, 7) !== data.month.slice(0, 7) && (
                    <p role="status" className="text-sm">
                      Kejadian ini masuk bulan {eventDate.slice(0, 7)}, berbeda
                      dengan periode laporan. Sesuaikan filter setelah menyimpan
                      untuk melihatnya.
                    </p>
                  )}
                  {!eligible.length && (
                    <p role="alert">
                      Belum ada kode aktif. Hubungi admin untuk mengaktifkan
                      katalog.
                    </p>
                  )}
                </>
              ) : mode === "catalog" ? (
                <>
                  <label className="block text-sm">
                    Kode
                    <input
                      name="code"
                      defaultValue={catalog?.code ?? ""}
                      readOnly={!!catalog}
                      pattern="[A-I][0-9]{2}"
                      maxLength={3}
                      placeholder="A01"
                      className={controlClass}
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    Kategori
                    <input
                      name="category"
                      defaultValue={catalog?.category ?? ""}
                      maxLength={2000}
                      className={controlClass}
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    Deskripsi
                    <textarea
                      name="description"
                      defaultValue={catalog?.description ?? ""}
                      maxLength={2000}
                      rows={3}
                      className={controlClass}
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    Poin dasar
                    <input
                      name="points"
                      type="number"
                      min={-100}
                      max={100}
                      step={1}
                      defaultValue={catalog?.points ?? 0}
                      className={controlClass}
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    Konsekuensi / tindak lanjut
                    <textarea
                      name="consequence"
                      defaultValue={catalog?.consequence ?? ""}
                      maxLength={2000}
                      rows={2}
                      className={controlClass}
                    />
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={catalog?.active ?? true}
                    />
                    Kode aktif
                  </label>
                </>
              ) : mode === "settings" ? (
                <>
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="email"
                      defaultChecked={data.extra.settings.email_enabled}
                    />
                    Aktifkan antrean email
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="whatsapp"
                      defaultChecked={data.extra.settings.whatsapp_enabled}
                    />
                    Aktifkan antrean WhatsApp
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Email memerlukan alamat terverifikasi; WhatsApp memerlukan
                    nomor E.164 dan layanan pengiriman yang dikonfigurasi.
                  </p>
                  <label className="block text-sm">
                    Ambang tingkat notifikasi
                    <input
                      name="threshold"
                      type="number"
                      min={0}
                      max={5}
                      step={1}
                      defaultValue={data.extra.settings.point_threshold}
                      className={controlClass}
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    Mapel nilai afektif
                    <select
                      name="subjectId"
                      defaultValue={
                        data.extra.settings.affective_subject_id ?? ""
                      }
                      className={controlClass}
                    >
                      <option value="">Belum ditetapkan</option>
                      {data.extra.settings.affective_subject_id &&
                        !data.subjects?.some(
                          (s) =>
                            s.id === data.extra.settings.affective_subject_id,
                        ) && (
                          <option
                            value={data.extra.settings.affective_subject_id}
                          >
                            Mapel tersimpan (nonaktif / tidak tersedia)
                          </option>
                        )}
                      {data.subjects?.map((s) => (
                        <option key={String(s.id)} value={String(s.id)}>
                          {String(s.name)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : mode === "archive" ? (
                <>
                  <label className="block text-sm">
                    Tindakan
                    <select name="type" className={controlClass}>
                      <option value="reset">
                        Arsipkan bulan yang sudah berakhir
                      </option>
                      <option value="affective">
                        Sinkron nilai afektif dari arsip
                      </option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    Bulan sumber
                    <input
                      name="month"
                      type="month"
                      className={controlClass}
                      required
                    />
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Arsip bulanan tidak dapat diubah. Sinkronisasi memakai arsip
                    dan mapel yang dipilih di pengaturan; data yang sudah ada
                    tidak ditimpa.
                  </p>
                </>
              ) : (
                <>
                  <p className="break-words text-sm">
                    {cancel?.row.name} · {cancel?.event.event_date} ·{" "}
                    {cancel?.event.code}
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
              )}
              <Button
                type="submit"
                disabled={mode === "event" && !eligible.length}
              >
                {busy
                  ? "Menyimpan…"
                  : mode === "cancel"
                    ? "Konfirmasi pembatalan"
                    : mode === "archive"
                      ? "Jalankan tindakan"
                      : "Simpan"}
              </Button>
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
