import { securityState } from "@/lib/auth/security";
import type { NextRequest } from "next/server";
import { loadOwnAccess } from "@/lib/auth/access-page";
import { privateJson, requestAuth, verifiedPrincipal } from "@/lib/auth/http";
export async function GET(request: NextRequest) {
  const cookies = privateJson({});
  const respond = (body: unknown, status = 200) => {
    const result = privateJson(body, status);
    cookies.cookies.getAll().forEach((c) => result.cookies.set(c));
    return result;
  };
  try {
    const client = requestAuth(request, cookies),
      caller = await verifiedPrincipal(client);
    if (!caller)
      return respond(
        { message: "Sesi tidak berlaku. Silakan masuk kembali." },
        401,
      );
    const gate = await securityState(caller.principal.id, caller.sessionId);
    if (!gate)
      return respond(
        { message: "Sesi tidak berlaku. Silakan masuk kembali." },
        401,
      );
    if (gate.gate !== "ready")
      return respond(
        {
          message: "Selesaikan langkah keamanan akun terlebih dahulu.",
          gate: gate.gate,
          destination: "/account/security",
        },
        403,
      );
    const context = await loadOwnAccess(client, caller.principal.id);
    return respond(
      context ?? {
        message:
          "Sesi tidak berlaku atau peran akun berubah. Silakan masuk kembali.",
      },
      context ? 200 : 401,
    );
  } catch {
    return respond(
      {
        message:
          "Pemeriksaan akses sedang tidak tersedia. Silakan coba kembali.",
      },
      503,
    );
  }
}
