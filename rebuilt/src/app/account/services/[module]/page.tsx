import { AccessDenied } from "@/lib/auth/authorization";
import { notFound, redirect } from "next/navigation";
import { readServerPrincipal } from "@/lib/auth/read-server";
import { servicesData } from "@/lib/services/server";
import { modules, titles } from "@/lib/services/validation";
import { ServicesPanel } from "./panel";
export const dynamic = "force-dynamic";
export default async function ServicesPage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const m = modules.safeParse((await params).module);
  if (!m.success) notFound();
  const caller = await readServerPrincipal();
  if (!caller) redirect("/login?expired=1");
  let data;
  try {
    data = await servicesData(caller.principal.id, caller.sessionId, m.data);
  } catch (error) {
    if (m.data === "jobs" && error instanceof AccessDenied)
      return (
        <main
          id="main-content"
          className="mx-auto max-w-xl space-y-4 px-4 py-8"
        >
          <h1 className="text-2xl font-semibold">Antrean dan pekerjaan</h1>
          <p>
            Hanya Admin yang telah menyelesaikan keamanan akun dapat mengelola
            pekerjaan.
          </p>
        </main>
      );
    if (
      m.data === "notifications" ||
      m.data === "discipline" ||
      m.data === "surveys" ||
      m.data === "insights" ||
      m.data === "jobs"
    )
      throw new Error(
        m.data === "jobs"
          ? "Jobs unavailable"
          : m.data === "notifications"
            ? "Notifications unavailable"
            : m.data === "surveys" || m.data === "insights"
              ? "Surveys unavailable"
              : "Discipline unavailable",
      );
    return (
      <main id="main-content" className="p-8">
        <h1>{titles[m.data]}</h1>
        <p>Layanan belum tersedia atau izin tidak mencukupi.</p>
      </main>
    );
  }
  return (
    <main
      id="main-content"
      className={
        m.data === "jobs"
          ? "mx-auto min-w-0 max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-10"
          : "mx-auto min-w-0 max-w-7xl space-y-6 p-6"
      }
    >
      <h1 className="text-3xl font-semibold">{titles[m.data]}</h1>
      <ServicesPanel initial={data} userId={caller.principal.id} />
    </main>
  );
}
