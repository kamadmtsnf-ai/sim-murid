import type {ReactNode} from "react";
import {readServerAuthClient} from "@/lib/auth/read-server";
import {verifiedPrincipal} from "@/lib/auth/http";
import {loadAccessContext} from "@/lib/auth/authorization";
import {navigationFor} from "@/config/account-navigation";
import {WorkspaceShell} from "@/components/workspace-shell";
export default async function AccountLayout({children}:{children:ReactNode}){
 let caller,capabilities:string[]=[],navigationUnavailable=false;
 try {const client=await readServerAuthClient();caller=await verifiedPrincipal(client);if(caller){try{const access=await loadAccessContext(client);capabilities=access?.grants.map(g=>g.capability)??[];navigationUnavailable=access===null;}catch{navigationUnavailable=true;}}}catch{return children;}
 if(!caller)return children;
 return <WorkspaceShell name={caller.principal.full_name} username={caller.principal.username} navigation={navigationFor(capabilities,caller.principal.is_admin)} navigationUnavailable={navigationUnavailable}>{children}</WorkspaceShell>;
}
