"use client";
import { Guidance } from "@/components/ui/guidance";
import { useEffect, useRef, useState } from "react";
import { useSortPreference } from "@/lib/collections/use-sort-preference";
import { CollectionSummary } from "@/components/ui/collection-summary";
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
import { Field, fieldControlClass } from "@/components/ui/field";
import { FilterBar, Pagination } from "@/components/ui/collection-controls";
import { EmptyState } from "@/components/ui/content-state";
import { Status } from "@/components/ui/status";
export function AccessPanel({ initialData }: { initialData: AccessPageData }) {
  const router = useRouter();
  const [sort,setSort] = useSortPreference(initialData.user_id);
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
    filtered = data ? filterPermissions(data, { query, resource, scope }).toSorted((a,b)=>(sort==='label-desc'?-1:1)*a.label.localeCompare(b.label,'id-ID')) : [],
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
        <Guidance summary="Cara kerja hak akses">
          <p className="text-sm leading-6 text-muted-foreground">
            Periksa peran, penugasan aktif, dan cakupan izin akun Anda. Setiap
            layanan tetap memeriksa sesi, kepemilikan, serta hubungan data di
            server.
          </p>
        </Guidance>
      </header>
      <div className="ds-actions items-center justify-between">
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
      {message && (
        <Status
          ref={notice}
          tabIndex={-1}
          tone={failed ? "error" : busy ? "pending" : "success"}
        >
          {message}
        </Status>
      )}
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
            <Status tone="warning">
              Nama beberapa kelas belum dapat dimuat. Cakupan izin tetap
              ditampilkan berdasarkan rujukan kelas yang diterima.
            </Status>
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
              <Guidance summary="Arti cakupan izin">
                <p className="text-sm leading-6 text-muted-foreground">
                  Seluruh data berarti cakupan layanan yang disebutkan. Data
                  sendiri mengikuti kepemilikan atau relasi yang diperiksa
                  layanan. Izin kelas hanya berlaku pada kelas yang tercantum.
                </p>
              </Guidance>
            </CardHeader>
            <CardContent className="min-w-0 space-y-5 px-4 sm:px-6">
              <FilterBar label="Filter cakupan izin">
                <Field
                  id="access-search"
                  label="Cari izin"
                  className="sm:col-span-2"
                >
                  <input
                    id="access-search"
                    className={fieldControlClass}
                    type="search"
                    maxLength={200}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(0);
                    }}
                    placeholder="Nama layanan, tindakan, atau kelas"
                  />
                </Field>
                <Field id="access-resource" label="Layanan">
                  <select
                    id="access-resource"
                    className={fieldControlClass}
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
                </Field>
                <Field id="access-scope" label="Cakupan">
                  <select
                    id="access-scope"
                    className={fieldControlClass}
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
                </Field>
              </FilterBar>
              <div className="ds-actions items-center justify-between">
                <CollectionSummary total={filtered.length} page={current+1} pageSize={10} unit="jenis izin" filters={[{label:'Pencarian',value:query},{label:'Area',value:resource?(accessResources[resource]??resource):''},{label:'Cakupan',value:scope?(scopeLabels[scope as keyof typeof scopeLabels]??scope):''}]}/>
                <Field id="access-sort" label="Urutan"><select id="access-sort" className={fieldControlClass} value={sort} onChange={e=>{setSort(e.target.value==='label-desc'?'label-desc':'label-asc');setPage(0);}}><option value="label-asc">Nama izin A–Z</option><option value="label-desc">Nama izin Z–A</option></select></Field>
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
                <EmptyState
                  title={
                    rows.length
                      ? "Tidak ada izin yang cocok"
                      : "Belum ada izin untuk ditampilkan"
                  }
                >
                  <p>
                    {rows.length
                      ? "Ubah pencarian atau reset filter untuk melihat izin lainnya."
                      : "Hubungi administrator jika peran akun atau cakupan izin perlu diperiksa."}
                  </p>
                </EmptyState>
              )}
              {pages > 1 && (
                <Pagination
                  label="Halaman daftar izin"
                  page={current + 1}
                  pageCount={pages}
                  onPageChange={(next) => turn(next - 1)}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
