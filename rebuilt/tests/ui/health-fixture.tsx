/** Actual view/loading/error boundary with synthetic aggregate data only. */
import { createRoot } from "react-dom/client";
import { AdminHealth } from "@/components/admin-health";
import Loading from "@/app/account/health/loading";
import ErrorPage from "@/app/account/health/error";
import { healthSnapshot } from "@/lib/health/model";
const mode = new URL(location.href).searchParams.get("mode") ?? "normal";
const checkedAt = mode === "offset" ? "2026-10-27T16:00:00+07:00" : (window as Window & { healthCheckedAt?: string }).healthCheckedAt ?? "2026-10-27T08:00:00.000Z";
const missingJobs = mode === "unknown" || mode === "partial", missingReconciliation = mode === "unknown" || mode === "reconciliation-error";
const empty = mode === "empty";
const data = healthSnapshot.parse({
 checkedAt,
 jobs:{checkedAt,available:!missingJobs,outbox:missingJobs?null:empty?{sampled:0,queued:0,processing:0,sent:0,failed:0,ambiguous:0,cancelled:0}:{sampled:200,queued:100,processing:30,sent:60,failed:5,ambiguous:3,cancelled:2},runs:missingJobs?null:empty?{sampled:0,queued:0,running:0,succeeded:0,failed:0,skipped:0}:{sampled:100,queued:20,running:10,succeeded:60,failed:5,skipped:5},providers:missingJobs?null:{gmail:mode!=="providers-off",whatsapp:false,scheduledDispatch:false},oldestQueuedAt:missingJobs||empty?null:"2026-10-26T08:00:00Z",latestProviderAcceptedAt:null,latestJobFinishedAt:missingJobs||empty?null:"2026-10-27T08:00:00Z"},
 reconciliation:{checkedAt,available:!missingReconciliation,sourceAvailable:missingReconciliation?null:mode==="source-ready",tables:missingReconciliation?null:100,reportSnapshots:missingReconciliation?null:mode==="large"?Number.MAX_SAFE_INTEGER:10000,pointSnapshots:missingReconciliation?null:20000,submittedSurveys:missingReconciliation?null:50000}
});
createRoot(document.getElementById("root")!).render(mode==="loading"?<Loading/>:mode==="error"?<ErrorPage error={new Error("PRIVATE_TOKEN") as Error & {digest?:string}} reset={()=>{Object.assign(window,{healthResets:((window as Window & {healthResets?:number}).healthResets??0)+1});}}/>:<main id="main-content" tabIndex={-1} className="mx-auto min-w-0 max-w-7xl space-y-6 p-[16px]"><h1 className="text-3xl font-semibold">Kesehatan aplikasi</h1><AdminHealth data={data}/></main>);
