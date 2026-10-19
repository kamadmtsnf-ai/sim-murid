import {securityState} from '@/lib/auth/security';
import { redirect } from "next/navigation";
import { readServerPrincipal } from "@/lib/auth/read-server";
import { SessionPanel } from "./session-panel";

export const dynamic = "force-dynamic";
export default async function SessionsPage() {
  let state; let onboarding;
  try { state = await readServerPrincipal(); if(state)onboarding=await securityState(state.principal.id,state.sessionId); } catch {
    return <main id="main-content" className="mx-auto max-w-xl px-6 py-16"><h1>Pemeriksaan sesi belum tersedia</h1><p>Silakan muat ulang beberapa saat lagi.</p></main>;
  }
  if (!state) redirect("/login?expired=1");
  if(onboarding?.gate!=="ready")redirect("/account/security");
  return <SessionPanel canManageOthers={state.principal.is_admin} />;
}
