import { redirect } from "next/navigation";
import { readServerPrincipal } from "@/lib/auth/read-server";
import { securityState } from "@/lib/auth/security";
import { createAuthAdmin } from "@/lib/auth/admin";
import { profileSchema } from "@/lib/auth/recovery-validation";
import { ProfileForm } from "./profile-form";
export const dynamic = "force-dynamic";
export default async function ProfilePage() {
  const caller = await readServerPrincipal();
  if (!caller) redirect("/login?expired=1");
  let gate;
  let profile;
  if (caller) {
    gate = await securityState(caller.principal.id, caller.sessionId);
    if (gate && ["ready", "email_pending"].includes(gate.gate)) {
      const r = await createAuthAdmin().rpc("app_profile_read", {
        p_user: caller.principal.id,
        p_session: caller.sessionId,
      });
      if (r.error) throw new Error("Unavailable");
      if (r.data) profile = profileSchema.parse(r.data);
    }
  }

  if (!profile) redirect("/account/security");
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full min-w-0 max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-10"
    >
      <h1 className="text-3xl font-semibold">Profil pribadi</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Perbarui nama, nomor HP, email kontak dan bio. Perubahan email
        membatalkan verifikasi lama. Formulir ini tidak menggantikan biodata
        wajib Siswa atau Calon Siswa.
      </p>
      <ProfileForm initialProfile={profile} />
    </main>
  );
}
