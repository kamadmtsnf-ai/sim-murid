import { bulkImportAvailable } from "@/lib/bulk/availability";
import { notFound, redirect } from "next/navigation";
import { readServerPrincipal } from "@/lib/auth/read-server";
import { reportFilters } from "@/lib/learning/reports";
import { learningData } from "@/lib/learning/server";
import { learningModules, titles } from "@/lib/learning/validation";
import { LearningPanel } from "./panel";
export const dynamic = "force-dynamic";
export default async function LearningPage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams?: Promise<Record<string,string|string[]|undefined>>;
}) {
  const domain = learningModules.safeParse((await params).module);
  if (!domain.success) notFound();
  const caller = await readServerPrincipal();
  if (!caller) redirect("/login?expired=1");
  const query=await searchParams??{};
  const scope=domain.data==="reports"?reportFilters.safeParse(Object.fromEntries(["classId","studentId","semester"].filter(k=>query[k]!==undefined).map(k=>[k,query[k]]))):null;
  if(scope&&!scope.success)notFound();
  let data;
  try {
    data = await learningData(
      caller.principal.id,
      caller.sessionId,
      domain.data,
      scope?.success?scope.data:undefined,
    );
  } catch {
    throw Error(
      domain.data === "books" ? "Books unavailable" : domain.data === "reports" ? "Reports unavailable" : "Grades unavailable",
    );
  }
  return (
    <main tabIndex={-1}
      id="main-content"
      className="mx-auto min-w-0 max-w-7xl space-y-6 p-4 sm:p-6"
    >
      <h1 className="text-3xl font-semibold">{titles[domain.data]}</h1>
      <LearningPanel
        bulkAvailable={
          domain.data === "grades" &&
          data.canWrite &&
          (await bulkImportAvailable(caller.principal.id, caller.sessionId))
        }
        initial={data}
      />
    </main>
  );
}
