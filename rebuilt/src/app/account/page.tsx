import {securityState} from '@/lib/auth/security';
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnvironment } from "@/lib/supabase/environment";
import { verifiedPrincipal } from "@/lib/auth/http";
import { AccountDashboard } from "@/components/account-dashboard";

export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const jar = await cookies();
  let state; let onboarding;
  try {
    const { url, publishableKey } = getSupabasePublicEnvironment();
    const client = createServerClient(url, publishableKey, { cookies: { getAll: () => jar.getAll(), setAll: () => { /* Proxy handles refresh cookies. */ } } });
    state = await verifiedPrincipal(client);
    if(state)onboarding=await securityState(state.principal.id,state.sessionId);
  } catch {
    return <main id="main-content" className="mx-auto max-w-lg px-6 py-20"><h1 className="text-xl font-semibold">Pemeriksaan akun belum tersedia</h1><p className="mt-4">Silakan muat ulang halaman beberapa saat lagi.</p></main>;
  }
  if (!state) redirect("/login?expired=1");
  if(onboarding?.gate!=="ready")redirect("/account/security");
  const {createAuthAdmin}=await import('@/lib/auth/admin');const survey=await createAuthAdmin().rpc('app_survey_required',{p_actor:state.principal.id,p_session:state.sessionId});if(survey.data)redirect('/account/services/surveys');
  return <AccountDashboard name={state.principal.full_name} expiresAt={state.principal.expires_at}/>;
}
