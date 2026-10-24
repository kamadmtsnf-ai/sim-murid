import { readBounded } from "@/lib/settings/server";
import { securityState } from "@/lib/auth/security";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createAuthAdmin } from "@/lib/auth/admin";
import {
  privateJson,
  requestAuth,
  sameOrigin,
  verifiedPrincipal,
} from "@/lib/auth/http";
import {
  sessionCommand,
  sessionListSchema,
  sessionRevokeSchema,
} from "@/lib/auth/sessions";

async function handle(
  request: NextRequest,
  command: z.infer<typeof sessionCommand>,
) {
  const cookies = privateJson({});
  const response = (body: unknown, status = 200) => {
    const result = privateJson(body, status);
    cookies.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
    return result;
  };
  try {
    const client = requestAuth(request, cookies);
    const state = await verifiedPrincipal(client);
    if (!state)
      return response(
        { message: "Sesi berakhir. Silakan masuk kembali." },
        401,
      );
    const onboarding = await securityState(state.principal.id, state.sessionId);
    if (!onboarding) return response({ message: "Sesi tidak berlaku." }, 401);
    if (onboarding.gate !== "ready")
      return response(
        {
          message: "Selesaikan langkah keamanan akun terlebih dahulu.",
          gate: onboarding?.gate,
          destination: "/account/security",
        },
        403,
      );
    if (
      command.username &&
      command.username !== state.principal.username &&
      !state.principal.is_admin
    )
      return response(
        { message: "Akses sesi akun lain tidak diizinkan." },
        403,
      );
    const args = {
      p_actor: state.principal.id,
      p_auth_session: state.sessionId,
      ...(command.username ? { p_username: command.username } : {}),
    };
    const admin = createAuthAdmin();
    if (command.action === "list") {
      const { data, error } = await admin.rpc("app_session_list", args);
      if (error) throw error;
      if (!data)
        return response(
          { message: "Akun tidak tersedia atau akses tidak diizinkan." },
          403,
        );
      return response({
        ...sessionListSchema.parse(data),
        serverTime: new Date().toISOString(),
      });
    }
    const { data, error } = await admin.rpc("app_session_revoke", {
      ...args,
      ...(command.scope === "one" ? { p_session: command.sessionId } : {}),
    });
    if (error) throw error;
    if (!data)
      return response(
        { message: "Sesi tidak tersedia atau akses tidak diizinkan." },
        403,
      );
    const result = sessionRevokeSchema.parse(data);
    if (result.signed_out) {
      try {
        await client.auth.signOut({ scope: "local" });
      } catch {
        /* Registry revocation is committed; preserve the acknowledged result. */
      }
    }
    return response({
      ...result,
      message: result.revoked
        ? "Sesi berhasil dicabut."
        : "Sesi sudah tidak aktif.",
    });
  } catch {
    return response(
      {
        message:
          "Pengelolaan sesi sedang tidak tersedia. Silakan coba kembali.",
      },
      503,
    );
  }
}
export async function GET(request: NextRequest) {
  return handle(request, { action: "list" });
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return privateJson({ message: "Permintaan tidak diizinkan." }, 403);
  let input: unknown;
  try {
    input = JSON.parse(
      new TextDecoder().decode(await readBounded(request, 2048)),
    );
  } catch (error) {
    return privateJson(
      {
        message:
          error instanceof RangeError
            ? "Permintaan terlalu besar."
            : "Pilih tindakan sesi yang valid.",
      },
      error instanceof RangeError ? 413 : 400,
    );
  }
  const parsed = sessionCommand.safeParse(input);
  if (!parsed.success)
    return privateJson({ message: "Pilih tindakan sesi yang valid." }, 400);
  return handle(request, parsed.data);
}
