import { NextResponse, type NextRequest } from "next/server";
import { createAuthAdmin } from "@/lib/auth/admin";
import { privateJson, requestAuth, sameOrigin, verifiedPrincipal } from "@/lib/auth/http";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return privateJson({ message: "Permintaan tidak diizinkan." }, 403);
  const response = NextResponse.redirect(new URL("/login?logout=1", request.url), 303);
  response.headers.set("Cache-Control", "private, no-store");
  try {
    const client = requestAuth(request, response);
    const state = await verifiedPrincipal(client);
    if (state) {
      const { error } = await createAuthAdmin().rpc("app_auth_revoke", { p_user: state.principal.id, p_session: state.sessionId });
      if (error) throw error;
    }
    await client.auth.signOut({ scope: "local" });
    return response;
  } catch {
    return privateJson({ message: "Belum berhasil keluar. Silakan coba kembali." }, 503);
  }
}
