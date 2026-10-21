import type {ReactNode} from "react";
import {CircleAlert,Info,CheckCircle2} from "lucide-react";
import {cn} from "@/lib/utils";
export function Status({children,tone="info"}:{children:ReactNode;tone?:"info"|"success"|"error"}){const Icon=tone==="error"?CircleAlert:tone==="success"?CheckCircle2:Info;return <div role={tone==="error"?"alert":"status"} aria-atomic="true" className={cn("flex items-start gap-3 rounded-lg border p-4 text-sm",tone==="error"?"border-destructive/30 bg-danger-subtle text-destructive":tone==="success"?"border-success/30 bg-success-subtle text-success":"border-info/30 bg-info-subtle text-info")}><Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true"/><div className="min-w-0">{children}</div></div>;}
