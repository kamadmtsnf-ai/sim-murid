import {PwaRequirement} from "@/components/pwa-install";
import type {ReactNode} from "react";
import {readServerAuthClient} from "@/lib/auth/read-server";
import {verifiedPrincipal} from "@/lib/auth/http";
import {loadAccessContext} from "@/lib/auth/authorization";
import {navigationFor} from "@/config/account-navigation";
import {WorkspaceShell} from "@/components/workspace-shell";
export default async function AccountLayout({children}:{children:ReactNode}){
 let caller,capabilities:string[]=[],navigationUnavailable=false;
 try {const client=await readServerAuthClient();caller=await verifiedPrincipal(client);if(caller){try{const access=await loadAccessContext(client);capabilities=access?.grants.map(g=>g.capability)??[];navigationUnavailable=access===null;}catch{navigationUnavailable=true;}}}catch{return <PwaRequirement required>{children}</PwaRequirement>;}
 if(!caller)return children;
 const academicToday=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 return <WorkspaceShell pwaRequired={!caller.principal.is_admin} academicToday={academicToday} name={caller.principal.full_name} username={caller.principal.username} navigation={navigationFor(capabilities,caller.principal.is_admin)} navigationUnavailable={navigationUnavailable}>{children}</WorkspaceShell>;
}
