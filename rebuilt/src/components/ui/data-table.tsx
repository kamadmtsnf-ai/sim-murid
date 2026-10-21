import type {ReactNode} from "react";
import {cn} from "@/lib/utils";
export function TableRegion({label,children,className}:{label:string;children:ReactNode;className?:string}){return <div className="min-w-0 space-y-2"><p className="text-xs text-muted-foreground sm:hidden">Geser tabel ke samping untuk melihat kolom lainnya.</p><div className={cn("table-region",className)} role="region" aria-label={label} tabIndex={0}>{children}</div></div>;}
