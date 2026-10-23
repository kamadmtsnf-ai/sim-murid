"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { controlClass } from "@/components/domain-controls";
import { useDomainMutation } from "@/lib/education/use-mutation";
import {
  commands,
  diplomaFields,
  assetPrepare,
} from "@/lib/learning/validation";
import {
  promotionsSnapshot,
  mappingError,
  emptyMetadata,
  type PromotionsSnapshot,
  type PromotionRow,
  type PromotionCommand,
} from "@/lib/learning/promotions";
import { formatAcademicYear } from "@/lib/academic/period";
const api = "/api/learning/promotions",
  assetApi = "/api/learning/assets";
const fields: Record<(typeof diplomaFields)[number], string> = {
  kelas_lulus: "Kelas lulus",
  tahun_lulus: "Tahun lulus",
  nomor_ijazah: "Nomor ijazah",
  tanggal_ijazah: "Tanggal ijazah",
  kepala_sekolah: "Kepala madrasah",
  nip_kepala_sekolah: "NIP kepala madrasah",
  nilai_rata_rata: "Nilai rata-rata",
  predikat: "Predikat",
  nomor_transkrip: "Nomor transkrip",
  tanggal_transkrip: "Tanggal transkrip",
  nomor_skl: "Nomor SKL",
  tanggal_skl: "Tanggal SKL",
  keterangan_skl: "Keterangan SKL",
};
const roleLabel = {
  student: "Siswa",
  applicant: "Calon siswa",
  alumni: "Alumni",
};
const summaryFields = [
  "nomor_ijazah",
  "tahun_lulus",
  "nilai_rata_rata",
] as const;
const detailFields = diplomaFields.filter(
  (key) => !new Set<string>(summaryFields).has(key),
);
function DiplomaMetadata({
  row,
  keys,
}: {
  row: PromotionRow;
  keys: readonly (typeof diplomaFields)[number][];
}) {
  return (
    <dl className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {keys.map((key) => (
        <div key={key} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{fields[key]}</dt>
          <dd className="break-words text-sm">
            {String(row.diploma?.metadata[key] ?? "") || "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
type Asset = PromotionRow["assets"][number];
type Mode =
  | { type: "metadata"; row: PromotionRow }
  | { type: "upload"; row: PromotionRow }
  | { type: "delete"; row: PromotionRow; asset: Asset }
  | { type: "confirm"; command: PromotionCommand }
  | null;
export function PromotionsPanel({ initial }: { initial: PromotionsSnapshot }) {
  const [data, setData] = useState(initial),
    [tab, setTab] = useState(initial.isAdmin ? "mapping" : "documents"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [source, setSource] = useState(""),
    [target, setTarget] = useState(""),
    [action, setAction] = useState<"promote" | "place">("promote"),
    [mapping, setMapping] = useState<
      Record<string, { expectedClassId: string | null; destination: string }>
    >({}),
    [reason, setReason] = useState(""),
    [accessScope, setAccessScope] = useState("individual"),
    [view, setView] = useState(""),
    [download, setDownload] = useState(""),
    [globalView, setGlobalView] = useState(initial.extra.access.allow_view),
    [globalDownload, setGlobalDownload] = useState(
      initial.extra.access.allow_download,
    ),
    [selected, setSelected] = useState<string[]>([]),
    [mode, setMode] = useState<Mode>(null),
    [metadata, setMetadata] = useState<Record<string, string>>({}),
    [slot, setSlot] = useState("IJAZAH"),
    [ack, setAck] = useState(false),
    [dirty, setDirty] = useState(false),
    [reading, setReading] = useState(false),
    [assetBusy, setAssetBusy] = useState(false),
    [assetBlocked, setAssetBlocked] = useState(false),
    [notice, setNotice] = useState("");
  const lock = useRef(false),
    mounted = useRef(true),
    abortRef = useRef<AbortController | null>(null),
    trigger = useRef<HTMLElement | null>(null),
    feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);
  const { busy, blocked, message, feedbackRef, clear, fail, mutate } =
    useDomainMutation(
      api,
      promotionsSnapshot,
      "data",
      (next) => {
        setData(next);
        setMode(null);
        setDirty(false);
        setMapping({});
        setSelected([]);
        setReason("");
        setGlobalView(next.extra.access.allow_view);
        setGlobalDownload(next.extra.access.allow_download);
        trigger.current = document.getElementById("promotions-refresh");
      },
      { confirmed: true, commandSchema: commands.promotions },
    );
  const disabled = busy || blocked || reading || assetBusy || assetBlocked;
  const hasDraft =
    dirty ||
    Object.keys(mapping).length > 0 ||
    selected.length > 0 ||
    reason.length > 0;
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (hasDraft || busy || assetBusy) e.preventDefault();
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [hasDraft, busy, assetBusy]);
  const alumni = [
    ...new Map(
      data.rows
        .filter((r) => r.role === "alumni")
        .map((r) => [r.student_id, r]),
    ).values(),
  ];
  const sourceRows = data.rows.filter((r) => {
    const c = data.classes.find((c) => c.id === r.class_id);
    return (
      source &&
      (action !== "promote" || r.role !== "alumni") &&
      (!c || c.academic_year_id === source)
    );
  });
  const rows = (tab === "mapping" ? sourceRows : alumni).filter((r) =>
    (r.name + " " + r.student_id)
      .toLocaleLowerCase("id-ID")
      .includes(search.trim().toLocaleLowerCase("id-ID")),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 20)),
    visible = rows.slice(
      (Math.min(page, pages) - 1) * 20,
      Math.min(page, pages) * 20,
    );
  const destinations = data.classes.filter(
    (c) => c.academic_year_id === target && !c.archived_at,
  );
  const nameOf = (id: string) =>
    data.rows.find((r) => r.student_id === id)?.name ?? id;
  function discard() {
    return !hasDraft || window.confirm("Buang perubahan yang belum disimpan?");
  }
  function open(next: Mode, element: HTMLElement) {
    if (disabled) return;
    clear();
    setNotice("");
    trigger.current = element;
    setAck(false);
    if (next?.type !== "confirm") setDirty(false);
    setMode(next);
  }
  function close() {
    if (disabled) return;
    if (mode?.type === "confirm") {
      setMode(null);
      return;
    }
    if (dirty && !window.confirm("Buang perubahan yang belum disimpan?"))
      return;
    setMode(null);
    setDirty(false);
  }
  function changeTab(next: string) {
    if (disabled || !discard()) return false;
    setTab(next);
    setGlobalView(data.extra.access.allow_view);
    setGlobalDownload(data.extra.access.allow_download);
    setView("");
    setDownload("");
    setSearch("");
    setPage(1);
    setMapping({});
    setSelected([]);
    setReason("");
    setDirty(false);
    clear();
    setNotice("");
    return true;
  }
  async function read(signal: AbortSignal) {
    const r = await fetch(api, { cache: "no-store", signal });
    if (!r.ok) throw Error();
    return promotionsSnapshot.parse((await r.json()).data);
  }
  async function refresh() {
    if (lock.current || disabled || !discard()) return;
    lock.current = true;
    setReading(true);
    const abort = new AbortController();
    abortRef.current = abort;
    const timer = setTimeout(() => abort.abort(), 30000);
    try {
      const next = await read(abort.signal);
      if (mounted.current) {
        setData(next);
        setMapping({});
        setSelected([]);
        setReason("");
        setGlobalView(next.extra.access.allow_view);
        setGlobalDownload(next.extra.access.allow_download);
        setNotice("Data berhasil diperbarui.");
        setDirty(false);
        clear();
      }
    } catch {
      if (mounted.current)
        setNotice(
          "Data belum dapat dimuat. Data sebelumnya tetap ditampilkan.",
        );
    } finally {
      clearTimeout(timer);
      lock.current = false;
      if (mounted.current) setReading(false);
    }
  }
  function review(command: unknown, element: HTMLElement) {
    const parsed = commands.promotions.safeParse(command);
    if (!parsed.success) {
      fail("Periksa pilihan, isian wajib, dan batas 500 siswa per proses.");
      return;
    }
    const issue = mappingError(data, parsed.data);
    if (issue) {
      fail(issue);
      return;
    }
    open({ type: "confirm", command: parsed.data }, element);
  }
  function reviewMapping(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    review(
      {
        type: action,
        sourceYearId: source,
        targetYearId: target,
        items: Object.entries(mapping).map(([studentId, m]) => ({
          studentId,
          expectedClassId: m.expectedClassId,
          classId: m.destination === "alumni" ? null : m.destination,
        })),
        reason,
      },
      e.currentTarget.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      )!,
    );
  }
  async function save(command: PromotionCommand) {
    if (lock.current || disabled) return;
    lock.current = true;
    try {
      await mutate(data.revision, command);
    } finally {
      lock.current = false;
    }
  }
  async function assetMutation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      lock.current ||
      disabled ||
      !mode ||
      !(mode.type === "upload" || mode.type === "delete")
    )
      return;
    const operation = mode,
      form = e.currentTarget,
      file = new FormData(form).get("file");
    if (operation.type === "upload") {
      if (
        !(file instanceof File) ||
        !assetPrepare.safeParse({
          action: "prepare",
          kind: "diploma",
          targetId: operation.row.student_id,
          slot,
          filename: file.name,
          mime: file.type,
          size: file.size,
        }).success
      ) {
        setNotice(
          "Pilih PDF, JPG, atau PNG valid berukuran 1 byte hingga 50 MB.",
        );
        return;
      }
    }
    lock.current = true;
    setAssetBusy(true);
    setNotice(
      operation.type === "upload"
        ? "Mengunggah dan memvalidasi berkas…"
        : "Menghapus berkas…",
    );
    const abort = new AbortController();
    abortRef.current = abort;
    const timer = setTimeout(() => abort.abort(), 60000);
    let stage = "prepare";
    try {
      let id = operation.type === "delete" ? operation.asset.id : "";
      if (operation.type === "upload" && file instanceof File) {
        const prepared = await fetch(assetApi, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abort.signal,
          body: JSON.stringify({
            action: "prepare",
            kind: "diploma",
            targetId: operation.row.student_id,
            slot,
            filename: file.name,
            mime: file.type,
            size: file.size,
          }),
        });
        if (!prepared.ok) {
          setNotice(
            "Berkas belum dapat disiapkan. Periksa akses dan referensi, lalu coba kembali.",
          );
          return;
        }
        const parsed = z
          .object({
            id: z.uuid(),
            upload: z.object({ path: z.string(), token: z.string().min(1) }),
          })
          .parse(await prepared.json());
        id = parsed.id;
        if (parsed.upload.path !== `diploma/${operation.row.student_id}/${id}`)
          throw Error();
        const { createClient } = await import("@/lib/supabase/client");
        const stored = await Promise.race([
          createClient()
            .storage.from("learning-private")
            .uploadToSignedUrl(parsed.upload.path, parsed.upload.token, file, {
              contentType: file.type,
            }),
          new Promise<never>((_, reject) => {
            if (abort.signal.aborted) reject(Error());
            else
              abort.signal.addEventListener("abort", () => reject(Error()), {
                once: true,
              });
          }),
        ]);
        if (stored.error) throw Error();
      }
      stage = "write";
      const r = await fetch(assetApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({
          action: operation.type === "delete" ? "delete" : "finalize",
          id,
        }),
      });
      if (!r.ok) {
        if (r.status >= 500 || [401, 403].includes(r.status)) throw Error();
        setNotice(
          "Berkas belum diperbarui. Periksa isi berkas atau perubahan data, lalu muat ulang bila diperlukan.",
        );
        return;
      }
      const result = z
        .object({
          code: z.literal("saved"),
          id: z.uuid(),
          action: z.enum(["finalize", "delete"]),
        })
        .parse(await r.json());
      if (
        result.id !== id ||
        result.action !== (operation.type === "delete" ? "delete" : "finalize")
      )
        throw Error();
      const next = await read(abort.signal),
        row = next.rows.find((r) => r.student_id === operation.row.student_id);
      if (
        !row ||
        (operation.type === "delete"
          ? row.assets.some((a) => a.id === id)
          : !row.assets.some((a) => a.id === id && a.slot === slot))
      )
        throw Error();
      if (mounted.current) {
        setData(next);
        setMode(null);
        setDirty(false);
        setNotice("Berkas berhasil diperbarui.");
        trigger.current = document.getElementById("promotions-refresh");
      }
    } catch {
      if (mounted.current) {
        setAssetBlocked(true);
        setNotice(
          stage === "write"
            ? "Hasil pembaruan berkas belum dapat dipastikan. Muat ulang untuk memeriksa hasil sebelum mencoba kembali."
            : "Unggahan belum dapat dipastikan. Berkas lama tetap dipertahankan hingga validasi selesai. Muat ulang sebelum mencoba kembali.",
        );
      }
    } finally {
      clearTimeout(timer);
      lock.current = false;
      if (mounted.current) setAssetBusy(false);
    }
  }
  async function downloadAsset(asset: Asset) {
    if (lock.current || disabled) return;
    lock.current = true;
    setAssetBusy(true);
    setNotice("Menyiapkan unduhan…");
    const abort = new AbortController();
    abortRef.current = abort;
    const timer = setTimeout(() => abort.abort(), 60000);
    try {
      const r = await fetch(assetApi + "/" + asset.id + "?download=true", {
        cache: "no-store",
        signal: abort.signal,
      });
      if (!r.ok || !r.headers.get("content-type")?.includes(asset.mime))
        throw Error();
      const blob = await r.blob();
      if (!mounted.current) return;
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = asset.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Berkas siap diunduh.");
    } catch {
      if (mounted.current)
        setNotice(
          "Berkas belum dapat diunduh. Periksa akses dan coba kembali.",
        );
    } finally {
      clearTimeout(timer);
      lock.current = false;
      if (mounted.current) setAssetBusy(false);
    }
  }
  function pagination() {
    return (
      rows.length > 0 && (
        <nav
          aria-label="Pagination data"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm">
            {rows.length} data · Halaman {Math.min(page, pages)} dari {pages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={disabled || page <= 1}
              onClick={() => setPage((v) => v - 1)}
            >
              Sebelumnya
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={disabled || page >= pages}
              onClick={() => setPage((v) => v + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </nav>
      )
    );
  }
  return (
    <div className="promotions-panel min-w-0 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Kelola kenaikan dan penempatan siswa serta dokumen kelulusan. Data
          nilai, keuangan, dan arsip siswa tetap dipertahankan ketika status
          berubah.
        </p>
        <Button
          id="promotions-refresh"
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => void refresh()}
        >
          {reading ? "Memuat…" : "Muat ulang data"}
        </Button>
      </div>
      <div
        role="tablist"
        aria-label="Layanan kenaikan dan ijazah"
        className="flex flex-wrap gap-2"
      >
        {(data.isAdmin
          ? [
              ["mapping", "Kenaikan & penempatan"],
              ["documents", "Alumni & dokumen"],
              ["access", "Akses ijazah"],
            ]
          : [["documents", "Alumni & dokumen"]]
        ).map(([key, label], index, all) => (
          <Button
            key={key}
            id={"tab-" + key}
            type="button"
            role="tab"
            aria-controls={tab === key ? "panel-" + key : undefined}
            aria-selected={tab === key}
            tabIndex={tab === key ? 0 : -1}
            disabled={disabled}
            variant={tab === key ? "default" : "outline"}
            onKeyDown={(e) => {
              const step =
                e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              const next =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? all.length - 1
                    : step
                      ? (index + step + all.length) % all.length
                      : -1;
              if (next >= 0) {
                e.preventDefault();
                if (changeTab(all[next]![0]!))
                  document.getElementById("tab-" + all[next]![0]!)?.focus();
              }
            }}
            onClick={() => changeTab(key!)}
          >
            {label}
          </Button>
        ))}
      </div>
      {message && (
        <div
          role="status"
          tabIndex={-1}
          ref={feedbackRef}
          className="rounded-lg border p-3 text-sm"
        >
          {message}
        </div>
      )}
      {notice && (
        <div
          role="status"
          tabIndex={-1}
          ref={feedback}
          className="rounded-lg border p-3 text-sm"
        >
          {notice}
        </div>
      )}
      {(blocked || assetBlocked) && (
        <Button type="button" onClick={() => window.location.reload()}>
          Muat ulang halaman untuk memeriksa hasil
        </Button>
      )}
      <section
        role="tabpanel"
        id={"panel-" + tab}
        aria-labelledby={"tab-" + tab}
        className="min-w-0 space-y-4"
      >
        {tab === "mapping" && data.isAdmin && (
          <form
            onSubmit={reviewMapping}
            className="space-y-5 rounded-xl border bg-card p-4 sm:p-5"
          >
            <h2 className="text-xl font-semibold">
              Pratinjau kenaikan dan penempatan
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <label>
                Tindakan
                <select
                  className={controlClass}
                  value={action}
                  disabled={disabled}
                  onChange={(e) => {
                    if (!discard()) return;
                    setAction(e.target.value as typeof action);
                    setTarget("");
                    setMapping({});
                    setReason("");
                  }}
                >
                  <option value="promote">Kenaikan tahun berikutnya</option>
                  <option value="place">
                    Penempatan manual / pemulihan status
                  </option>
                </select>
              </label>
              <label>
                Tahun ajaran asal
                <select
                  className={controlClass}
                  required
                  value={source}
                  disabled={disabled}
                  onChange={(e) => {
                    if (!discard()) return;
                    setSource(e.target.value);
                    setTarget("");
                    setMapping({});
                    setReason("");
                    setPage(1);
                  }}
                >
                  <option value="">Pilih tahun asal</option>
                  {data.extra.years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {formatAcademicYear(y.start_year)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tahun ajaran tujuan
                <select
                  className={controlClass}
                  required
                  value={target}
                  disabled={disabled}
                  onChange={(e) => {
                    if (!discard()) return;
                    setTarget(e.target.value);
                    setMapping({});
                    setReason("");
                  }}
                >
                  <option value="">Pilih tahun tujuan</option>
                  {data.extra.years
                    .filter(
                      (y) =>
                        action === "place" ||
                        !source ||
                        y.start_year ===
                          data.extra.years.find((x) => x.id === source)!
                            .start_year +
                            1,
                    )
                    .map((y) => (
                      <option key={y.id} value={y.id}>
                        {formatAcademicYear(y.start_year)}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <p className="text-sm text-muted-foreground">
              Pilih siswa dan tujuan secara eksplisit. Calon siswa → kelas 7;
              kelas 7 → 8; kelas 8 → 9; kelas 9 → Alumni. Penempatan manual
              dapat memulihkan status alumni. Maksimal 500 siswa per proses.
            </p>
            <label className="block max-w-lg">
              Cari siswa
              <input
                className={controlClass}
                value={search}
                disabled={disabled}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                placeholder="Nama siswa"
              />
            </label>
            {!source ? (
              <p className="rounded-lg border border-dashed p-6">
                Pilih tahun ajaran asal untuk melihat siswa.
              </p>
            ) : !rows.length ? (
              <p className="rounded-lg border border-dashed p-6">
                Tidak ada siswa sesuai tahun ajaran dan pencarian.
              </p>
            ) : (
              visible.map((r) => {
                const m = mapping[r.student_id],
                  old = data.classes.find((c) => c.id === r.class_id);
                return (
                  <div
                    key={r.student_id + ":" + r.class_id}
                    className="grid min-w-0 gap-3 rounded-lg border p-3 sm:grid-cols-2"
                  >
                    <label className="flex min-w-0 items-start gap-3">
                      <input
                        className="mt-1 size-5 shrink-0"
                        type="checkbox"
                        disabled={disabled || !target}
                        checked={!!m}
                        onChange={(e) =>
                          setMapping((v) => {
                            const next = { ...v };
                            if (e.target.checked)
                              next[r.student_id] = {
                                expectedClassId: r.class_id,
                                destination: "",
                              };
                            else delete next[r.student_id];
                            return next;
                          })
                        }
                      />
                      <span className="min-w-0 break-words">
                        <strong className="block">{r.name}</strong>
                        <span className="text-sm text-muted-foreground">
                          {roleLabel[r.role]} ·{" "}
                          {old
                            ? old.name + " — " + formatAcademicYear(old.year)
                            : "Belum memiliki kelas aktif"}
                        </span>
                      </span>
                    </label>
                    <label className="min-w-0">
                      Kelas tujuan untuk {r.name}
                      <select
                        className={controlClass}
                        disabled={disabled || !m}
                        required={!!m}
                        value={m?.destination ?? ""}
                        onChange={(e) =>
                          setMapping((v) => ({
                            ...v,
                            [r.student_id]: {
                              expectedClassId:
                                v[r.student_id]?.expectedClassId ?? r.class_id,
                              destination: e.target.value,
                            },
                          }))
                        }
                      >
                        <option value="">Pilih tujuan</option>
                        {(action === "place" ||
                          (r.role === "student" && old?.level === 9)) && (
                          <option value="alumni">Alumni / lulus</option>
                        )}
                        {destinations
                          .filter(
                            (c) =>
                              action === "place" ||
                              (r.role === "applicant"
                                ? c.level === 7
                                : !!old &&
                                  old.level < 9 &&
                                  c.level === old.level + 1),
                          )
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} — {formatAcademicYear(c.year)}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                );
              })
            )}
            {pagination()}
            <p className="text-sm" aria-live="polite">
              {Object.keys(mapping).length} siswa dipilih; pilihan tetap
              tersimpan saat pencarian atau halaman berubah.
            </p>
            <label className="block">
              Alasan / referensi keputusan
              <textarea
                className={controlClass}
                required
                minLength={3}
                maxLength={2000}
                value={reason}
                disabled={disabled}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <Button
              type="submit"
              disabled={
                disabled ||
                !Object.keys(mapping).length ||
                Object.keys(mapping).length > 500
              }
            >
              Tinjau pemetaan
            </Button>
          </form>
        )}
        {(tab === "documents" || tab === "access") && (
          <>
            <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  Alumni sesuai hak akses
                </p>
                <p className="text-2xl font-semibold">{alumni.length}</p>
              </div>
              <label className="sm:col-span-2">
                Cari alumni
                <input
                  className={controlClass}
                  value={search}
                  disabled={disabled}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Nama alumni"
                />
              </label>
            </div>
            {tab === "access" && data.isAdmin && (
              <form
                className="space-y-4 rounded-xl border bg-card p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  review(
                    accessScope === "global"
                      ? {
                          type: "access",
                          scope: "global",
                          view: globalView,
                          download: globalDownload,
                        }
                      : {
                          type: "access",
                          scope: "individual",
                          studentIds: selected,
                          view,
                          download,
                        },
                    e.currentTarget.querySelector<HTMLButtonElement>(
                      'button[type="submit"]',
                    )!,
                  );
                }}
              >
                <h2 className="text-xl font-semibold">
                  Pengaturan akses ijazah
                </h2>
                <label className="block">
                  Cakupan
                  <select
                    className={controlClass}
                    value={accessScope}
                    disabled={disabled}
                    onChange={(e) => {
                      if (!discard()) return;
                      setAccessScope(e.target.value);
                      setSelected([]);
                      setDirty(false);
                    }}
                  >
                    <option value="individual">Alumni dipilih</option>
                    <option value="global">Pengaturan global</option>
                  </select>
                </label>
                <p className="text-sm text-muted-foreground">
                  Izin melihat dan mengunduh terpisah. Pengaturan global hanya
                  berlaku pada alumni yang mengikuti global (inherit). Alumni
                  baru tetap ditolak (deny).
                </p>
                {accessScope === "global" ? (
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-5"
                        checked={globalView}
                        disabled={disabled}
                        onChange={(e) => {
                          setGlobalView(e.target.checked);
                          setDirty(true);
                        }}
                      />
                      Global boleh melihat
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-5"
                        checked={globalDownload}
                        disabled={disabled}
                        onChange={(e) => {
                          setGlobalDownload(e.target.checked);
                          setDirty(true);
                        }}
                      />
                      Global boleh mengunduh
                    </label>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ["view", "Izin melihat", view],
                        ["download", "Izin mengunduh", download],
                      ].map(([key, label, value]) => (
                        <label key={key}>
                          {label}
                          <select
                            className={controlClass}
                            value={value}
                            required
                            disabled={disabled}
                            onChange={(e) => {
                              (key === "view" ? setView : setDownload)(
                                e.target.value,
                              );
                              setDirty(true);
                            }}
                          >
                            <option value="">Pilih kebijakan</option>
                            <option value="deny">Tolak (deny)</option>
                            <option value="inherit">
                              Ikuti global (inherit)
                            </option>
                            <option value="allow">Izinkan (allow)</option>
                          </select>
                        </label>
                      ))}
                    </div>
                    <fieldset className="space-y-2">
                      <legend>Pilih alumni target</legend>
                      {visible.map((r) => (
                        <label
                          key={r.student_id}
                          className="flex min-w-0 items-start gap-3 rounded-lg border p-3"
                        >
                          <input
                            type="checkbox"
                            className="mt-1 size-5 shrink-0"
                            disabled={disabled}
                            checked={selected.includes(r.student_id)}
                            onChange={(e) =>
                              setSelected((v) =>
                                e.target.checked
                                  ? [...v, r.student_id]
                                  : v.filter((id) => id !== r.student_id),
                              )
                            }
                          />
                          <span className="min-w-0 break-words">
                            <strong className="block">{r.name}</strong>
                            <span className="text-sm text-muted-foreground">
                              Override lihat:{" "}
                              {r.diploma?.view_override ?? "deny"} · unduh:{" "}
                              {r.diploma?.download_override ?? "deny"}
                            </span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <p className="text-sm">
                      {selected.length} alumni dipilih; maksimal 500 per proses.
                    </p>
                  </>
                )}
                <Button
                  type="submit"
                  disabled={
                    disabled ||
                    (accessScope === "individual" &&
                      (!selected.length || selected.length > 500))
                  }
                >
                  Tinjau pengaturan akses
                </Button>
              </form>
            )}
            {tab === "documents" &&
              visible.map((r) => (
                <article
                  key={r.student_id}
                  className="min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="min-w-0 break-words text-xl font-semibold">
                      {r.name}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      Lihat: {r.canView ? "diizinkan" : "ditolak"} · Unduh:{" "}
                      {r.canDownload ? "diizinkan" : "ditolak"}
                    </span>
                  </div>
                  {r.diploma ? (
                    <>
                      <DiplomaMetadata row={r} keys={summaryFields} />
                      <details className="rounded-lg border p-3">
                        <summary className="cursor-pointer py-2 text-sm font-medium underline focus-visible:outline-2">
                          Rincian metadata ijazah
                        </summary>
                        <div className="pt-3">
                          <DiplomaMetadata row={r} keys={detailFields} />
                        </div>
                      </details>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Metadata belum tersedia atau akses melihat tidak
                      diizinkan.
                    </p>
                  )}
                  {data.isAdmin && (
                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        onClick={(e) => {
                          setMetadata(emptyMetadata(r));
                          open({ type: "metadata", row: r }, e.currentTarget);
                        }}
                      >
                        Edit metadata
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        onClick={(e) => {
                          setSlot("IJAZAH");
                          open({ type: "upload", row: r }, e.currentTarget);
                        }}
                      >
                        Unggah / ganti berkas
                      </Button>
                    </div>
                  )}
                  {!r.assets.length && (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Belum ada berkas yang tersedia sesuai hak akses Anda.
                    </p>
                  )}
                  {r.assets.map((a) => (
                    <div
                      key={a.id}
                      className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <span className="min-w-0 break-words text-sm">
                        <strong>{a.slot}</strong> · {a.filename}
                      </span>
                      <div className="flex flex-wrap gap-3">
                        {r.canView && (
                          <a
                            className="inline-flex items-center rounded-lg border px-3 py-2 text-sm underline focus-visible:outline-2"
                            target="_blank"
                            rel="noreferrer"
                            href={assetApi + "/" + a.id}
                          >
                            Lihat {a.slot}
                          </a>
                        )}
                        {r.canDownload && (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={disabled}
                            onClick={() => void downloadAsset(a)}
                          >
                            Unduh {a.slot}
                          </Button>
                        )}
                        {data.isAdmin && (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={disabled}
                            onClick={(e) =>
                              open(
                                { type: "delete", row: r, asset: a },
                                e.currentTarget,
                              )
                            }
                          >
                            Hapus {a.slot}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </article>
              ))}
            {!rows.length && (
              <p className="rounded-xl border border-dashed p-8 text-center">
                Tidak ada alumni sesuai pencarian dan hak akses Anda.
              </p>
            )}
            {(tab === "documents" || accessScope === "individual") &&
              pagination()}
          </>
        )}
      </section>
      <Dialog
        open={!!mode}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={
          mode?.type === "metadata"
            ? "Edit metadata ijazah"
            : mode?.type === "upload"
              ? "Unggah dokumen alumni"
              : mode?.type === "delete"
                ? "Hapus dokumen alumni"
                : "Konfirmasi perubahan"
        }
        description="Periksa identitas dan rincian sebelum menyimpan perubahan."
        returnFocusRef={trigger}
        className="promotions-dialog"
      >
        {mode?.type === "metadata" && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save({
                type: "diploma",
                studentId: mode.row.student_id,
                metadata: metadata as Record<
                  (typeof diplomaFields)[number],
                  string
                >,
              });
            }}
          >
            <p className="font-semibold break-words">{mode.row.name}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {diplomaFields.map((key) => (
                <label key={key} className="min-w-0">
                  {fields[key]}
                  <input
                    className={controlClass}
                    maxLength={1000}
                    value={metadata[key] ?? ""}
                    disabled={disabled}
                    onChange={(e) => {
                      setMetadata((v) => ({ ...v, [key]: e.target.value }));
                      setDirty(true);
                    }}
                  />
                </label>
              ))}
            </div>
            {message && <p role="status">{message}</p>}
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={close}
              >
                Batal
              </Button>
              <Button disabled={disabled}>Simpan metadata</Button>
            </div>
          </form>
        )}
        {(mode?.type === "upload" || mode?.type === "delete") && (
          <form className="space-y-4" onSubmit={assetMutation}>
            <p className="break-words font-semibold">{mode.row.name}</p>
            {mode.type === "upload" ? (
              <>
                <label className="block">
                  Jenis berkas
                  <select
                    className={controlClass}
                    value={slot}
                    disabled={disabled}
                    onChange={(e) => {
                      setSlot(e.target.value);
                      setDirty(true);
                    }}
                  >
                    <option>IJAZAH</option>
                    <option>TRANSKRIP</option>
                    <option>SKL</option>
                  </select>
                </label>
                <p className="text-sm text-muted-foreground">
                  PDF, JPG, atau PNG; maksimal 50 MB. Berkas lama hanya diganti
                  setelah unggahan baru lolos validasi.
                </p>
                {mode.row.assets.some((a) => a.slot === slot) && (
                  <p className="text-sm">
                    Berkas {slot} yang sudah ada akan diganti.
                  </p>
                )}
                <label className="block">
                  Berkas dokumen
                  <input
                    className={controlClass}
                    type="file"
                    name="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    required
                    disabled={disabled}
                    onChange={() => setDirty(true)}
                  />
                </label>
              </>
            ) : (
              <>
                <p className="break-words">
                  Hapus {mode.asset.slot}: {mode.asset.filename}? Berkas ini
                  tidak lagi tersedia untuk dilihat atau diunduh setelah
                  dihapus.
                </p>
                <label className="flex items-start gap-3">
                  <input
                    className="mt-1 size-5 shrink-0"
                    type="checkbox"
                    checked={ack}
                    required
                    disabled={disabled}
                    onChange={(e) => setAck(e.target.checked)}
                  />
                  <span>
                    Saya telah memeriksa berkas dan alumni yang dipilih.
                  </span>
                </label>
              </>
            )}
            {notice && <p role="status">{notice}</p>}
            {assetBlocked && (
              <Button type="button" onClick={() => window.location.reload()}>
                Muat ulang untuk memeriksa berkas
              </Button>
            )}
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={close}
              >
                Batal
              </Button>
              <Button disabled={disabled || (mode.type === "delete" && !ack)}>
                {assetBusy
                  ? "Memproses…"
                  : mode.type === "delete"
                    ? "Konfirmasi hapus"
                    : "Unggah dan validasi"}
              </Button>
            </div>
          </form>
        )}
        {mode?.type === "confirm" && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (ack) void save(mode.command);
            }}
          >
            <p className="font-medium">
              {mode.command.type === "access"
                ? "Perubahan hak akses ijazah"
                : "Pemetaan siswa dan perubahan status"}
            </p>
            {mode.command.type === "promote" ||
            mode.command.type === "place" ? (
              <>
                <p className="text-sm">
                  {formatAcademicYear(
                    data.extra.years.find(
                      (y) =>
                        y.id ===
                        ("sourceYearId" in mode.command
                          ? mode.command.sourceYearId
                          : ""),
                    )?.start_year,
                  )}{" "}
                  →{" "}
                  {formatAcademicYear(
                    data.extra.years.find(
                      (y) =>
                        y.id ===
                        ("targetYearId" in mode.command
                          ? mode.command.targetYearId
                          : ""),
                    )?.start_year,
                  )}
                </p>
                <ul
                  tabIndex={0}
                  aria-label="Pratinjau pemetaan"
                  className="max-h-52 space-y-2 overflow-y-auto text-sm"
                >
                  {mode.command.items.map((item) => (
                    <li key={item.studentId} className="break-words">
                      {nameOf(item.studentId)} →{" "}
                      {item.classId
                        ? data.classes.find((c) => c.id === item.classId)?.name
                        : "Alumni / lulus"}
                    </li>
                  ))}
                </ul>
                <p className="text-sm break-words">
                  Alasan: {mode.command.reason}
                </p>
                <p className="text-sm text-muted-foreground">
                  Penempatan aktif lama ditutup; tugas piket dan penugasan
                  bimbingan aktif dicabut sesuai alur yang sudah berlaku.
                  Riwayat dan dokumen tetap disimpan.
                </p>
              </>
            ) : mode.command.type === "access" ? (
              <>
                <p className="text-sm">
                  Cakupan:{" "}
                  {mode.command.scope === "global"
                    ? "Global"
                    : `${mode.command.studentIds.length} alumni dipilih`}{" "}
                  · Lihat: {String(mode.command.view)} · Unduh:{" "}
                  {String(mode.command.download)}
                </p>
                {mode.command.scope === "individual" && (
                  <ul
                    tabIndex={0}
                    aria-label="Alumni target akses"
                    className="max-h-52 space-y-1 overflow-y-auto text-sm"
                  >
                    {mode.command.studentIds.map((id) => (
                      <li key={id} className="break-words">
                        {nameOf(id)}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}
            <label className="flex items-start gap-3">
              <input
                className="mt-1 size-5 shrink-0"
                type="checkbox"
                checked={ack}
                required
                disabled={disabled}
                onChange={(e) => setAck(e.target.checked)}
              />
              <span>
                Saya telah memeriksa identitas, tujuan, dan perubahan yang akan
                diproses.
              </span>
            </label>
            {message && <p role="status">{message}</p>}
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={close}
              >
                Batal
              </Button>
              <Button disabled={disabled || !ack}>
                {busy ? "Menyimpan…" : "Konfirmasi simpan"}
              </Button>
            </div>
          </form>
        )}
        {(blocked || assetBlocked) && (
          <Button
            type="button"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Muat ulang halaman
          </Button>
        )}
      </Dialog>
    </div>
  );
}
