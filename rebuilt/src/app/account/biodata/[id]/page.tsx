import { redirect, notFound } from "next/navigation";
import { z } from "zod";
import { readServerPrincipal } from "@/lib/auth/read-server";
import { AccessDenied } from "@/lib/auth/authorization";
import { loadStudent } from "@/lib/student/server";
import { documentList } from "@/lib/documents/server";
import { BiodataPanel } from "../biodata-panel";
export const dynamic = "force-dynamic";
export default async function BiodataPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const caller = await readServerPrincipal();
  if (!caller) redirect("/login?expired=1");
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const target = parsed.data;
  let student, documents;
  try {
    [student, documents] = await Promise.all([
      loadStudent(caller.principal.id, caller.sessionId, target),
      documentList(caller.principal.id, caller.sessionId, target),
    ]);
  } catch (error) {
    if (!(error instanceof AccessDenied)) throw error;
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-xl space-y-3 px-4 py-10"
      >
        <h1 className="text-2xl font-semibold">
          Biodata tidak tersedia untuk akun Anda
        </h1>
        <p className="text-sm text-muted-foreground">
          Halaman ini untuk Siswa, Calon Siswa, Alumni, atau akun yang memiliki
          izin terhadap siswa terkait. Pastikan langkah keamanan akun telah
          diselesaikan.
        </p>
      </main>
    );
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full min-w-0 max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-10"
    >
      <BiodataPanel
        key={student.id}
        initial={student}
        initialDocuments={documents}
      />
    </main>
  );
}
