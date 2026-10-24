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
  committeeSnapshot,
  committeeFilters,
  paymentContext,
  monthLocked,
  rupiah,
  type CommitteeSnapshot,
} from "@/lib/operations/committee";
const api = "/api/operations/fees",
  names = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
const statusLabels = {
  paid: "Dibayar",
  waived: "Pembebasan saudara",
  unpaid: "Belum dibayar",
};
const metricLabels: Record<string, string> = {
  cashReceived: "Uang masuk pada periode",
  waivedMonths: "Bulan pembebasan saudara",
  unpaidMonths: "Bulan belum dibayar",
  knownOutstanding: "Tunggakan dengan tarif diketahui",
  unknownTariffs: "Bulan tanpa tarif",
};
type Payment = CommitteeSnapshot["rows"][number];
export function CommitteePanel({ initial }: { initial: CommitteeSnapshot }) {
  const [data, setData] = useState(initial),
    [filters, setFilters] = useState<Record<string, string>>({
      year: initial.today.slice(0, 4),
    }),
    [reading, setReading] = useState(false),
    [notice, setNotice] = useState("");
  const [mode, setMode] = useState<"payment" | "tariff" | null>(null),
    [edit, setEdit] = useState<Payment | null>(null),
    [dirty, setDirty] = useState(false),
    [student, setStudent] = useState(""),
    [year, setYear] = useState(initial.today.slice(0, 4)),
    [allocations, setAllocations] = useState<Record<string, string>>({});
  const [contexts, setContexts] = useState<Record<string, CommitteeSnapshot>>(
      {},
    ),
    [contextBusy, setContextBusy] = useState(false),
    [contextError, setContextError] = useState(""),
    [contextStale, setContextStale] = useState(false);
  const [monthPage, setMonthPage] = useState(1),
    [monthSearch, setMonthSearch] = useState("");
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
  const params = (overrides: Record<string, string> = {}) =>
    new URLSearchParams({ ...filters, ...overrides }).toString();
  const { busy, blocked, message, phase, feedbackRef, clear, fail, mutate } =
    useDomainMutation(
      api + "?" + params(),
      committeeSnapshot,
      "data",
      (next) => {
        if (
          (edit && !next.rows.some((r) => r.id === edit.id)) ||
          !next.canManage
        )
          trigger.current = document.getElementById("committee-filter");
        setData(next);
        setMode(null);
        setEdit(null);
        setDirty(false);
        setAllocations({});
        setContexts({});
        setMonthPage(1);
        setNotice("");
      },
      { confirmed: true, commandSchema: commandSchemas.fees },
    );
  const disabled = reading || contextBusy || busy || blocked;
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty || busy) e.preventDefault();
    };
    const stopUnloadGuard = listenForUnsavedChanges(leave);
    return () => stopUnloadGuard();
  }, [dirty, busy]);
  const students = initial.people.filter((p) => p.role_code === "student");
  async function loadContexts(sid: string, years: string[], reset = false) {
    if (!sid || lock.current || busy || blocked) return;
    lock.current = true;
    setContextBusy(true);
    setContextError("");
    setContextStale(false);
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 30000),
      base = reset ? {} : contexts;
    try {
      const snapshots = await Promise.all(
        [...new Set(years)].map(async (y) => {
          if (base[y]) return [y, base[y]] as const;
          const response = await fetch(
            api +
              "?" +
              new URLSearchParams({ view: "payment", studentId: sid, year: y }),
            { cache: "no-store", signal: abort.signal },
          );
          if (!response.ok) throw Error("Unavailable");
          return [
            y,
            paymentContext((await response.json()).data, sid, Number(y)),
          ] as const;
        }),
      );
      if (!mounted.current) return;
      const next = Object.fromEntries(snapshots);
      if (Object.values(next).some((s) => s.revision !== data.revision)) {
        setContextStale(true);
        setContextError(
          "Data berubah sejak halaman dimuat. Muat ulang sebelum menyimpan pembayaran.",
        );
        return;
      }
      setContexts({ ...base, ...next });
    } catch {
      if (mounted.current && !abort.signal.aborted)
        setContextError(
          "Status bulan belum dapat dimuat. Coba muat status kembali sebelum menyimpan.",
        );
      else if (mounted.current)
        setContextError(
          "Pemuatan status bulan dibatalkan atau melewati batas waktu. Coba kembali.",
        );
    } finally {
      clearTimeout(timer);
      controller.current = null;
      lock.current = false;
      if (mounted.current) setContextBusy(false);
    }
  }
  function open(
    next: "payment" | "tariff",
    element: HTMLElement,
    row: Payment | null = null,
  ) {
    if (lock.current || disabled) return;
    trigger.current = element;
    setMode(next);
    setEdit(row);
    setDirty(false);
    setContextError("");
    setContextStale(false);
    setContexts({});
    clear();
    const y = row?.allocations[0]?.month.slice(0, 4) ?? data.today.slice(0, 4);
    setYear(y);
    setStudent(row?.student_id ?? "");
    setAllocations(
      Object.fromEntries(
        (row?.allocations ?? []).map((a) => [a.month, String(a.amount)]),
      ),
    );
    if (row)
      void loadContexts(
        row.student_id,
        [y, ...row.allocations.map((a) => a.month.slice(0, 4))],
        true,
      );
  }
  function close() {
    if (busy) return;
    if (!dirty || window.confirm("Buang perubahan yang belum disimpan?")) {
      controller.current?.abort();
      setMode(null);
      setEdit(null);
      setDirty(false);
      clear();
    }
  }
  async function load(next: Record<string, string>) {
    if (lock.current || disabled || mode) return;
    lock.current = true;
    setReading(true);
    setNotice("Memuat iuran…");
    clear();
    const abort = new AbortController(),
      timer = setTimeout(() => abort.abort(), 30000);
    controller.current = abort;
    try {
      const f = committeeFilters.parse(next),
        response = await fetch(
          api +
            "?" +
            new URLSearchParams(
              Object.entries(f).map(([k, v]) => [k, String(v)]),
            ),
          { cache: "no-store", signal: abort.signal },
        );
      if (!response.ok) throw Error("Unavailable");
      const snapshot = committeeSnapshot.parse((await response.json()).data);
      if (mounted.current) {
        setData(snapshot);
        setFilters(next);
        setMonthPage(1);
        setNotice("Data iuran diperbarui.");
      }
    } catch {
      if (mounted.current)
        setNotice(
          "Data belum dapat dimuat. Periksa tanggal, akses, dan koneksi, lalu coba lagi.",
        );
    } finally {
      clearTimeout(timer);
      controller.current = null;
      lock.current = false;
      if (mounted.current) setReading(false);
    }
  }
  async function save(command: unknown) {
    if (lock.current || busy || reading || blocked) return;
    const parsed = commandSchemas.fees.safeParse(command);
    if (!parsed.success) {
      fail(parsed.error.issues[0]?.message ?? "Periksa isian.");
      return;
    }
    lock.current = true;
    try {
      await mutate(data.revision, parsed.data);
    } finally {
      lock.current = false;
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      get = (k: string) => String(f.get(k) ?? "");
    if (mode === "tariff") {
      const command = {
        type: "tariff",
        classId: get("classId"),
        month: get("month") + "-01",
        amount: Number(get("amount")),
      };
      if (!commandSchemas.fees.safeParse(command).success) {
        fail("Pilih kelas, bulan, dan tarif rupiah bulat yang valid.");
        return;
      }
      if (
        window.confirm(
          "Simpan tarif " +
            rupiah(command.amount) +
            " untuk " +
            get("month") +
            "? Tarif bulan tersebut akan diperbarui.",
        )
      )
        void save(command);
      return;
    }
    if (contextBusy || contextStale || contextError) {
      fail("Muat status bulan yang valid sebelum menyimpan.");
      return;
    }
    const items = Object.entries(allocations).map(([month, amount]) => ({
      month,
      amount: Number(amount),
    }));
    if (!items.length) {
      fail("Pilih sedikitnya satu bulan pembayaran.");
      return;
    }
    if (
      items.some(
        (a) =>
          !contexts[a.month.slice(0, 4)] ||
          monthLocked(contexts[a.month.slice(0, 4)]!, a.month, student, edit),
      )
    ) {
      fail(
        "Periksa status seluruh bulan yang dipilih. Bulan dibayar/dibebaskan tidak dapat dibayar ulang.",
      );
      return;
    }
    if (get("date") > data.today) {
      fail("Tanggal pembayaran tidak boleh melewati hari ini.");
      return;
    }
    void save({
      type: "payment",
      id: edit?.id ?? null,
      studentId: student,
      date: get("date"),
      allocations: items,
      notes: get("notes"),
      ...(edit ? { reason: get("reason") } : {}),
    });
  }
  const selected = Object.entries(allocations).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const recap = data.extra.months.filter((m) =>
      (m.name + " " + m.month + " " + statusLabels[m.status])
        .toLocaleLowerCase("id-ID")
        .includes(monthSearch.trim().toLocaleLowerCase("id-ID")),
    ),
    recapRows = recap.slice((monthPage - 1) * 50, monthPage * 50);
  const feedback = (
    <div
      ref={feedbackRef}
      tabIndex={-1}
      role={phase === "error" || blocked ? "alert" : "status"}
      className="rounded-lg border bg-muted/30 p-3 text-sm"
    >
      {message ||
        notice ||
        "Pembayaran dan rekap ditampilkan sesuai hak akses Anda."}
      {blocked && (
        <Button
          type="button"
          className="mt-2"
          variant="outline"
          onClick={() => window.location.reload()}
        >
          Muat ulang data
        </Button>
      )}
    </div>
  );
  return (
    <div className="committee-panel min-w-0 space-y-6">
      {!mode && feedback}
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              Pembayaran dan rekap iuran
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Bulan iuran memakai tahun kalender; tanggal pembayaran dicatat
              terpisah.
            </p>
          </div>
          {data.canManage && (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={disabled}
                onClick={(e) => open("payment", e.currentTarget)}
              >
                Input pembayaran
              </Button>
              <Button
                variant="outline"
                disabled={disabled}
                onClick={(e) => open("tariff", e.currentTarget)}
              >
                Atur tarif bulanan
              </Button>
            </div>
          )}
        </div>
      </section>
      <section
        className="rounded-xl border bg-card p-4 sm:p-5"
        aria-labelledby="committee-filter"
      >
        <h2
          id="committee-filter"
          tabIndex={-1}
          className="text-lg font-semibold"
        >
          Filter iuran
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load({
              ...Object.fromEntries(
                [...new FormData(e.currentTarget)]
                  .filter(([, v]) => String(v))
                  .map(([k, v]) => [k, String(v)]),
              ),
              page: "1",
            });
          }}
        >
          <fieldset
            disabled={disabled}
            className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3"
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
            <TextField
              label="Dari tanggal pembayaran"
              name="start"
              type="date"
            />
            <TextField
              label="Sampai tanggal pembayaran"
              name="end"
              type="date"
            />
            <SelectField label="Kelas aktif siswa" name="classId">
              <option value="">Semua kelas sesuai izin</option>
              {initial.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
            <SelectField label="Siswa" name="studentId">
              <option value="">Semua siswa sesuai izin</option>
              {students.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} — {p.username}
                </option>
              ))}
            </SelectField>
            <Button type="submit" className="self-end">
              {reading ? "Memuat…" : "Terapkan filter"}
            </Button>
          </fieldset>
        </form>
      </section>
      <section
        aria-label="Ringkasan iuran"
        className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-5"
      >
        {Object.entries(data.summary).map(([k, v]) => (
          <div key={k} className="min-w-0 rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              {metricLabels[k] ?? k}
            </p>
            <p className="mt-2 break-words text-xl font-semibold tabular-nums">
              {k === "cashReceived" || k === "knownOutstanding"
                ? rupiah(v)
                : new Intl.NumberFormat("id-ID").format(v)}
            </p>
          </div>
        ))}
      </section>
      <p className="text-sm text-muted-foreground">
        Pembebasan saudara bernilai Rp0 dan terpisah dari uang masuk. Tunggakan
        hanya dihitung jika tarif diketahui; tarif yang belum tersedia tidak
        dianggap Rp0. Rekap bulan mengikuti bulan yang tercakup periode filter,
        sedangkan uang masuk mengikuti tanggal pembayaran.
      </p>
      {data.extra.trend.length > 0 && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Tren uang masuk</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {data.extra.trend.map((t) => (
              <div key={t.month}>
                <p className="text-sm">
                  {t.month} · {rupiah(t.value)}
                </p>
                <meter
                  className="w-full"
                  aria-label={"Uang masuk " + t.month}
                  min={0}
                  max={Math.max(1, ...data.extra.trend.map((t) => t.value))}
                  value={t.value}
                />
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="min-w-0 space-y-3" aria-busy={reading}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">
            Riwayat pembayaran ({data.total})
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
          Ekspor mengikuti filter dan hak akses yang sama. Maksimal 10.000
          pembayaran; persempit periode bila diperlukan.
        </p>
        <TableRegion label="Riwayat pembayaran — gulir untuk melihat seluruh kolom">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Pembayaran sesuai filter dan hak akses
            </caption>
            <thead>
              <tr>
                {[
                  "Tanggal pembayaran",
                  "Siswa",
                  "Bulan yang dibayar",
                  "Uang masuk",
                  "Keterangan",
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
                    {r.name}
                  </td>
                  <td className="min-w-40 border-b p-3">
                    {r.allocations.map((a) => (
                      <p key={a.month}>
                        {a.month.slice(0, 7)} · {rupiah(a.amount)}
                      </p>
                    ))}
                  </td>
                  <td className="whitespace-nowrap border-b p-3 font-medium">
                    {rupiah(r.amount)}
                  </td>
                  <td className="max-w-xs whitespace-pre-wrap break-words border-b p-3">
                    {r.notes || "—"}
                  </td>
                  <td className="border-b p-3">
                    {r.can_edit ? (
                      <Button
                        variant="outline"
                        disabled={disabled}
                        onClick={(e) => open("payment", e.currentTarget, r)}
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
            Belum ada pembayaran sesuai filter dan hak akses Anda.
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
            Riwayat sebelumnya
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
            Riwayat berikutnya
          </Button>
        </div>
      </section>
      <section className="min-w-0 space-y-3" aria-labelledby="committee-recap">
        <h2 id="committee-recap" className="text-xl font-semibold">
          Status bulanan siswa
        </h2>
        <label className="block text-sm">
          Cari pada rekap
          <input
            className={controlClass}
            value={monthSearch}
            placeholder="Nama, bulan, atau status"
            onChange={(e) => {
              setMonthSearch(e.target.value);
              setMonthPage(1);
            }}
          />
        </label>
        <p className="text-sm text-muted-foreground">
          {recap.length} baris sesuai pencarian, termasuk siswa yang belum
          pernah membayar.
        </p>
        <TableRegion label="Status bulanan — gulir untuk melihat seluruh kolom">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Status iuran menurut bulan alokasi
            </caption>
            <thead>
              <tr>
                {[
                  "Siswa",
                  "Bulan iuran",
                  "Status",
                  "Uang masuk",
                  "Tarif",
                  "Tunggakan diketahui",
                ].map((h) => (
                  <th scope="col" key={h} className="border-b p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recapRows.map((m) => (
                <tr key={m.student_id + ":" + m.month}>
                  <td className="min-w-40 max-w-64 break-words border-b p-3">
                    {m.name}
                  </td>
                  <td className="border-b p-3">{m.month.slice(0, 7)}</td>
                  <td className="border-b p-3">
                    {statusLabels[m.status]}
                    {m.status === "waived" && (
                      <p className="text-xs text-muted-foreground">
                        {m.waiverSources} sumber aktif
                      </p>
                    )}
                  </td>
                  <td className="border-b p-3">{rupiah(m.amount)}</td>
                  <td className="border-b p-3">
                    {m.tariff === null
                      ? "Tarif belum ditetapkan"
                      : rupiah(m.tariff)}
                  </td>
                  <td className="border-b p-3">
                    {m.outstanding === null
                      ? "Belum dapat dihitung"
                      : rupiah(m.outstanding)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
        {!recap.length && (
          <p className="rounded-lg border border-dashed p-4">
            Belum ada status bulanan sesuai pilihan dan hak akses.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={monthPage <= 1}
            onClick={() => setMonthPage((p) => p - 1)}
          >
            Rekap sebelumnya
          </Button>
          <span className="text-sm">
            Halaman rekap {monthPage} dari{" "}
            {Math.max(1, Math.ceil(recap.length / 50))}
          </span>
          <Button
            variant="outline"
            disabled={monthPage * 50 >= recap.length}
            onClick={() => setMonthPage((p) => p + 1)}
          >
            Rekap berikutnya
          </Button>
        </div>
      </section>
      <Dialog
        open={!!mode}
        onOpenChange={(value) => {
          if (!value) close();
        }}
        returnFocusRef={trigger}
        title={
          mode === "tariff"
            ? "Atur tarif bulanan"
            : edit
              ? "Koreksi pembayaran"
              : "Input pembayaran"
        }
        description={
          mode === "tariff"
            ? "Tarif berlaku untuk kelas dan bulan yang dipilih."
            : "Pilih bulan iuran dan nominal per bulan. Seluruh pilihan lintas tahun tetap dipertahankan."
        }
        className="committee-dialog"
      >
        {mode && (
          <form
            key={mode + "-" + (edit?.id ?? "new")}
            onSubmit={submit}
            onChange={() => setDirty(true)}
            className="space-y-4"
          >
            <fieldset disabled={disabled} className="min-w-0 space-y-4">
              {mode === "tariff" ? (
                <>
                  <SelectField label="Kelas" name="classId" required>
                    <option value="">Pilih kelas</option>
                    {initial.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </SelectField>
                  <label className="block text-sm">
                    Bulan tarif
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
                  <label className="block text-sm">
                    Tarif (Rp)
                    <input
                      className={controlClass}
                      name="amount"
                      type="number"
                      min="0"
                      max="1000000000000"
                      step="1"
                      required
                    />
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Rp0 adalah tarif yang diketahui. Tarif yang belum ditetapkan
                    tetap ditampilkan sebagai belum tersedia.
                  </p>
                </>
              ) : (
                <>
                  <label className="block text-sm">
                    Siswa
                    <select
                      className={controlClass}
                      required
                      value={student}
                      onChange={(e) => {
                        const sid = e.target.value;
                        setStudent(sid);
                        setContexts({});
                        setContextError("");
                        setContextStale(false);
                        if (sid)
                          void loadContexts(
                            sid,
                            [
                              year,
                              ...Object.keys(allocations).map((m) =>
                                m.slice(0, 4),
                              ),
                            ],
                            true,
                          );
                      }}
                    >
                      <option value="">Pilih siswa</option>
                      {students.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} — {p.username}
                        </option>
                      ))}
                      {edit &&
                        !students.some((p) => p.id === edit.student_id) && (
                          <option value={edit.student_id}>
                            {edit.name} (catatan lama)
                          </option>
                        )}
                    </select>
                  </label>
                  <label className="block text-sm">
                    Tanggal pembayaran
                    <input
                      className={controlClass}
                      name="date"
                      type="date"
                      min="2000-01-01"
                      max={data.today}
                      defaultValue={edit?.date ?? data.today}
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    Tahun bulan iuran
                    <select
                      className={controlClass}
                      value={year}
                      onChange={(e) => {
                        e.stopPropagation();
                        setYear(e.target.value);
                        if (student)
                          void loadContexts(student, [e.target.value]);
                      }}
                    >
                      {Array.from({ length: 101 }, (_, i) =>
                        String(2000 + i),
                      ).map((y) => (
                        <option key={y}>{y}</option>
                      ))}
                    </select>
                  </label>
                  {student && contexts[year] && (
                    <fieldset>
                      <legend className="font-medium">
                        Bulan iuran {year}
                      </legend>
                      <div className="mt-2 grid min-w-0 gap-3 sm:grid-cols-2">
                        {names.map((name, i) => {
                          const mo =
                              year +
                              "-" +
                              String(i + 1).padStart(2, "0") +
                              "-01",
                            context = contexts[year]!,
                            m = context.extra.months.find(
                              (m) => m.month === mo,
                            )!,
                            locked = monthLocked(context, mo, student, edit),
                            checked = Object.hasOwn(allocations, mo);
                          return (
                            <div
                              key={mo}
                              className="min-w-0 rounded-lg border p-3"
                            >
                              <label className="flex min-h-11 items-center gap-3 text-sm">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={locked && !checked}
                                  onChange={(e) =>
                                    setAllocations((prev) => {
                                      const next = { ...prev };
                                      if (e.target.checked)
                                        next[mo] =
                                          m.tariff && m.tariff > 0
                                            ? String(m.tariff)
                                            : "";
                                      else delete next[mo];
                                      return next;
                                    })
                                  }
                                />
                                {name} {year}
                              </label>
                              <p className="text-xs text-muted-foreground">
                                {statusLabels[m.status]} ·{" "}
                                {m.tariff === null
                                  ? "Tarif belum ditetapkan"
                                  : rupiah(m.tariff)}
                                {locked ? " — tidak dapat dibayar ulang" : ""}
                              </p>
                              {checked && (
                                <label className="mt-2 block text-sm">
                                  Nominal {mo.slice(0, 7)} (Rp)
                                  <input
                                    className={controlClass}
                                    type="number"
                                    min="1"
                                    max="1000000000000"
                                    step="1"
                                    required
                                    value={allocations[mo] ?? ""}
                                    onChange={(e) =>
                                      setAllocations((prev) => ({
                                        ...prev,
                                        [mo]: e.target.value,
                                      }))
                                    }
                                  />
                                </label>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </fieldset>
                  )}
                  <section
                    className="rounded-lg border bg-muted/20 p-3"
                    aria-label="Bulan terpilih"
                  >
                    <h3 className="font-medium">
                      {selected.length} bulan dipilih ·{" "}
                      {rupiah(
                        selected.reduce((n, [, v]) => n + (Number(v) || 0), 0),
                      )}
                    </h3>
                    {selected.length ? (
                      <ul className="mt-2 space-y-1 text-sm">
                        {selected.map(([mo, amount]) => (
                          <li
                            key={mo}
                            className="flex flex-wrap items-center justify-between gap-2"
                          >
                            <span>
                              {mo.slice(0, 7)} ·{" "}
                              {amount ? rupiah(Number(amount)) : "Isi nominal"}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              aria-label={"Hapus bulan " + mo.slice(0, 7)}
                              onClick={() => {
                                setDirty(true);
                                setAllocations((prev) => {
                                  const next = { ...prev };
                                  delete next[mo];
                                  return next;
                                });
                              }}
                            >
                              Hapus
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Belum ada bulan dipilih. Maksimal 12 bulan per
                        pembayaran.
                      </p>
                    )}
                  </section>
                  <TextField
                    label="Keterangan"
                    name="notes"
                    value={edit?.notes}
                    max={2000}
                  />
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
                    mode === "payment" &&
                    (!student ||
                      !contexts[year] ||
                      !!contextError ||
                      contextStale ||
                      selected.length > 12)
                  }
                >
                  {busy
                    ? "Menyimpan…"
                    : mode === "tariff"
                      ? "Simpan tarif"
                      : edit
                        ? "Simpan koreksi"
                        : "Simpan pembayaran"}
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
                      if (
                        window.confirm(
                          "Batalkan pembayaran ini? Alokasi dan pembebasan saudara terkait akan diperbarui.",
                        )
                      )
                        void save({ type: "void", id: edit.id, reason });
                    }}
                  >
                    Batalkan pembayaran
                  </Button>
                )}
              </div>
            </fieldset>
            {contextBusy && (
              <p role="status" className="text-sm">
                Memuat status bulan…
              </p>
            )}
            {contextError && (
              <div role="alert" className="space-y-2 text-sm">
                <p>{contextError}</p>
                {contextStale ? (
                  <Button
                    type="button"
                    onClick={() => window.location.reload()}
                  >
                    Muat ulang data
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    onClick={() =>
                      void loadContexts(
                        student,
                        [
                          year,
                          ...Object.keys(allocations).map((m) => m.slice(0, 4)),
                        ],
                        true,
                      )
                    }
                  >
                    Muat status kembali
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
