import { createRoot } from "react-dom/client";
import { AdminHealth } from "@/components/admin-health";
import { healthSnapshot } from "@/lib/health/model";
const mode=new URL(location.href).searchParams.get("mode");
const checkedAt="2026-10-26T08:00:00.000Z";
const unavailable=mode==="unknown" || mode==="partial";
const data=healthSnapshot.parse({checkedAt,jobs:{checkedAt,available:!unavailable,outbox:unavailable?null:{sampled:200,queued:100,processing:30,sent:60,failed:5,ambiguous:3,cancelled:2},runs:unavailable?null:{sampled:100,queued:20,running:10,succeeded:60,failed:5,skipped:5},providers:unavailable?null:{gmail:true,whatsapp:false,scheduledDispatch:false},oldestQueuedAt:null,latestProviderAcceptedAt:null,latestJobFinishedAt:null},reconciliation:{checkedAt,available:mode!=="unknown",sourceAvailable:mode==="unknown"?null:false,tables:mode==="unknown"?null:100,reportSnapshots:mode==="unknown"?null:10000,pointSnapshots:mode==="unknown"?null:20000,submittedSurveys:mode==="unknown"?null:50000}});
createRoot(document.getElementById("root")!).render(<main id="main-content"><h1>Kesehatan aplikasi</h1><AdminHealth data={data}/></main>);
