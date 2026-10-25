import { redirect } from "next/navigation";
import { z } from "zod";
import { readServerPrincipal } from "@/lib/auth/read-server";
import type { Metadata } from "next";
import { loadDirectoryDetail } from "@/lib/education/directory-server";
import {
  DirectoryDetailView,
  DirectoryDetailUnavailable as Unavailable,
} from "../directory-detail";
import {ManageAssignments} from "../manage-assignments";
export const metadata: Metadata = { title: "Detail pengguna" };
export const dynamic = "force-dynamic";
export default async function DirectoryDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const caller = await readServerPrincipal();
  if (!caller) redirect("/login?expired=1");
  const target = z.uuid().safeParse((await params).id);
  if (!target.success) return <Unavailable />;
  const detail = await loadDirectoryDetail(
    caller.principal.id,
    caller.sessionId,
    target.data,
  );
  const person = detail?.person ?? null;
  if (person === null) return <Unavailable />;
  return (
    <main id="main-content" tabIndex={-1}>
      {caller.principal.is_admin && person.role === "teacher" ? <div className="mb-4"><ManageAssignments target={target.data}/></div> : null}
      <DirectoryDetailView person={person} />
    </main>
  );
}
