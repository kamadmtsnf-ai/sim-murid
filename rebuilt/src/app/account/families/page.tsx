import { AccessDenied } from "@/lib/auth/authorization";
import { redirect } from "next/navigation";
import { readServerPrincipal } from "@/lib/auth/read-server";
import { familiesData } from "@/lib/education/server";
import { FamilyPanel } from "./family-panel";
export const dynamic = "force-dynamic";
export default async function FamiliesPage() {
  const caller = await readServerPrincipal();
  if (!caller) redirect("/login?expired=1");
  let data;
  try {
    data = await familiesData(caller.principal.id, caller.sessionId);
  } catch (error) {
    if (!(error instanceof AccessDenied)) throw Error("Families unavailable");
    return (
      <main id="main-content" className="mx-auto max-w-xl space-y-4 px-6 py-12">
        <h1>Relasi keluarga belum tersedia</h1>
        <p>
          Hanya Admin yang telah menyelesaikan keamanan akun dapat memverifikasi
          relasi.
        </p>
      </main>
    );
  }
  return (
    <main
      id="main-content"
      className="mx-auto min-w-0 max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-10"
    >
      <h1 className="text-3xl font-semibold">Relasi keluarga</h1>
      <FamilyPanel initial={data} />
    </main>
  );
}
