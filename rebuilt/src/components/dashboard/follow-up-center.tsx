"use client";
import { Guidance } from "@/components/ui/guidance";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Tabs } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Status } from "@/components/ui/status";
import { FilterBar, Pagination } from "@/components/ui/collection-controls";
import { controlClass } from "@/components/domain-controls";
import {
  followUpSchema,
  followUpPreferences,
  visibleFollowUps,
  type FollowUp,
} from "@/lib/dashboard/follow-up";
import { FloatingLabel } from "@/components/ui/floating-label";

const statuses = {
  needs_action: "Perlu tindak lanjut",
  in_progress: "Dalam proses",
  done: "Selesai di sumber",
  no_action: "Tidak ada prioritas baru",
  unavailable: "Belum dapat diperiksa",
};
const urgency = {
  review: "Perlu pemeriksaan",
  overdue: "Lewat target",
  today: "Hari ini",
  info: "Informasi",
};
const stamp = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});
function date(v: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(new Date(v + "T12:00:00Z"));
}
export function FollowUpCenter({
  userId,
  inbox,
}: {
  userId: string;
  inbox: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState("inbox");
  const [data, setData] = useState<FollowUp | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [showInformation, setShowInformation] = useState(true),
    [preferenceError, setPreferenceError] = useState(false);
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [module, setModule] = useState("all"),
    [status, setStatus] = useState("all"),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  const mounted = useRef(false),
    request = useRef<AbortController | null>(null),
    results = useRef<HTMLHeadingElement>(null);
  const key = `sim-murid:follow-up-view:v1:${userId}`;
  useEffect(() => {
    function read() {
      try {
        const raw = localStorage.getItem(key),
          p = raw ? followUpPreferences.safeParse(JSON.parse(raw)) : null;
        setShowInformation(p?.success ? p.data.showInformation : true);
      } catch {
        setPreferenceError(true);
      }
    }
    read();
    const sync = (e: StorageEvent) => {
      if (e.key === key || e.key === null) read();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);
  async function refresh() {
    if (request.current) return;
    const c = new AbortController();
    request.current = c;
    setPending(true);
    setError(null);
    const timer = setTimeout(() => c.abort("timeout"), 20000);
    try {
      const r = await fetch("/api/account/follow-up", {
        cache: "no-store",
        signal: c.signal,
      });
      if (!mounted.current || c.signal.aborted) return;
      if (r.status === 401 || r.status === 403) {
        setData(null);
        setError(
          r.status === 401
            ? "Sesi berakhir. Masuk kembali untuk memuat tindak lanjut."
            : "Akses berubah atau survei wajib belum selesai. Periksa keamanan akun dan Survei melalui sidebar.",
        );
        return;
      }
      if (!r.ok) throw Error("Unavailable");
      const fresh = followUpSchema.parse((await r.json()).followUp);
      if (!mounted.current || c.signal.aborted) return;
      if (fresh.subject !== userId) {
        setData(null);
        setError("Akun berubah. Muat ulang halaman untuk melanjutkan.");
        return;
      }
      setData(fresh);
      setPage(1);
      setModule("all");
      requestAnimationFrame(() => {
        if (mounted.current && results.current?.getClientRects().length)
          results.current.focus();
      });
    } catch {
      if (
        mounted.current &&
        (!c.signal.aborted || c.signal.reason === "timeout")
      )
        setError(
          "Tindak lanjut belum dapat diperbarui. Jika ada, snapshot terakhir masih ditampilkan; statusnya perlu diperiksa kembali.",
        );
    } finally {
      clearTimeout(timer);
      if (request.current === c) {
        request.current = null;
        if (mounted.current) setPending(false);
      }
    }
  }
  function preference(checked: boolean) {
    setShowInformation(checked);
    setPage(1);
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ version: 1, showInformation: checked }),
      );
      setPreferenceError(false);
    } catch {
      setPreferenceError(true);
    }
  }
  const modules = [
    ...new Map((data?.items ?? []).map((i) => [i.source, i.module])).entries(),
  ];
  const filtered = visibleFollowUps(
      data?.items ?? [],
      showInformation,
      module,
      status,
      query,
      urgencyFilter,
    ),
    pages = Math.max(1, Math.ceil(filtered.length / 10)),
    current = Math.min(page, pages),
    rows = filtered.slice((current - 1) * 10, current * 10);
  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={setActiveTab}
      className="min-w-0 space-y-5"
    >
      <Tabs.List
        aria-label="Notifikasi dan tindak lanjut"
        className="schedule-tabs grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-1"
      >
        <Tabs.Trigger value="inbox">Kotak masuk</Tabs.Trigger>
        <Tabs.Trigger value="follow-up">Tindak lanjut</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="inbox" forceMount hidden={activeTab !== "inbox"}>
        {inbox}
      </Tabs.Content>
      <Tabs.Content
        value="follow-up"
        forceMount
        hidden={activeTab !== "follow-up"}
        className="min-w-0 space-y-5"
      >
        <section className="rounded-xl border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold">Pusat tindak lanjut</h2>
              <Guidance summary="Panduan tindak lanjut">
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Prioritas harian dan rencana aksi sesuai akses Anda. Lakukan
                  tindakan melalui modul pada sidebar; status diperbarui dari
                  sumber saat daftar dimuat.
                </p>
              </Guidance>
            </div>
            <Button
              type="button"
              onClick={() => void refresh()}
              disabled={pending}
            >
              {pending
                ? "Memuat…"
                : data
                  ? "Perbarui tindak lanjut"
                  : "Muat tindak lanjut"}
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Tandai dibaca hanya mengubah kotak masuk, bukan status pekerjaan.
            Target hanya ditampilkan jika ditetapkan pada rencana aksi;
            prioritas harian bukan tenggat baru.
          </p>
        </section>
        {error ? <Status tone="error">{error}</Status> : null}
        {pending ? <p role="status">Memeriksa sumber tindak lanjut…</p> : null}
        <fieldset className="rounded-xl border p-4">
          <legend className="px-1 text-sm font-semibold">
            Preferensi tampilan di perangkat ini
          </legend>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5 shrink-0"
              checked={showInformation}
              onChange={(e) => preference(e.target.checked)}
            />
            Tampilkan informasi opsional dan riwayat selesai
          </label>
          <p className="text-sm text-muted-foreground">
            Prioritas tindakan dan sumber yang gagal diperiksa tetap tersedia.
            Pengaturan ini tidak menghentikan email, WhatsApp, OTP, survei
            wajib, atau pengamanan akun.
          </p>
          {preferenceError ? (
            <p role="status" className="mt-2 text-sm">
              Preferensi berlaku sementara; penyimpanan perangkat tidak
              tersedia.
            </p>
          ) : null}
        </fieldset>
        {data ? (
          <>
            <p className="text-sm text-muted-foreground">
              Dibaca {stamp.format(new Date(data.loadedAt))} WIB · Tanggal kerja{" "}
              {date(data.today)}. Muat ulang setelah menyelesaikan pekerjaan
              atau bila akses berubah.
            </p>
            {!data.contextReady ? (
              <Status tone="error">
                Cakupan akses belum dapat diperiksa. Daftar tidak dianggap
                kosong atau selesai.
              </Status>
            ) : null}
            {data.plans === "unavailable" ? (
              <Status tone="error">
                Rencana aksi belum dapat dimuat; status penyelesaiannya belum
                dapat dipastikan.
              </Status>
            ) : null}
            {data.truncated ? (
              <Status>
                Daftar menampilkan hingga 200 butir rencana aksi. Periksa modul
                Hasil survei untuk keseluruhan rencana.
              </Status>
            ) : null}
            <FilterBar label="Filter tindak lanjut">
              <label className="min-w-0">
                <span className="mb-2 block text-sm font-medium">Urgensi</span>
                <select
                  className={controlClass}
                  value={urgencyFilter}
                  onChange={(e) => {
                    setUrgencyFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Semua urgensi</option>
                  {Object.entries(urgency).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="mb-2 block text-sm font-medium">
                  Modul sumber
                </span>
                <select
                  className={controlClass}
                  value={module}
                  onChange={(e) => {
                    setModule(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Semua modul</option>
                  {modules.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="mb-2 block text-sm font-medium">
                  Status pekerjaan
                </span>
                <select
                  className={controlClass}
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Semua status</option>
                  {Object.entries(statuses).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="min-w-0"><FloatingLabel label={<><span className="mb-2 block text-sm font-medium">
                  Cari tindak lanjut
                </span></>}><input
                  type="search"
                  className={controlClass}
                  maxLength={200}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Judul atau penanggung jawab"
                /></FloatingLabel>
              </div>
            </FilterBar>
            <section
              aria-busy={pending}
              aria-labelledby="follow-up-results"
              className="space-y-4"
            >
              <h2
                id="follow-up-results"
                ref={results}
                tabIndex={-1}
                className="rounded text-lg font-semibold"
              >
                Daftar tindak lanjut · {filtered.length}
              </h2>
              {rows.length ? (
                <ul className="grid min-w-0 gap-4 md:grid-cols-2">
                  {rows.map((i) => (
                    <li
                      key={i.id}
                      className="min-w-0 rounded-xl border bg-card p-4 [overflow-wrap:anywhere]"
                    >
                      <p className="text-xs font-medium text-primary">
                        {i.module} · {urgency[i.urgency]}
                      </p>
                      <h3 className="mt-2 font-semibold">{i.title}</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {i.detail}
                      </p>
                      <dl className="mt-4 space-y-2 text-sm">
                        <div>
                          <dt className="font-medium">Status</dt>
                          <dd>{statuses[i.status]}</dd>
                        </div>
                        <div>
                          <dt className="font-medium">Penanggung jawab</dt>
                          <dd>{i.owner}</dd>
                        </div>
                        <div>
                          <dt className="font-medium">Target sumber</dt>
                          <dd>
                            {i.target ? (
                              <time dateTime={i.target}>{date(i.target)}</time>
                            ) : (
                              "Tidak ditetapkan pada ringkasan sumber"
                            )}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              ) : (
                <Status>
                  Tidak ada butir yang sesuai tampilan saat ini. Periksa filter
                  dan preferensi; ini bukan bukti seluruh pekerjaan madrasah
                  selesai.
                </Status>
              )}
              {pages > 1 ? (
                <Pagination
                  label="Halaman tindak lanjut"
                  page={current}
                  pageCount={pages}
                  onPageChange={(p) => {
                    setPage(p);
                    results.current?.focus();
                  }}
                />
              ) : null}
            </section>
          </>
        ) : !pending ? (
          <Status>
            Tekan Muat tindak lanjut untuk memeriksa status terbaru. Kotak masuk
            tetap tersedia pada tab sebelah.
          </Status>
        ) : null}
      </Tabs.Content>
    </Tabs.Root>
  );
}
