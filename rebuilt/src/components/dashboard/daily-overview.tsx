"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  CalendarDays,
  ClipboardList,
  ArrowDownLeft,
} from "lucide-react";
import {
  overviewSchema,
  overviewRoleLabels,
  overviewAssignmentLabels,
  type Overview,
} from "@/lib/dashboard/overview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Status } from "@/components/ui/status";
const dateFormat = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeZone: "Asia/Jakarta",
  }),
  stampFormat = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }),
  moneyFormat = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
const clock = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}.${String(n % 60).padStart(2, "0")}`;
export function DailyOverview({ initial }: { initial: Overview }) {
  const [data, setData] = useState<Overview | null>(initial),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const active = useRef<AbortController | null>(null),
    mounted = useRef(true),
    feedback = useRef<HTMLDivElement>(null),
    router = useRouter();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);
  async function refresh() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setMessage("");
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const r = await fetch("/api/account/overview", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!mounted.current) return;
      if (r.status === 401) {
        setData(null);
        setMessage("Sesi berakhir. Masuk kembali untuk melihat ringkasan.");
        router.replace("/login?expired=1");
        return;
      }
      if (r.status === 403) {
        setData(null);
        setMessage(
          "Akses berubah. Periksa kembali langkah keamanan akun Anda.",
        );
        const rejected = await r.json().catch(() => null);
        if (!mounted.current) return;
        if (
          rejected &&
          ["/account/security", "/account/services/surveys"].includes(
            rejected.redirect,
          )
        )
          router.replace(rejected.redirect);
        return;
      }
      const body = await r.json();
      if (!mounted.current) return;
      if (!r.ok) throw Error("Unavailable");
      const next = overviewSchema.parse(body.overview);
      if (next.subject !== initial.subject) {
        setData(null);
        setMessage("Akun berubah. Muat ulang halaman untuk melanjutkan.");
        return;
      }
      setData(next);
      setMessage("Ringkasan berhasil diperbarui.");
    } catch {
      if (mounted.current)
        setMessage(
          "Ringkasan belum dapat diperbarui. Data terakhir tetap ditampilkan sesuai waktu pembacaannya.",
        );
    } finally {
      clearTimeout(timer);
      if (active.current === controller) active.current = null;
      if (mounted.current) setBusy(false);
    }
  }
  const ready = data?.contextReady,
    hasFailure = data?.metrics.some((m) => m.state !== "ready"),
    role = data?.role ? overviewRoleLabels[data.role] : null;
  return (
    <section
      aria-labelledby="daily-overview-title"
      className="daily-overview min-w-0 space-y-5"
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="daily-overview-title" className="text-xl font-semibold">
            Ringkasan pekerjaan hari ini
          </h2>
          {data && (
            <p className="mt-1 text-sm text-muted-foreground">
              {dateFormat.format(new Date(data.today + "T12:00:00+07:00"))} ·
              WIB
            </p>
          )}
          {role && (
            <p className="mt-2 text-sm">
              {role}
              {data?.assignments
                .filter((a) => overviewAssignmentLabels[a])
                .map((a) => (
                  <span key={a}> · {overviewAssignmentLabels[a]}</span>
                ))}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void refresh()}
        >
          <RefreshCw
            className={busy ? "animate-spin" : ""}
            aria-hidden="true"
          />
          {busy ? "Memperbarui…" : "Perbarui ringkasan"}
        </Button>
      </div>
      {message && (
        <Status
          ref={feedback}
          tabIndex={-1}
          tone={
            message === "Ringkasan berhasil diperbarui." ? "success" : "warning"
          }
        >
          {message}
        </Status>
      )}
      {busy && <Status tone="pending">Memuat ringkasan terbaru…</Status>}
      {!ready ? (
        <Status tone="warning">
          Ringkasan pekerjaan belum dapat dimuat sesuai akses akun. Coba
          perbarui ringkasan; layanan lain tetap tersedia melalui sidebar.
        </Status>
      ) : (
        <>
          {hasFailure && (
            <Status tone="warning">
              Sebagian sumber belum tersedia. Angka yang belum dapat dipastikan
              tidak ditampilkan sebagai nol.
            </Status>
          )}
          {data.calendar === "holiday" && (
            <Status>
              Kalender madrasah menandai hari ini sebagai hari libur. Periksa
              layanan terkait bila ada penyesuaian kegiatan.
            </Status>
          )}
          {!data.metrics.length && (
            <Status>
              Belum ada sumber ringkasan yang tersedia untuk cakupan akun ini.
            </Status>
          )}
          <div
            className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3"
            role="group"
            aria-busy={busy}
            aria-label="Angka sesuai cakupan akses"
          >
            {data.metrics.map((m) => (
              <Card
                key={m.id}
                data-overview-source={m.id}
                className="min-w-0 py-5"
              >
                <CardContent className="min-w-0 space-y-3 px-5">
                  <h3 className="font-medium text-muted-foreground">
                    {m.label}
                  </h3>
                  <p className="text-2xl font-semibold tabular-nums wrap-anywhere">
                    {m.state === "ready"
                      ? (m.display ??
                        (m.value === null
                          ? "Belum dapat dihitung"
                          : m.format === "currency"
                            ? moneyFormat.format(m.value)
                            : m.value.toLocaleString("id-ID")))
                      : m.state === "denied"
                        ? "Akses tidak tersedia"
                        : "Belum tersedia"}
                  </p>
                  <p className="text-sm text-muted-foreground">{m.detail}</p>
                  <p className="border-t pt-3 text-xs text-muted-foreground wrap-anywhere">
                    Sumber: {m.module} · {m.period}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid min-w-0 gap-5 lg:grid-cols-2">
            <section
              className="min-w-0 rounded-xl border bg-card p-5"
              aria-labelledby="overview-tasks"
            >
              <h3
                id="overview-tasks"
                className="flex items-center gap-2 font-semibold"
              >
                <ClipboardList className="size-5 shrink-0" aria-hidden="true" />
                Prioritas Anda
              </h3>
              {data.tasks.length ? (
                <ul className="mt-4 space-y-4">
                  {data.tasks.map((t) => (
                    <li
                      key={t.id}
                      className="min-w-0 border-b pb-4 last:border-0 last:pb-0"
                    >
                      <span className="text-xs font-medium text-primary">
                        {t.priority === "review"
                          ? "Perlu pemeriksaan"
                          : t.priority === "today"
                            ? "Hari ini"
                            : "Informasi"}
                      </span>
                      <p className="mt-1 font-medium wrap-anywhere">
                        {t.title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground wrap-anywhere">
                        {t.detail}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  {hasFailure
                    ? "Prioritas belum dapat dirangkum dari seluruh sumber. Periksa layanan terkait melalui sidebar."
                    : "Tidak ada prioritas yang teridentifikasi dari sumber ringkasan ini. Tetap periksa layanan sesuai tanggung jawab Anda."}
                </p>
              )}
            </section>
            <section
              className="min-w-0 rounded-xl border bg-card p-5"
              aria-labelledby="overview-agenda"
            >
              <h3
                id="overview-agenda"
                className="flex items-center gap-2 font-semibold"
              >
                <CalendarDays className="size-5 shrink-0" aria-hidden="true" />
                Jadwal rutin berikutnya
              </h3>
              {data.agenda.length ? (
                <>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Menampilkan {data.agenda.length} dari {data.agendaCount}{" "}
                    jadwal yang belum selesai. Tahun ajaran aktif.
                  </p>
                  <ol className="mt-4 space-y-3">
                    {data.agenda.map((l, i) => (
                      <li key={i} className="min-w-0 rounded-lg border p-3">
                        <p className="text-sm font-semibold tabular-nums">
                          {clock(l.start)}–{clock(l.end)} WIB
                        </p>
                        <p className="mt-1 font-medium wrap-anywhere">
                          {l.subject}
                        </p>
                        <p className="text-sm text-muted-foreground wrap-anywhere">
                          {l.className}
                        </p>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  {data.calendar === "holiday"
                    ? "Jadwal rutin tidak ditampilkan pada hari libur."
                    : data.metrics.some(
                          (m) => m.id === "schedule" && m.state !== "ready",
                        )
                      ? "Jadwal belum dapat dimuat."
                      : data.metrics.some((m) => m.id === "schedule")
                        ? "Belum ada jadwal berikutnya yang tersedia sesuai cakupan dan tahun ajaran aktif."
                        : "Tidak ada ringkasan jadwal rutin untuk peran ini."}
                </p>
              )}
              {data.calendar === "unknown" &&
                data.metrics.some((m) => m.id === "schedule") && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Kalender belum terkonfirmasi. Periksa hari libur dan
                    perubahan kegiatan melalui layanan terkait.
                  </p>
                )}
            </section>
          </div>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <ArrowDownLeft
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            Buka layanan melalui sidebar untuk memeriksa rincian dan melakukan
            tindakan.
          </p>
        </>
      )}
      {data && (
        <p className="text-xs text-muted-foreground">
          Data dibaca {stampFormat.format(new Date(data.loadedAt))} WIB. Sumber
          dapat berubah setelah pembacaan.
        </p>
      )}
    </section>
  );
}
