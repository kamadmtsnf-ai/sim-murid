import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { createAuthAdmin } from "@/lib/auth/admin";
import { privateJson, requestAuth, sameOrigin } from "@/lib/auth/http";
import { loginSchema, verifiedTokenSession } from "@/lib/auth/validation";
import { getSupabasePublicEnvironment } from "@/lib/supabase/environment";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return privateJson({ message: "Permintaan tidak diizinkan." }, 403);
  if (Number(request.headers.get("content-length") ?? 0) > 8192) return privateJson({ message: "Permintaan terlalu besar." }, 413);
  const body = await request.text();
  if (body.length > 8192) return privateJson({ message: "Permintaan terlalu besar." }, 413);
  let input: unknown;
  try { input = JSON.parse(body); } catch { input = null; }
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return privateJson({ message: "Isi username dan password dengan benar." }, 400);
  const { username, password, remember } = parsed.data;
  try {
    const admin = createAuthAdmin();
    // Vercel's trusted edge header; never trust caller-supplied x-forwarded-for.
    const ip = request.headers.get("x-vercel-forwarded-for") ?? "local";
    for (const value of ["ip:" + ip, "account-ip:" + JSON.stringify([ip, username])]) {
      const { data, error } = await admin.rpc("app_auth_attempt", { p_key: createHash("sha256").update(value).digest("hex") });
      if (error) throw new Error("Rate limiter unavailable");
      if (!data) return privateJson({ message: "Terlalu banyak percobaan. Coba lagi setelah 15 menit." }, 429);
    }
    const { data: profile, error: lookupError } = await admin.from("profiles").select("id,status").eq("username", username).maybeSingle();
    if (lookupError) throw new Error("Account lookup unavailable");
    const identity = profile?.status === "active" ? await admin.auth.admin.getUserById(profile.id) : null;
    // Unknown and inactive accounts still perform a password check with an unprovisioned identity.
    const email = identity?.data.user?.email ?? "unassigned@auth.sim-murid.invalid";
    const { url, publishableKey } = getSupabasePublicEnvironment();
    const auth = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session || data.user.id !== profile?.id || profile.status !== "active") {
      return privateJson({ message: "Username atau password salah, atau akun tidak dapat digunakan." }, 401);
    }
    const sessionId = verifiedTokenSession(data.session.access_token, data.user.id);
    const { data: claimed, error: claimError } = await admin.rpc("app_auth_claim", { p_user: data.user.id, p_session: sessionId, p_remember: remember });
    if (claimError || !claimed) {
      await auth.auth.signOut({ scope: "local" });
      if (claimError) throw new Error("Session registration unavailable");
      return privateJson({ message: "Akun masih digunakan pada sesi lain. Keluar dari sesi tersebut atau hubungi administrator." }, 409);
    }
    const response = privateJson({ destination: "/account" });
    const cookieClient = requestAuth(request, response);
    const saved = await cookieClient.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    if (saved.error) {
      await admin.rpc("app_auth_revoke", { p_user: data.user.id, p_session: sessionId });
      await auth.auth.signOut({ scope: "local" });
      throw new Error("Session cookie unavailable");
    }
    return response;
  } catch {
    return privateJson({ message: "Layanan login sedang tidak tersedia. Silakan coba kembali." }, 503);
  }
}
