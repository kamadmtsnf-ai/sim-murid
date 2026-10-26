import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readServerPrincipal } from "@/lib/auth/read-server";
import { readAdminHealth } from "@/lib/health/server";
import { AccessDenied } from "@/lib/auth/authorization";
import { AdminHealth } from "@/components/admin-health";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kesehatan aplikasi" };
export default async function HealthPage() {
  const caller=await readServerPrincipal();
  if (!caller) redirect("/login?expired=1");
  let data;
  try { data=await readAdminHealth(caller); }
  catch(error) {
    if(error instanceof AccessDenied) return <main id="main-content" className="mx-auto max-w-xl space-y-4 p-6"><h1 className="text-2xl font-semibold">Kesehatan aplikasi</h1><p>Hanya Admin yang telah menyelesaikan keamanan akun dapat melihat ringkasan ini.</p></main>;
    throw new Error("Health authorization unavailable");
  }
  return <main id="main-content" className="mx-auto min-w-0 max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-10"><div className="space-y-2"><h1 className="text-3xl font-semibold">Kesehatan aplikasi</h1><p className="text-muted-foreground">Ringkasan sumber operasional untuk membantu admin menentukan pemeriksaan berikutnya.</p></div><AdminHealth data={data}/></main>;
}
