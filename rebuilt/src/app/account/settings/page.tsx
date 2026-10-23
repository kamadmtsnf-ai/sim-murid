import { redirect } from "next/navigation";
import {
  readServerPrincipal,
  readServerAuthClient,
} from "@/lib/auth/read-server";
import { requireCapability, AccessDenied } from "@/lib/auth/authorization";
import { loadSettings } from "@/lib/settings/server";
import { getSupabasePublicEnvironment } from "@/lib/supabase/environment";
import { SettingsPanel } from "./settings-panel";
export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const caller = await readServerPrincipal();
  if (!caller) redirect("/login?expired=1");
  let settings;
  try {
    if (!caller.principal.is_admin) throw new AccessDenied();
    await requireCapability(await readServerAuthClient(), "settings.manage");
    settings = await loadSettings(caller.principal.id, caller.sessionId);
  } catch (error) {
    if (!(error instanceof AccessDenied)) throw Error("Settings unavailable");
    return (
      <main id="main-content" className="mx-auto max-w-xl space-y-4 px-6 py-12">
        <h1 className="text-2xl font-semibold">Pengaturan madrasah</h1>
        <p>
          Akses khusus Admin yang telah menyelesaikan pengaturan keamanan akun.
        </p>
      </main>
    );
  }
  return (
    <main
      id="main-content"
      className="mx-auto min-w-0 max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-10"
    >
      <h1 className="text-3xl font-semibold">Pengaturan madrasah</h1>
      <p>
        Kelola identitas sekolah, logo, mata pelajaran, hafalan dan hari libur.
      </p>
      <SettingsPanel
        initial={settings}
        assetBase={`${getSupabasePublicEnvironment().url}/storage/v1/object/public/school-assets/`}
      />
    </main>
  );
}
