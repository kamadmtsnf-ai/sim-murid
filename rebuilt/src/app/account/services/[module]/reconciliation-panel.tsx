"use client";
import { Guidance } from "@/components/ui/guidance";
import { formatAcademicYear } from "@/lib/academic/period";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Status } from "@/components/ui/status";
import { controlClass } from "@/components/domain-controls";
import type { ServiceSnapshot } from "@/lib/services/validation";
import {
  reconciliationSnapshot,
  reconciliationMetrics,
  packageQuery,
  packageDefaults,
} from "@/lib/services/reconciliation";
import { FloatingLabel } from "@/components/ui/floating-label";

const number = new Intl.NumberFormat("id-ID"),
  money = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
const excel =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export function ReconciliationPanel({ initial }: { initial: ServiceSnapshot }) {
  const [data, setData] = useState(() => reconciliationSnapshot.parse(initial)),
    [start, setStart] = useState(data.month),
    [end, setEnd] = useState(data.today),
    [month, setMonth] = useState(data.month.slice(0, 7)),
    [classId, setClassId] = useState(""),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [tone, setTone] = useState<"info" | "success" | "error">("info");
  const active = useRef(false),
    mounted = useRef(true),
    controller = useRef<AbortController | null>(null),
    feedback = useRef<HTMLDivElement>(null),
    urls = useRef(new Set<string>()),
    timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    mounted.current = true;
    const pendingTimers = timers.current,
      pendingUrls = urls.current;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      pendingTimers.forEach(clearTimeout);
      pendingTimers.clear();
      pendingUrls.forEach((url) => URL.revokeObjectURL(url));
      pendingUrls.clear();
    };
  }, []);
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);
  function notify(text: string, kind: typeof tone = "error") {
    setTone(kind);
    setMessage(text);
  }
  async function run(
    kind: "refresh" | "summary" | "package",
    query?: URLSearchParams,
  ) {
    if (active.current) return;
    active.current = true;
    setBusy(kind);
    setMessage("");
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 60000);
    try {
      const endpoint =
        kind === "package"
          ? "/api/services/exports?" + query
          : kind === "summary"
            ? "/api/services/reconciliation?format=xlsx"
            : "/api/services/reconciliation";
      const response = await fetch(endpoint, {
        cache: "no-store",
        signal: abort.signal,
      });
      if (!mounted.current) return;
      if (!response.ok) {
        let text = "";
        try {
          const body: unknown = await response.json();
          if (
            typeof body === "object" &&
            body !== null &&
            "message" in body &&
            typeof body.message === "string"
          )
            text = body.message.slice(0, 500);
        } catch {}
        throw Error(
          response.status === 401
            ? "Sesi berakhir. Muat ulang halaman untuk masuk kembali."
            : response.status === 403
              ? "Akses tidak diizinkan. Periksa sesi dan hak akses Anda."
              : text ||
                "Data belum dapat dimuat. Periksa koneksi dan coba kembali.",
        );
      }
      if (kind === "refresh") {
        const body: unknown = await response.json();
        const nextResult = reconciliationSnapshot.safeParse(
          typeof body === "object" && body !== null && "data" in body
            ? body.data
            : null,
        );
        if (!nextResult.success)
          throw Error(
            "Ringkasan belum valid. Muat ulang atau hubungi administrator.",
          );
        if (!mounted.current) return;
        setData(nextResult.data);
        notify(
          "Ringkasan diperbarui. Isian filter ekspor tetap dipertahankan.",
          "success",
        );
      } else {
        if (
          response.headers.get("Content-Type")?.split(";")[0]?.trim() !== excel
        )
          throw Error(
            "File ekspor belum valid. Coba kembali; tidak ada file yang dinyatakan siap.",
          );
        const blob = await response.blob(),
          prefix = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
        if (
          prefix[0] !== 0x50 ||
          prefix[1] !== 0x4b ||
          prefix[2] !== 3 ||
          prefix[3] !== 4
        )
          throw Error(
            "File ekspor tidak lengkap atau tidak valid. Coba kembali.",
          );
        if (!mounted.current) return;
        const url = URL.createObjectURL(blob);
        urls.current.add(url);
        const link = document.createElement("a");
        link.href = url;
        link.download =
          kind === "summary"
            ? "rekonsiliasi-ringkasan.xlsx"
            : "rekonsiliasi-paket.xlsx";
        document.body.append(link);
        link.click();
        link.remove();
        const cleanup = setTimeout(() => {
          URL.revokeObjectURL(url);
          urls.current.delete(url);
          timers.current.delete(cleanup);
        }, 10000);
        timers.current.add(cleanup);
        notify(
          "File siap diunduh. Periksa daftar unduhan browser Anda.",
          "success",
        );
      }
    } catch (error) {
      if (mounted.current)
        notify(
          error instanceof Error &&
            error.name !== "AbortError" &&
            !(error instanceof TypeError) &&
            !(error instanceof SyntaxError)
            ? error.message
            : "Permintaan belum selesai. Periksa koneksi dan coba kembali; tidak ada data aplikasi yang diubah.",
        );
    } finally {
      clearTimeout(timer);
      if (mounted.current) {
        active.current = false;
        setBusy("");
      }
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (active.current) return;
    const parsed = packageQuery.safeParse({
      domains: packageDefaults,
      start,
      end,
      month: month ? month + "-01" : "",
      ...(classId ? { classId } : {}),
    });
    if (!parsed.success) {
      notify(parsed.error.issues[0]?.message ?? "Periksa filter ekspor.");
      return;
    }
    if (classId && !data.classes.some((c) => c.id === classId)) {
      notify(
        "Pilihan kelas berubah. Pilih kembali kelas atau muat ulang ringkasan.",
      );
      return;
    }
    const params = new URLSearchParams({
      domains: packageDefaults,
      start,
      end,
      month: month + "-01",
    });
    if (classId) params.set("classId", classId);
    void run("package", params);
  }
  return (
    <div
      className="reconciliation-panel min-w-0 space-y-6"
      aria-busy={Boolean(busy)}
    >
      <p className="text-muted-foreground">
        Tinjau ringkasan data aplikasi dan unduh laporan lintas modul untuk
        pemeriksaan.
      </p>
      <Status>
        {data.extra.sourceAvailable
          ? "Data sumber pembanding tersedia. Tetap periksa hasil pencocokan sebelum menyatakan rekonsiliasi selesai."
          : "Data sumber pembanding belum tersedia. Ringkasan berikut menunjukkan data aplikasi, bukan hasil pencocokan atau bukti bahwa seluruh data sudah sesuai."}
      </Status>
      <div
        ref={feedback}
        tabIndex={-1}
        className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {message && <Status tone={tone}>{message}</Status>}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Ringkasan data aplikasi</h2>
          </CardTitle>
          <Guidance summary="Cakupan ringkasan">
            <p className="text-sm text-muted-foreground">
              Cakupan keseluruhan data sesuai izin Admin. Filter pada paket ekspor
              tidak mengubah ringkasan ini.
            </p>
          </Guidance>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reconciliationMetrics.map(([key, label]) => (
              <div key={key} className="min-w-0 rounded-lg border p-4">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="mt-1 break-words text-2xl font-semibold">
                  {key === "savingsBalance"
                    ? money.format(data.extra[key])
                    : number.format(data.extra[key])}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => void run("refresh")}
            >
              Muat ulang ringkasan
            </Button>
            <Button
              disabled={Boolean(busy)}
              onClick={() => void run("summary")}
            >
              Unduh ringkasan XLSX
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Paket laporan lintas modul</h2>
          </CardTitle>
          <Guidance summary="Cakupan paket ekspor">
            <p className="text-sm text-muted-foreground">
              Absensi siswa, bimbingan, iuran komite, tabungan, dan poin siswa.
              Ekspor mengikuti hak akses pada setiap modul.
            </p>
          </Guidance>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <fieldset
              disabled={Boolean(busy)}
              className="grid min-w-0 gap-4 sm:grid-cols-2"
            >
              <legend className="sr-only">Filter paket ekspor</legend>
              <div className="block text-sm"><FloatingLabel htmlFor="reconciliation-start" label={<>Tanggal awal operasional
                </>}><input placeholder=" "
                  id="reconciliation-start"
                  type="date"
                  required
                  min="2000-01-01"
                  max={end || "2100-12-31"}
                  className={controlClass}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                /></FloatingLabel>
              </div>
              <div className="block text-sm"><FloatingLabel htmlFor="reconciliation-end" label={<>Tanggal akhir operasional
                </>}><input placeholder=" "
                  id="reconciliation-end"
                  type="date"
                  required
                  min={start || "2000-01-01"}
                  max="2100-12-31"
                  className={controlClass}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                /></FloatingLabel>
              </div>
              <div className="block text-sm"><FloatingLabel htmlFor="reconciliation-month" label={<>Bulan poin siswa (SPK)
                </>}><input placeholder=" "
                  id="reconciliation-month"
                  type="month"
                  required
                  min="2000-01"
                  max="2100-12"
                  className={controlClass}
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  aria-describedby="reconciliation-month-help"
                /></FloatingLabel>
                <span
                  id="reconciliation-month-help"
                  className="mt-1 block text-sm text-muted-foreground"
                >
                  Saldo poin mengikuti bulan ini; laporan transaksi mengikuti
                  rentang tanggal operasional.
                </span>
              </div>
              <label className="block text-sm" htmlFor="reconciliation-class">
                Kelas
                <select
                  id="reconciliation-class"
                  className={controlClass}
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  <option value="">Semua sesuai izin</option>
                  {classId && !data.classes.some((c) => c.id === classId) && (
                    <option value={classId} disabled>
                      Kelas tidak tersedia — pilih kembali
                    </option>
                  )}
                  {data.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {data.years?.find((y) => y.id === c.academic_year_id)
                        ? " · " +
                          formatAcademicYear(
                            data.years?.find((y) => y.id === c.academic_year_id)
                              ?.start_year,
                          )
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
            <p className="text-sm text-muted-foreground">
              Jika data terlalu banyak atau berubah selama proses, persempit
              filter atau coba kembali. Hasil parsial tidak diserahkan sebagai
              laporan lengkap.
            </p>
            <Button type="submit" disabled={Boolean(busy)}>
              Unduh paket XLSX
            </Button>
          </form>
        </CardContent>
      </Card>
      {busy && (
        <p role="status">
          {busy === "refresh" ? "Memuat ringkasan…" : "Menyiapkan file XLSX…"}
        </p>
      )}
    </div>
  );
}
