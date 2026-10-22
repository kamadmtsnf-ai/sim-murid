import { redirect } from "next/navigation";
import { readServerPrincipal } from "@/lib/auth/read-server";
import { AccessDenied } from "@/lib/auth/authorization";
import { classesData } from "@/lib/education/server";
import { Status } from "@/components/ui/status";
import { ClassPanel } from "./class-panel";
export const dynamic = "force-dynamic";
export const metadata = { title: "Kelas dan siswa" };
export default async function ClassesPage() {
  const caller = await readServerPrincipal();
  if (!caller) redirect("/login?expired=1");
  let data;
  try {
    data = await classesData(caller.principal.id, caller.sessionId);
  } catch (error) {
    if (!(error instanceof AccessDenied)) throw Error("Classes unavailable");
    return (
      <main id="main-content" tabIndex={-1} className="space-y-5">
        <h1 className="text-3xl font-semibold">Kelas dan siswa</h1>
        <Status>
          Akses kelas belum tersedia untuk akun ini. Periksa kelengkapan
          keamanan akun atau hubungi administrator.
        </Status>
      </main>
    );
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full min-w-0 max-w-6xl space-y-6"
    >
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Kelas dan siswa</h1>
        <p className="text-muted-foreground">
          Kelola tahun ajaran, kelas, dan penempatan siswa sesuai hak akses
          Anda.
        </p>
      </header>
      <ClassPanel initial={data} />
    </main>
  );
}
