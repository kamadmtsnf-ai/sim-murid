import "server-only";
import { cookies,headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnvironment } from "@/lib/supabase/environment";
import { verifiedPrincipal } from "@/lib/auth/http";

export async function readServerPrincipal() {
  const caller=await verifiedPrincipal(await readServerAuthClient());
  const path=(await headers()).get('x-sim-path');
  if(caller&&path&&!['/account/security','/account/email','/account/sessions','/account/services/surveys','/account/services/notifications'].includes(path)){const {createAuthAdmin}=await import('@/lib/auth/admin');const gate=await createAuthAdmin().rpc('app_survey_required',{p_actor:caller.principal.id,p_session:caller.sessionId});if(gate.error)throw new Error('Survey gate unavailable');if(gate.data){const {redirect}=await import('next/navigation');redirect('/account/services/surveys');}}
  return caller;
}
export async function readServerAuthClient() {
  const jar = await cookies();
  const { url, publishableKey } = getSupabasePublicEnvironment();
  const client = createServerClient(url, publishableKey, { cookies: {
    getAll: () => jar.getAll(), setAll: () => { /* Proxy persists refresh cookies. */ },
  } });
  return client;
}
