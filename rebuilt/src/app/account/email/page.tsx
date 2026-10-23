import { redirect } from "next/navigation";
import { readServerPrincipal } from "@/lib/auth/read-server";
import { createAuthAdmin } from "@/lib/auth/admin";
import { emailStateSchema } from "@/lib/email/validation";
import { EmailPanel } from "./email-panel";
export const dynamic = "force-dynamic";
export default async function EmailPage() {
  const caller = await readServerPrincipal();
  if (!caller) redirect("/login?expired=1");
  const r = await createAuthAdmin().rpc("app_email_state", {
    p_user: caller.principal.id,
    p_session: caller.sessionId,
  });
  if (r.error) throw new Error("Email state unavailable");
  if (r.data === null) redirect("/account/security");
  const state = emailStateSchema.parse(r.data);
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full min-w-0 max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-10"
    >
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Verifikasi email
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Pastikan email kontak akun Guru aktif dan dapat menerima kode
          verifikasi.
        </p>
      </header>
      <EmailPanel
        initialState={state}
        initialServerTime={new Date().toISOString()}
      />
    </main>
  );
}
