import Link from "next/link";
import { DutyPanel } from "./duty-panel";
import { dutyFilters, dutySnapshot } from "@/lib/operations/duty";
import { AccessDenied } from "@/lib/auth/authorization";
import { redirect, notFound } from "next/navigation";
import { readServerPrincipal } from "@/lib/auth/read-server";
import { operationsData } from "@/lib/operations/server";
import { moduleTitles, operationModules } from "@/lib/operations/validation";
import { OperationsPanel } from "./panel";
export const dynamic = "force-dynamic";
export default async function OperationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const m = operationModules.safeParse((await params).module);
  if (!m.success) notFound();
  const caller = await readServerPrincipal();
  if (!caller) redirect("/login?expired=1");
  let data;
  const q = (await searchParams) ?? {};
  const { view, ...raw } = q;
  const checked =
    m.data === "duty"
      ? dutyFilters.safeParse(raw)
      : { success: true as const, data: {} };
  if (!checked.success)
    return (
      <main id="main-content" tabIndex={-1} className="space-y-4">
        <h1>Filter Guru Piket tidak valid</h1>
        <p>Periksa tahun, urutan tanggal, dan rentang maksimal 366 hari.</p>
        <Link className="underline" href="?" prefetch={false}>
          Reset filter
        </Link>
      </main>
    );
  const filters = checked.data;
  try {
    data = await operationsData(
      caller.principal.id,
      caller.sessionId,
      m.data,
      filters,
    );
  } catch (error) {
    if ((m.data === "duty" || m.data === "attendance" || m.data === "mentoring") && !(error instanceof AccessDenied))
      throw new Error(m.data === "duty" ? "Duty unavailable" : "Operations unavailable");
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-xl space-y-4 p-8"
      >
        <h1>{moduleTitles[m.data]}</h1>
        <p>Layanan belum tersedia atau langkah keamanan akun belum lengkap.</p>
      </main>
    );
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-7xl space-y-6 p-6"
    >
      <h1 className="text-3xl font-semibold">{moduleTitles[m.data]}</h1>
      {m.data === "duty" ? (
        <DutyPanel
          key={JSON.stringify(filters) + data.revision + String(view)}
          initialTab={view === "history" ? "history" : "roster"}
          initial={dutySnapshot.parse(data)}
          filters={filters}
        />
      ) : (
        <OperationsPanel initial={data} />
      )}
    </main>
  );
}
