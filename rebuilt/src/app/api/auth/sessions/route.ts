import type { NextRequest } from "next/server";
import { z } from "zod";
import { createAuthAdmin } from "@/lib/auth/admin";
import { privateJson, requestAuth, sameOrigin, verifiedPrincipal } from "@/lib/auth/http";
import { sessionCommand, sessionListSchema } from "@/lib/auth/sessions";

async function handle(request: NextRequest, command: z.infer<typeof sessionCommand>) {
  const cookies = privateJson({});
  const response = (body: unknown, status = 200) => {
    const result = privateJson(body, status);
    cookies.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
    return result;
  };
  try {
    const client = requestAuth(request, cookies);
    const state = await verifiedPrincipal(client);
    if (!state) return response({ message: "Sesi berakhir. Silakan masuk kembali." }, 401);
    const args = { p_actor: state.principal.id, p_auth_session: state.sessionId, ...(command.username ? { p_username: command.username } : {}) };
    const admin = createAuthAdmin();
    if (command.action === "list") {
      const { data, error } = await admin.rpc("app_session_list", args);
      if (error) throw error;
      if (!data) return response({ message: "Akun tidak tersedia atau akses tidak diizinkan." }, 403);
      return response(sessionListSchema.parse(data));
    }
    const { data, error } = await admin.rpc("app_session_revoke", { ...args, ...(command.scope === "one" ? { p_session: command.sessionId } : {}) });
    if (error) throw error;
    if (!data) return response({ message: "Sesi tidak tersedia atau akses tidak diizinkan." }, 403);
    const result = z.object({ revoked: z.number().int().nonnegative(), signed_out: z.boolean() }).parse(data);
    if (result.signed_out) await client.auth.signOut({ scope: "local" });
    return response({ ...result, message: result.revoked ? "Sesi berhasil dicabut." : "Sesi sudah tidak aktif." });
  } catch {
    return response({ message: "Pengelolaan sesi sedang tidak tersedia. Silakan coba kembali." }, 503);
  }
}
export async function GET(request: NextRequest) { return handle(request, { action: "list" }); }
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return privateJson({ message: "Permintaan tidak diizinkan." }, 403);
  if (Number(request.headers.get("content-length") ?? 0) > 2048) return privateJson({ message: "Permintaan terlalu besar." }, 413);
  const text = await request.text();
  if (text.length > 2048) return privateJson({ message: "Permintaan terlalu besar." }, 413);
  let input: unknown;
  try { input = JSON.parse(text); } catch { input = null; }
  const parsed = sessionCommand.safeParse(input);
  if (!parsed.success) return privateJson({ message: "Pilih tindakan sesi yang valid." }, 400);
  return handle(request, parsed.data);
}
