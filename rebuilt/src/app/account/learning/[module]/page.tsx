import { notFound, redirect } from "next/navigation";
import { readServerPrincipal } from "@/lib/auth/read-server";
import { learningData } from "@/lib/learning/server";
import { learningModules, titles } from "@/lib/learning/validation";
import { LearningPanel } from "./panel";
export const dynamic = "force-dynamic";
export default async function LearningPage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const domain = learningModules.safeParse((await params).module);
  if (!domain.success) notFound();
  const caller = await readServerPrincipal();
  if (!caller) redirect("/login?expired=1");
  let data;
  try {
    data = await learningData(
      caller.principal.id,
      caller.sessionId,
      domain.data,
    );
  } catch {
    if (["grades", "reports"].includes(domain.data))
      throw Error("Grades unavailable");
    return (
      <main className="mx-auto max-w-xl p-8" id="main-content">
        <h1>{titles[domain.data]}</h1>
        <p>Periksa keamanan akun atau muat ulang layanan.</p>
      </main>
    );
  }
  return (
    <main id="main-content" className="mx-auto min-w-0 max-w-7xl space-y-6 p-6">
      <h1 className="text-3xl font-semibold">{titles[domain.data]}</h1>
      <LearningPanel initial={data} />
    </main>
  );
}
