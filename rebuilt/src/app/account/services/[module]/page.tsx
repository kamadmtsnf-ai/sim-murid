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
  } catch {
    if (
      m.data === "notifications" ||
      m.data === "discipline" ||
      m.data === "surveys"
    )
      throw new Error(
        m.data === "notifications"
          ? "Notifications unavailable"
          : m.data === "surveys"
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
    <main id="main-content" className="mx-auto min-w-0 max-w-7xl space-y-6 p-6">
      <h1 className="text-3xl font-semibold">{titles[m.data]}</h1>
      <ServicesPanel initial={data} userId={caller.principal.id} />
    </main>
  );
}
