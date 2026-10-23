import { redirect } from "next/navigation";
import { readServerPrincipal } from "@/lib/auth/read-server";
import { securityState } from "@/lib/auth/security";
import { createAuthAdmin } from "@/lib/auth/admin";
import { recoveryListSchema } from "@/lib/auth/recovery-validation";
import { RecoveryPanel } from "./recovery-panel";
export const dynamic = "force-dynamic";
export default async function RecoveryAdminPage() {
  const caller = await readServerPrincipal();
  if (!caller) redirect("/login?expired=1");
  const gate = await securityState(caller.principal.id, caller.sessionId);
  if (gate?.gate !== "ready") redirect("/account/security");
  if (!caller.principal.is_admin) redirect("/account");
  const result = await createAuthAdmin().rpc("app_recovery_list", {
    p_actor: caller.principal.id,
    p_session: caller.sessionId,
  });
  if (result.error) throw new Error("Recovery queue unavailable");
  if (result.data === null) redirect("/account");
  const list = recoveryListSchema.safeParse(result.data);
  if (!list.success) throw new Error("Recovery queue unavailable");
  return (
    <main
      id="main-content"
      className="mx-auto min-w-0 max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-10"
    >
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Pemulihan akun</h1>
        <p className="text-muted-foreground">
          Periksa identitas pengguna, lalu pulihkan password atau akses sesinya.
        </p>
      </header>
      <RecoveryPanel initialRequests={list.data} />
    </main>
  );
}
