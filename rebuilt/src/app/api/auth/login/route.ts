import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { createAuthAdmin } from "@/lib/auth/admin";
import { privateJson, requestAuth, sameOrigin } from "@/lib/auth/http";
import { loginSchema, verifiedTokenSession } from "@/lib/auth/validation";
import { getSupabasePublicEnvironment } from "@/lib/supabase/environment";
import { deviceLabel } from "@/lib/auth/devices";
import { readBounded } from "@/lib/settings/server";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return privateJson({ message: "Permintaan tidak diizinkan." }, 403);
  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await readBounded(request, 8192)));
  } catch (error) {
    return privateJson({ message: error instanceof RangeError ? "Permintaan terlalu besar." : "Permintaan login tidak dapat dibaca. Silakan periksa isian." }, error instanceof RangeError ? 413 : 400);
  }
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return privateJson({ message: "Isi username dan password dengan benar." }, 400);
  const { username, password, remember } = parsed.data;
  let admin: ReturnType<typeof createAuthAdmin> | undefined;
  let auth: ReturnType<typeof createClient> | undefined;
  let issued: { userId: string; sessionId?: string } | undefined;
  let claimAttempted = false;
  let transferred = false;
  try {
    request.signal.throwIfAborted();
    admin = createAuthAdmin();
    // Vercel's trusted edge header; never trust caller-supplied x-forwarded-for.
    const ip = request.headers.get("x-vercel-forwarded-for") ?? "local";
    for (const value of ["ip:" + ip, "account-ip:" + JSON.stringify([ip, username])]) {
      const { data, error } = await admin.rpc("app_auth_attempt", { p_key: createHash("sha256").update(value).digest("hex") });
      if (error) throw new Error("Rate limiter unavailable");
      if (data !== true) return privateJson({ message: "Terlalu banyak percobaan. Coba lagi setelah 15 menit." }, 429);
    }
    const { data: profile, error: lookupError } = await admin.from("profiles").select("id,status").eq("username", username).maybeSingle();
    if (lookupError) throw new Error("Account lookup unavailable");
    const activeProfile = profile?.status === "active" ? profile : null;
    // Probe the same provider path for unknown/inactive usernames so an Auth outage does not reveal account existence.
    const identity = await admin.auth.admin.getUserById(activeProfile?.id ?? "00000000-0000-4000-8000-000000000000");
    if (identity?.error && identity.error.status !== 404) {
      if (identity.error.status === 429) return privateJson({ message: "Layanan sedang membatasi percobaan. Tunggu sebentar sebelum mencoba kembali." }, 429);
      throw new Error("Identity service unavailable");
    }
    // Unknown and inactive accounts still perform a password check with an unprovisioned identity.
    const email = (activeProfile ? identity.data.user?.email : null) ?? "unassigned@auth.sim-murid.invalid";
    const { url, publishableKey } = getSupabasePublicEnvironment();
    auth = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (data.session && data.user) issued = { userId: data.user.id };
    if (error && (!error.status || error.status >= 500)) throw new Error("Password service unavailable");
    if (error?.status === 429) return privateJson({ message: "Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba kembali." }, 429);
    if (error || !data.user || !data.session || data.user.id !== profile?.id || profile?.status !== "active") {
      return privateJson({ message: "Username atau password salah, atau akun tidak dapat digunakan." }, 401);
    }
    request.signal.throwIfAborted();
    const sessionId = verifiedTokenSession(data.session.access_token, data.user.id);
    issued = { userId: data.user.id, sessionId };
    // Even a lost claim response may have committed. Cleanup targets this exact Auth session only.
    claimAttempted = true;
    const { data: claimed, error: claimError } = await admin.rpc("app_auth_claim", { p_user: data.user.id, p_session: sessionId, p_remember: remember });
    if (claimError) throw new Error("Session registration unavailable");
    if (claimed !== true) return privateJson({ message: "Akun masih digunakan pada sesi lain. Keluar dari sesi tersebut atau hubungi administrator." }, 409);
    try {
      await admin.rpc("app_auth_device", { p_user: data.user.id, p_session: sessionId, p_label: deviceLabel(request.headers.get("user-agent") ?? "") });
    } catch { /* Optional display metadata must not turn a valid login into an orphaned session. */ }
    request.signal.throwIfAborted();
    const response = privateJson({ destination: "/account" });
    const saved = await requestAuth(request, response).auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    if (saved.error) throw new Error("Session cookie unavailable");
    request.signal.throwIfAborted();
    transferred = true;
    return response;
  } catch {
    return privateJson({ message: "Layanan login sedang tidak tersedia. Silakan coba kembali." }, 503);
  } finally {
    if (!transferred && issued && auth) {
      if (claimAttempted && issued.sessionId && admin) {
        try {
          const cleanup = await admin.rpc("app_auth_revoke", { p_user: issued.userId, p_session: issued.sessionId });
          if (cleanup.error) console.warn("Login cleanup unavailable", { stage: "registry" });
        } catch { console.warn("Login cleanup unavailable", { stage: "registry" }); }
      }
      try {
        const cleanup = await auth.auth.signOut({ scope: "local" });
        if (cleanup.error) console.warn("Login cleanup unavailable", { stage: "provider" });
      } catch { console.warn("Login cleanup unavailable", { stage: "provider" }); }
    }
  }
}
