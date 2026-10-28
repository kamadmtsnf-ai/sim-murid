"use client";
import { Guidance } from "@/components/ui/guidance";
import {MutationFeedback} from "@/components/feedback/mutation-feedback";
import {confirmAction} from "@/components/ui/confirm-action";
import { Pagination, FilterBar } from "@/components/ui/collection-controls";
import { EmptyState } from "@/components/ui/content-state";
import { listenForUnsavedChanges } from "@/lib/forms/leave-guard";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TableRegion } from "@/components/ui/data-table";
import {
  TextField,
  SelectField,
  controlClass,
} from "@/components/domain-controls";
import { useDomainMutation } from "@/lib/education/use-mutation";
import { commandSchemas } from "@/lib/operations/validation";
import {
  savingsSnapshot,
  savingsFilters,
  savingsAmount,
  parseFeeQuote,
  rupiah,
  type SavingsSnapshot,
} from "@/lib/operations/savings";
import { SlipActions } from "./fees";
const api = "/api/operations/savings";
type Row = SavingsSnapshot["rows"][number];
type Bracket = NonNullable<SavingsSnapshot["extra"]["brackets"]>[number];
const kindLabels = {
  deposit: "Setoran",
  withdrawal: "Penarikan",
  reversal: "Pembalik",
};
const metrics = {
  balance: "Saldo keseluruhan",
  periodNet: "Mutasi bersih periode",
  deposits: "Setoran aktif periode",
  withdrawals: "Penarikan aktif periode",
};
export function SavingsPanel({ initial }: { initial: SavingsSnapshot }) {
  const [accounts, setAccounts] = useState(initial.extra.accounts);
  const [data, setData] = useState(initial),
    [filters, setFilters] = useState<Record<string, string>>({
      year: initial.today.slice(0, 4),
    }),
    [reading, setReading] = useState(false),
    [notice, setNotice] = useState("");
  const [mode, setMode] = useState<
      "transaction" | "account" | "bracket" | null
    >(null),
    [edit, setEdit] = useState<Row | null>(null),
    [editBracket, setEditBracket] = useState<Bracket | null>(null),
    [dirty, setDirty] = useState(false);
  const [kind, setKind] = useState<"deposit" | "withdrawal">("deposit"),
    [amount, setAmount] = useState(""),
    [feeApplied, setFeeApplied] = useState(false),
    [quote, setQuote] = useState<{
      amount: number;
      applied: boolean;
      data: ReturnType<typeof parseFeeQuote>;
    } | null>(null);
  const [auxBusy, setAuxBusy] = useState(false),
    [auxError, setAuxError] = useState(""),
    [feeReady, setFeeReady] = useState(true),
    [accountSearch, setAccountSearch] = useState(""),
    [accountPage, setAccountPage] = useState(1);
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
  const { busy, blocked, message, phase, feedbackRef, hint, clear, fail, mutate } =
    useDomainMutation(
      api + "?" + params(),
      savingsSnapshot,
      "data",
      (next) => {
        if (
          (edit && !next.rows.some((r) => r.id === edit.id)) ||
          !next.canManage
        )
          trigger.current = document.getElementById("savings-filter");
        setAccounts(
          (previous) =>
            next.extra.catalogAccounts ??
            Array.from(
              new Map(
                [...previous, ...next.extra.accounts].map((a) => [a.id, a]),
              ).values(),
            ),
        );
        setData(next);
        setMode(null);
        setEdit(null);
        setEditBracket(null);
        setDirty(false);
        setAccountPage(1);
        setNotice("");
      },
      { confirmed: true, commandSchema: commandSchemas.savings },
    );
  const disabled = reading || busy || auxBusy || blocked;
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty || busy) e.preventDefault();
    };
    const stopUnloadGuard = listenForUnsavedChanges(leave);
    return () => stopUnloadGuard();
  }, [dirty, busy]);
  // History filters never narrow transaction/account-opening controls.
  const owners = initial.people;
  const visibleAccounts = data.extra.accounts.filter((a) =>
      a.name
        .toLocaleLowerCase("id-ID")
        .includes(accountSearch.trim().toLocaleLowerCase("id-ID")),
    ),
    accountRows = visibleAccounts.slice(
      (accountPage - 1) * 24,
      accountPage * 24,
    );
  async function originalFee(row: Row) {
    if (!row.slip_id || lock.current) return;
    lock.current = true;
    setAuxBusy(true);
    setAuxError("");
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 30000);
    try {
      const r = await fetch("/api/slips/" + row.slip_id, {
        cache: "no-store",
        signal: abort.signal,
      });
      if (!r.ok) throw Error("Unavailable");
      const body = await r.json(),
        s = body.slip,
        t = s?.snapshot?.transaction,
        f = s?.snapshot?.fee;
      if (
        s?.reversed !== false ||
        t?.id !== row.id ||
        t?.account_id !== row.account_id ||
        t?.amount !== row.amount ||
        typeof f?.applied !== "boolean"
      )
        throw Error("Changed slip");
      const fee = parseFeeQuote(f, row.amount, f.applied);
      if (mounted.current) {
        setFeeApplied(fee.applied);
        setFeeReady(true);
      }
    } catch {
      if (mounted.current)
        setAuxError(
          "Biaya asli belum dapat dimuat. Periksa slip atau muat ulang data sebelum mengoreksi.",
        );
    } finally {
      clearTimeout(timer);
      controller.current = null;
      lock.current = false;
      if (mounted.current) setAuxBusy(false);
    }
  }
  function open(
    next: NonNullable<typeof mode>,
    element: HTMLElement,
    row: Row | null = null,
    bracket: Bracket | null = null,
  ) {
    if (disabled || lock.current) return;
    trigger.current = element;
    setMode(next);
    setEdit(row);
    setEditBracket(bracket);
    setDirty(false);
    setKind(row?.kind === "withdrawal" ? "withdrawal" : "deposit");
    setAmount(row ? String(row.amount) : "");
    setFeeApplied(false);
    setQuote(null);
    setAuxError("");
    const ready = !(row?.kind === "withdrawal" && row.slip_id);
    setFeeReady(ready);
    clear();
    if (!ready && row) void originalFee(row);
  }
  async function close() {
    if (busy) return;
    if (!dirty || await confirmAction("Buang perubahan yang belum disimpan?")) {
      controller.current?.abort();
      setMode(null);
      setEdit(null);
      setEditBracket(null);
      setDirty(false);
      clear();
    }
  }
  async function load(next: Record<string, string>) {
    if (lock.current || disabled || mode) return;
    lock.current = true;
    setReading(true);
    setNotice("Memuat tabungan…");
    clear();
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 30000);
    try {
      const f = savingsFilters.parse(next),
        r = await fetch(
          api +
            "?" +
            new URLSearchParams(
              Object.entries(f).map(([k, v]) => [k, String(v)]),
            ),
          { cache: "no-store", signal: abort.signal },
        );
      if (!r.ok) throw Error("Unavailable");
      const snapshot = savingsSnapshot.parse((await r.json()).data);
      if (mounted.current) {
        setData(snapshot);
        setFilters(next);
        setAccountPage(1);
        setNotice("Data tabungan diperbarui.");
      }
    } catch {
      if (mounted.current)
        setNotice(
          "Data belum dapat dimuat. Periksa periode, akses dan koneksi, lalu coba lagi.",
        );
    } finally {
      clearTimeout(timer);
      lock.current = false;
      controller.current = null;
      if (mounted.current) setReading(false);
    }
  }
  async function preview() {
    if (lock.current || disabled || kind !== "withdrawal") return;
    const parsed = savingsAmount.safeParse(Number(amount));
    if (!parsed.success) {
      fail("Nominal minimal Rp1.000 dan kelipatan Rp1.000.");
      return;
    }
    lock.current = true;
    setAuxBusy(true);
    setAuxError("");
    setQuote(null);
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 30000);
    try {
      const r = await fetch(
        "/api/slips/quote?" +
          new URLSearchParams({
            amount: String(parsed.data),
            apply: String(feeApplied),
          }),
        { cache: "no-store", signal: abort.signal },
      );
      if (!r.ok) throw Error("Unavailable");
      const result = parseFeeQuote(
        (await r.json()).quote,
        parsed.data,
        feeApplied,
      );
      if (mounted.current)
        setQuote({ amount: parsed.data, applied: feeApplied, data: result });
    } catch {
      if (mounted.current)
        setAuxError(
          "Pratinjau biaya belum dapat dimuat. Periksa nominal, akses, dan koneksi.",
        );
    } finally {
      clearTimeout(timer);
      lock.current = false;
      controller.current = null;
      if (mounted.current) setAuxBusy(false);
    }
  }
  async function save(command: unknown) {
    if (lock.current || disabled) return;
    const parsed = commandSchemas.savings.safeParse(command);
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
    if (mode === "account") {
      void save({
        type: "account",
        ownerId: get("ownerId"),
        category: get("category"),
      });
      return;
    }
    if (mode === "bracket") {
      void save({
        type: "bracket",
        id: editBracket?.id ?? null,
        minimum: Number(get("minimum")),
        maximum: get("maximum") ? Number(get("maximum")) : null,
        percent: Number(get("percent")),
        active: f.has("active"),
        ...(editBracket ? { reason: get("reason") } : {}),
      });
      return;
    }
    if (!feeReady) {
      fail("Muat biaya asli sebelum mengoreksi penarikan.");
      return;
    }
    if (get("date") > data.today) {
      fail("Tanggal transaksi tidak boleh melewati hari ini.");
      return;
    }
    void save({
      type: "transaction",
      id: edit?.id ?? null,
      accountId: edit?.account_id ?? get("accountId"),
      date: get("date"),
      kind,
      amount: Number(amount),
      feeApplied: kind === "withdrawal" && feeApplied,
      reason: get("reason"),
    });
  }
  const feedback = (
    <MutationFeedback ref={feedbackRef} tabIndex={-1} phase={phase} hint={hint}>
      {message ||
        notice ||
        "Saldo dan mutasi ditampilkan sesuai hak akses Anda."}
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
    </MutationFeedback>
  );
  return (
    <div className="savings-panel min-w-0 space-y-6">
      {!mode && feedback}
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              Rekening dan mutasi tabungan
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Saldo keseluruhan mencakup seluruh riwayat. Mutasi mengikuti
              periode filter.
            </p>
          </div>
          {data.canManage && (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={disabled}
                onClick={(e) => open("transaction", e.currentTarget)}
              >
                Input transaksi
              </Button>
              <Button
                variant="outline"
                disabled={disabled}
                onClick={(e) => open("account", e.currentTarget)}
              >
                Buka rekening
              </Button>
              <Button
                variant="outline"
                disabled={disabled}
                onClick={(e) => open("bracket", e.currentTarget)}
              >
                Tambah tarif biaya
              </Button>
            </div>
          )}
        </div>
      </section>
      <section
        className="rounded-xl border bg-card p-4 sm:p-5"
        aria-labelledby="savings-filter"
      >
        <h2 id="savings-filter" tabIndex={-1} className="text-lg font-semibold">
          Filter tabungan
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
          <FilterBar label="Filter mutasi tabungan" className="">
            <fieldset
              disabled={disabled}
              className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <label className="text-sm">
                Tahun kalender
                <input
                  name="year"
                  type="number"
                  min="2000"
                  max="2100"
                  defaultValue={filters.year}
                  className={controlClass}
                  required
                />
              </label>
              <TextField label="Dari tanggal" name="start" type="date" />
              <TextField label="Sampai tanggal" name="end" type="date" />
              <SelectField label="Pemilik rekening" name="studentId">
                <option value="">Semua pemilik sesuai izin</option>
                {owners.map((p) => (
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
      <section
        aria-label="Ringkasan tabungan"
        className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {Object.entries(data.summary).map(([k, v]) => (
          <div key={k} className="min-w-0 rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              {metrics[k as keyof typeof metrics]}
            </p>
            <p className="mt-2 break-words text-xl font-semibold tabular-nums">
              {rupiah(v)}
            </p>
          </div>
        ))}
      </section>
      <section className="min-w-0 space-y-3" aria-labelledby="savings-accounts">
        <h2 id="savings-accounts" className="text-xl font-semibold">
          Daftar rekening ({data.extra.accounts.length})
        </h2>
        <label className="block text-sm">
          Cari rekening
          <input
            className={controlClass}
            placeholder="Nama pemilik"
            value={accountSearch}
            onChange={(e) => {
              setAccountSearch(e.target.value);
              setAccountPage(1);
            }}
          />
        </label>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accountRows.map((a) => (
            <div key={a.id} className="min-w-0 rounded-xl border bg-card p-4">
              <h3 className="break-words font-medium">{a.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Kategori{" "}
                {a.category === "S"
                  ? "Siswa"
                  : a.category === "G"
                    ? "Guru"
                    : "Nasabah"}
              </p>
              <p className="mt-2 break-words text-xl font-semibold">
                {rupiah(a.balance)}
              </p>
            </div>
          ))}
        </div>
        {!accountRows.length && (
          <p className="rounded-lg border border-dashed p-4">
            Belum ada rekening sesuai pilihan dan hak akses.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={accountPage <= 1}
            onClick={() => setAccountPage((p) => p - 1)}
          >
            Rekening sebelumnya
          </Button>
          <span className="text-sm">
            Halaman rekening {accountPage} dari{" "}
            {Math.max(1, Math.ceil(visibleAccounts.length / 24))}
          </span>
          <Button
            variant="outline"
            disabled={accountPage * 24 >= visibleAccounts.length}
            onClick={() => setAccountPage((p) => p + 1)}
          >
            Rekening berikutnya
          </Button>
        </div>
      </section>
      {data.extra.trend.length > 0 && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Tren mutasi bersih</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nilai negatif menunjukkan pengurangan saldo; pembalik tetap
            diperhitungkan dalam ledger.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {data.extra.trend.map((t) => (
              <div key={t.month}>
                <p className="text-sm">
                  {t.month} · {rupiah(t.value)}
                </p>
                <meter
                  className="w-full"
                  aria-label={"Mutasi bersih " + t.month}
                  min={
                    -Math.max(
                      1,
                      ...data.extra.trend.map((t) => Math.abs(t.value)),
                    )
                  }
                  max={Math.max(
                    1,
                    ...data.extra.trend.map((t) => Math.abs(t.value)),
                  )}
                  value={t.value}
                />
              </div>
            ))}
          </div>
        </section>
      )}
      <p className="text-sm text-muted-foreground">
        Nominal minimal Rp1.000 dan kelipatan Rp1.000. Satu setoran aktif per
        rekening per hari. Penarikan mendebit saldo sebesar nominal; biaya
        mengurangi uang yang diterima, tanpa mendebit saldo dua kali. Koreksi
        dan pembatalan dicatat melalui transaksi pembalik.
      </p>
      {data.canManage && (
        <section
          className="rounded-xl border bg-card p-4 sm:p-5"
          aria-labelledby="savings-brackets"
        >
          <h2 id="savings-brackets" className="text-lg font-semibold">
            Tarif biaya penarikan
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Batas minimum dan maksimum termasuk rentang; maksimum kosong berarti
            tanpa batas. Rentang aktif tidak boleh bertumpang tindih.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(data.extra.brackets ?? []).map((b) => (
              <div key={b.id} className="min-w-0 rounded-lg border p-3">
                <p className="break-words font-medium">
                  {rupiah(b.minimum)} –{" "}
                  {b.maximum === null ? "Tanpa batas" : rupiah(b.maximum)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {b.percent}% · {b.active ? "Aktif" : "Nonaktif"}
                </p>
                <Button
                  className="mt-3"
                  variant="outline"
                  disabled={disabled}
                  onClick={(e) => open("bracket", e.currentTarget, null, b)}
                >
                  Ubah tarif
                </Button>
              </div>
            ))}
          </div>
          {!data.extra.brackets?.length && (
            <p className="mt-3 text-sm">Belum ada tarif biaya penarikan.</p>
          )}
        </section>
      )}
      <section className="min-w-0 space-y-3" aria-busy={reading}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">
            Riwayat mutasi ({data.total})
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
        <Guidance summary="Ketentuan ekspor tabungan">
          <p className="text-sm text-muted-foreground">
            Ekspor mengikuti filter dan izin yang sama, maksimal 10.000 mutasi.
            Persempit periode bila diperlukan.
          </p>
        </Guidance>
        <TableRegion label="Mutasi tabungan — gulir untuk melihat seluruh kolom">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Ledger tabungan sesuai filter dan hak akses
            </caption>
            <thead>
              <tr>
                {[
                  "Tanggal",
                  "Pemilik",
                  "Jenis / status",
                  "Nominal / mutasi",
                  "Saldo sesudah",
                  "Keterangan",
                  "Tindakan / slip",
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
                  <td className="border-b p-3">
                    {kindLabels[r.kind]}
                    {r.reversed && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Sudah dibalik
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap border-b p-3">
                    <p>{rupiah(r.amount)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Mutasi {rupiah(r.delta)}
                    </p>
                    {r.fee !== undefined && (
                      <p className="mt-1 text-xs">
                        Biaya {rupiah(r.fee)} · Diterima{" "}
                        {rupiah(r.cash_received ?? 0)}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap border-b p-3">
                    {rupiah(r.balance)}
                  </td>
                  <td className="max-w-xs whitespace-pre-wrap break-words border-b p-3">
                    {r.notes}
                  </td>
                  <td className="min-w-48 max-w-sm border-b p-3">
                    {r.can_edit && (
                      <Button
                        className="mb-2"
                        variant="outline"
                        disabled={disabled}
                        onClick={(e) => open("transaction", e.currentTarget, r)}
                      >
                        Koreksi
                      </Button>
                    )}
                    {r.slip_id && (
                      <SlipActions
                        id={r.slip_id}
                        canSend={data.canManage && !r.reversed}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
        {!data.rows.length && (
          <EmptyState title="Belum ada hasil">
            Belum ada mutasi sesuai filter dan hak akses Anda.
          </EmptyState>
        )}
        <Pagination
          label="Halaman mutasi tabungan"
          page={data.page}
          pageCount={Math.max(1, Math.ceil(data.total / data.pageSize))}
          disabled={disabled}
          onPageChange={(page) => void load({ ...filters, page: String(page) })}
        />
      </section>
      <Dialog closeDisabled={busy}
        open={!!mode}
        onOpenChange={async (value) => {
          if (!value) await close();
        }}
        returnFocusRef={trigger}
        title={
          mode === "account"
            ? "Buka rekening"
            : mode === "bracket"
              ? editBracket
                ? "Ubah tarif biaya"
                : "Tambah tarif biaya"
              : edit
                ? "Koreksi transaksi"
                : "Input transaksi"
        }
        description="Perubahan diperiksa kembali di server. Isi alasan yang jelas untuk transaksi dan koreksi."
        className="savings-dialog"
      >
        {mode && (
          <form
            key={mode + "-" + (edit?.id ?? editBracket?.id ?? "new")}
            onSubmit={submit}
            onChange={() => setDirty(true)}
            className="space-y-4"
          >
            <fieldset disabled={disabled} className="min-w-0 space-y-4">
              {mode === "account" ? (
                <>
                  <SelectField label="Pemilik rekening" name="ownerId" required>
                    <option value="">Pilih pemilik</option>
                    {owners
                      .filter((p) => !accounts.some((a) => a.owner_id === p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} — {p.username}
                        </option>
                      ))}
                  </SelectField>
                  <SelectField label="Kategori rekening" name="category">
                    <option value="S">Siswa</option>
                    <option value="G">Guru</option>
                    <option value="N">Nasabah</option>
                  </SelectField>
                  <Guidance summary="Tentang rekening tabungan">
                    <p className="text-sm text-muted-foreground">
                      Kategori rekening disimpan terpisah dari role pemilik. Satu
                      pemilik memiliki satu rekening.
                    </p>
                  </Guidance>
                </>
              ) : mode === "bracket" ? (
                <>
                  <label className="block text-sm">
                    Minimum (Rp)
                    <input
                      className={controlClass}
                      name="minimum"
                      type="number"
                      min="0"
                      max="1000000000000"
                      step="1"
                      defaultValue={editBracket?.minimum ?? 0}
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    Maksimum (Rp, kosong tanpa batas)
                    <input
                      className={controlClass}
                      name="maximum"
                      type="number"
                      min="0"
                      max="1000000000000"
                      step="1"
                      defaultValue={editBracket?.maximum ?? ""}
                    />
                  </label>
                  <label className="block text-sm">
                    Persentase (%)
                    <input
                      className={controlClass}
                      name="percent"
                      type="number"
                      min="0"
                      max="100"
                      step="0.0001"
                      defaultValue={editBracket?.percent ?? 0}
                      required
                    />
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={editBracket?.active ?? true}
                    />{" "}
                    Tarif aktif
                  </label>
                  {editBracket && (
                    <label className="block text-sm">
                      Alasan perubahan tarif
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
              ) : (
                <>
                  <SelectField
                    label="Rekening"
                    name="accountId"
                    value={edit?.account_id}
                    required
                  >
                    {edit ? (
                      <option value={edit.account_id}>
                        {edit.name} (rekening transaksi asal)
                      </option>
                    ) : (
                      <>
                        <option value="">Pilih rekening</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} — {a.category}
                          </option>
                        ))}
                      </>
                    )}
                  </SelectField>
                  <label className="block text-sm">
                    Tanggal transaksi
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
                    Jenis transaksi
                    <select
                      className={controlClass}
                      value={kind}
                      onChange={(e) => {
                        setKind(e.target.value as typeof kind);
                        setFeeApplied(false);
                        setQuote(null);
                      }}
                    >
                      <option value="deposit">Setoran</option>
                      <option value="withdrawal">Penarikan</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    Nominal (Rp)
                    <input
                      className={controlClass}
                      type="number"
                      min="1000"
                      max="1000000000000"
                      step="1000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </label>
                  {kind === "withdrawal" && (
                    <div className="space-y-3 rounded-lg border p-3">
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={feeApplied}
                          onChange={(e) => setFeeApplied(e.target.checked)}
                        />{" "}
                        Terapkan biaya penarikan
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void preview()}
                      >
                        Hitung biaya di server
                      </Button>
                      {quote &&
                        quote.amount === Number(amount) &&
                        quote.applied === feeApplied && (
                          <p role="status" className="text-sm">
                            Biaya {rupiah(quote.data.fee)} · Uang diterima{" "}
                            {rupiah(quote.data.cash)}
                            {!quote.data.matched
                              ? " · Tidak ada tarif yang cocok."
                              : ""}
                          </p>
                        )}
                      <p className="text-xs text-muted-foreground">
                        Pratinjau mengikuti tarif saat ini. Biaya final dicatat
                        pada slip; saldo didebit sebesar nominal penarikan.
                      </p>
                    </div>
                  )}
                  <label className="block text-sm">
                    Keterangan / alasan transaksi
                    <input
                      className={controlClass}
                      name="reason"
                      defaultValue={edit?.notes ?? ""}
                      minLength={3}
                      maxLength={2000}
                      required
                    />
                  </label>
                </>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={mode === "transaction" && !feeReady}
                >
                  {busy
                    ? "Menyimpan…"
                    : mode === "account"
                      ? "Simpan rekening"
                      : mode === "bracket"
                        ? "Simpan tarif"
                        : edit
                          ? "Simpan koreksi"
                          : "Simpan transaksi"}
                </Button>
                {edit && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={async (e) => {
const retainedEcurrentTarget=e.currentTarget;

                      const form = retainedEcurrentTarget.closest("form");
                      if (!form) return;
                      const reason = String(
                        new FormData(form).get("reason") ?? "",
                      ).trim();
                      if (reason.length < 3) {
                        fail("Isi alasan pembatalan minimal 3 karakter.");
                        return;
                      }
                      if (
                        await confirmAction(
                          "Batalkan transaksi ini melalui pembalik? Saldo akan diperiksa kembali.",
                        )
                      )
                        void save({ type: "void", id: edit.id, reason });
                    }}
                  >
                    Batalkan transaksi
                  </Button>
                )}
              </div>
            </fieldset>
            {auxBusy && (
              <p role="status" className="text-sm">
                Memuat biaya…
              </p>
            )}
            {auxError && (
              <div role="alert" className="space-y-2 text-sm">
                <p>{auxError}</p>
                {!feeReady && edit && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => void originalFee(edit)}
                  >
                    Muat biaya asli
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
