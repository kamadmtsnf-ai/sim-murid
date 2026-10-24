"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { directoryRoleLabel, assignmentLabel } from "@/lib/education/directory";
import {
  accessPageSchema,
  type AccessPageData,
} from "@/lib/auth/access-validation";
import {
  accessResources,
  classLabel,
  filterPermissions,
  permissionRows,
  scopeLabels,
  uniqueAssignments,
} from "@/lib/auth/access-view";
const control =
  "min-h-11 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";
export function AccessPanel({ initialData }: { initialData: AccessPageData }) {
  const router = useRouter();
  const [data, setData] = useState<AccessPageData | null>(initialData),
    [query, setQuery] = useState(""),
    [resource, setResource] = useState(""),
    [scope, setScope] = useState(""),
    [page, setPage] = useState(0),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false);
  const lock = useRef(false),
    mounted = useRef(true),
    notice = useRef<HTMLDivElement>(null),
    focusNotice = useRef(false),
    listHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!busy && message && focusNotice.current) {
      notice.current?.focus();
      focusNotice.current = false;
    }
  }, [busy, message]);
  async function refresh() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    setMessage("Memeriksa hak akses terbaru…");
    try {
      const r = await fetch("/api/auth/access", {
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
      if (!mounted.current) return;
      if (r.status === 401) {
        setData(null);
        router.replace("/login?expired=1");
        router.refresh();
        return;
      }
      const body: unknown = await r.json();
      if (!mounted.current) return;
      if (
        r.status === 403 &&
        typeof body === "object" &&
        body !== null &&
        "destination" in body &&
        body.destination === "/account/security"
      ) {
        setData(null);
        router.replace("/account/security");
        router.refresh();
        return;
      }
      if (!r.ok) throw Error("Unavailable");
      const next = accessPageSchema.parse(body);
      if (next.user_id !== initialData.user_id) throw Error("Identity changed");
      setData(next);
      setFailed(false);
      setMessage("Hak akses berhasil diperbarui.");
      setResource((current) =>
        !current || permissionRows(next).some((r) => r.resource === current)
          ? current
          : "",
      );
      setPage(0);
      router.refresh();
    } catch {
      if (mounted.current) {
        setFailed(true);
        setMessage(
          "Hak akses terbaru belum dapat dimuat. Data terakhir tetap ditampilkan sebagai rujukan; layanan tetap memeriksa izin di server. Coba muat ulang.",
        );
        focusNotice.current = true;
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const rows = data ? permissionRows(data) : [],
    filtered = data ? filterPermissions(data, { query, resource, scope }) : [],
    assignments = data ? uniqueAssignments(data) : [];
  const pages = Math.max(1, Math.ceil(filtered.length / 10)),
    current = Math.min(page, pages - 1),
    visible = filtered.slice(current * 10, current * 10 + 10);
  const resources = [...new Set(rows.map((r) => r.resource))].toSorted((a, b) =>
    (accessResources[a] ?? a).localeCompare(accessResources[b] ?? b, "id"),
  );
  function clear() {
    setQuery("");
    setResource("");
    setScope("");
    setPage(0);
  }
  function turn(next: number) {
    setPage(next);
    listHeading.current?.focus();
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full min-w-0 max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 [overflow-wrap:anywhere]"
    >
      <header className="space-y-2">
        <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          <ShieldCheck
            aria-hidden="true"
            className="size-6 shrink-0 text-primary"
          />
          Hak akses saya
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Periksa peran, penugasan aktif, dan cakupan izin akun Anda. Setiap
          layanan tetap memeriksa sesi, kepemilikan, serta hubungan data di
          server.
        </p>
      </header>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Muat ulang untuk memeriksa perubahan peran atau penugasan.
        </p>
        <Button
          className="shrink-0"
          variant="outline"
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
        >
          {busy ? "Memeriksa akses…" : "Muat ulang hak akses"}
        </Button>
      </div>
      <div
        ref={notice}
        tabIndex={-1}
        role={failed ? "alert" : "status"}
        aria-live={failed ? "assertive" : "polite"}
        className={
          message
            ? "rounded-lg border p-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring " +
              (failed ? "border-destructive text-destructive" : "bg-muted/20")
            : ""
        }
      >
        {message}
      </div>
      {!data ? (
        <p role="status" className="text-sm text-muted-foreground">
          Mengarahkan ke pemeriksaan akun…
        </p>
      ) : (
        <div aria-busy={busy} className="min-w-0 space-y-6">
          <Card className="min-w-0">
            <CardHeader className="grid-cols-1 px-4 sm:px-6">
              <CardTitle>
                <h2>Peran akun</h2>
              </CardTitle>
              <p className="text-lg font-semibold text-primary">
                {directoryRoleLabel(data.role)}
              </p>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <dl className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-muted-foreground">Jenis izin</dt>
                  <dd className="mt-1 text-2xl font-semibold">{rows.length}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">
                    Penugasan aktif
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold">
                    {assignments.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">
                    Cakupan kelas tertentu
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold">
                    {
                      new Set(
                        data.grants
                          .filter((g) => g.scope === "class")
                          .map((g) => g.class_id),
                      ).size
                    }
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          {!data.details_available && (
            <p
              role="status"
              className="rounded-lg border bg-muted/20 p-4 text-sm"
            >
              Nama beberapa kelas belum dapat dimuat. Cakupan izin tetap
              ditampilkan berdasarkan rujukan kelas yang diterima.
            </p>
          )}
          <details className="min-w-0 rounded-xl border bg-card p-4 sm:p-5">
            <summary className="min-h-11 cursor-pointer rounded-md py-3 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Penugasan yang masih berlaku ({assignments.length})
            </summary>
            <div className="mt-3 min-w-0 space-y-3">
              {assignments.length ? (
                <ul
                  className="max-h-72 space-y-3 overflow-y-auto p-1"
                  tabIndex={0}
                  aria-label="Penugasan aktif"
                >
                  {assignments.map((a) => (
                    <li
                      key={JSON.stringify([a.code, a.class_id])}
                      className="rounded-lg border p-3 text-sm"
                    >
                      <p className="font-medium">{assignmentLabel(a.code)}</p>
                      <p className="mt-1 text-muted-foreground">
                        {a.class_id
                          ? classLabel(data, a.class_id)
                          : "Penugasan tingkat madrasah"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Belum ada penugasan aktif. Izin dasar tetap mengikuti peran
                  akun Anda.
                </p>
              )}
              <p className="text-xs leading-5 text-muted-foreground">
                Penugasan yang kedaluwarsa atau dicabut tidak termasuk dalam
                daftar ini. Nama kelas ditampilkan sesuai cakupan baca akun
                Anda.
              </p>
            </div>
          </details>
          <Card className="min-w-0">
            <CardHeader className="grid-cols-1 px-4 sm:px-6">
              <CardTitle>
                <h2
                  ref={listHeading}
                  tabIndex={-1}
                  className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Cakupan izin
                </h2>
              </CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                Seluruh data berarti cakupan layanan yang disebutkan. Data
                sendiri mengikuti kepemilikan atau relasi yang diperiksa
                layanan. Izin kelas hanya berlaku pada kelas yang tercantum.
              </p>
            </CardHeader>
            <CardContent className="min-w-0 space-y-5 px-4 sm:px-6">
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2 text-sm font-medium sm:col-span-2">
                  <label className="block" htmlFor="access-search">
                    Cari izin
                  </label>
                  <input
                    id="access-search"
                    className={control}
                    type="search"
                    maxLength={200}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(0);
                    }}
                    placeholder="Nama layanan, tindakan, atau kelas"
                  />
                </div>
                <div className="min-w-0 space-y-2 text-sm font-medium">
                  <label className="block" htmlFor="access-resource">
                    Layanan
                  </label>
                  <select
                    id="access-resource"
                    className={control}
                    value={resource}
                    onChange={(e) => {
                      setResource(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="">Semua layanan</option>
                    {resources.map((r) => (
                      <option key={r} value={r}>
                        {accessResources[r] ?? r}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0 space-y-2 text-sm font-medium">
                  <label className="block" htmlFor="access-scope">
                    Cakupan
                  </label>
                  <select
                    id="access-scope"
                    className={control}
                    value={scope}
                    onChange={(e) => {
                      setScope(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="">Semua cakupan</option>
                    {Object.entries(scopeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p role="status" className="text-sm text-muted-foreground">
                  {filtered.length
                    ? `Menampilkan ${current * 10 + 1}–${Math.min(current * 10 + 10, filtered.length)} dari ${filtered.length} jenis izin`
                    : "0 jenis izin ditampilkan"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!query && !resource && !scope}
                  onClick={clear}
                >
                  Reset filter
                </Button>
              </div>
              {visible.length ? (
                <ul aria-label="Daftar izin" className="min-w-0 divide-y">
                  {visible.map((row) => (
                    <li
                      key={row.capability}
                      className="min-w-0 space-y-3 py-4 first:pt-0"
                    >
                      <h3 className="text-sm font-semibold leading-6">
                        {row.label}
                      </h3>
                      <ul
                        aria-label={`Cakupan ${row.label}`}
                        className="flex min-w-0 flex-wrap gap-2"
                      >
                        {row.scopes.map((g) => (
                          <li
                            key={JSON.stringify([g.scope, g.class_id])}
                            className="min-w-0 max-w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                          >
                            {g.scope === "class" && g.class_id
                              ? classLabel(data, g.class_id)
                              : scopeLabels[g.scope]}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-lg border border-dashed p-5 text-center">
                  <h3 className="font-semibold">
                    {rows.length
                      ? "Tidak ada izin yang cocok"
                      : "Belum ada izin untuk ditampilkan"}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {rows.length
                      ? "Ubah pencarian atau reset filter untuk melihat izin lainnya."
                      : "Hubungi administrator jika peran akun atau cakupan izin perlu diperiksa."}
                  </p>
                </div>
              )}
              {pages > 1 && (
                <nav
                  aria-label="Halaman daftar izin"
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <Button
                    type="button"
                    variant="outline"
                    disabled={current === 0}
                    onClick={() => turn(current - 1)}
                  >
                    Sebelumnya
                  </Button>
                  <p className="text-sm">
                    Halaman {current + 1} dari {pages}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={current >= pages - 1}
                    onClick={() => turn(current + 1)}
                  >
                    Berikutnya
                  </Button>
                </nav>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
