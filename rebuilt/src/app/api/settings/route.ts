import { confirmSettings } from "@/lib/settings/confirmation";
import type { NextRequest } from "next/server";
import { privateJson, sameOrigin } from "@/lib/auth/http";
import { AccessDenied } from "@/lib/auth/authorization";
import { createAuthAdmin } from "@/lib/auth/admin";
import { settingsRequest } from "@/lib/settings/validation";
import {
  settingsCaller,
  loadSettings,
  readBounded,
  writeResult,
  resultMessage,
  collectUnusedLogos,
} from "@/lib/settings/server";
async function handle(request: NextRequest, mutate: boolean) {
  const jar = privateJson({});
  const reply = (body: unknown, status = 200) => {
    const response = privateJson(body, status);
    jar.cookies.getAll().forEach((c) => response.cookies.set(c));
    return response;
  };
  try {
    const caller = await settingsCaller(request, jar);
    if (!caller) return reply({ message: "Sesi tidak berlaku." }, 401);
    const args = { p_actor: caller.principal.id, p_session: caller.sessionId };
    let message = "";
    let confirmed;
    if (mutate) {
      let body: unknown;
      try {
        body = JSON.parse(
          new TextDecoder().decode(await readBounded(request, 16384)),
        );
      } catch (error) {
        if (error instanceof RangeError)
          return reply({ message: "Permintaan terlalu besar." }, 413);
        return reply({ message: "Format permintaan tidak valid." }, 400);
      }
      const parsed = settingsRequest.safeParse(body);
      if (!parsed.success)
        return reply(
          { message: parsed.error.issues[0]?.message ?? "Periksa isian." },
          400,
        );
      const r = await createAuthAdmin().rpc("app_settings_write", {
        ...args,
        p_request: parsed.data.requestId,
        p_revision: parsed.data.revision,
        p_command: parsed.data.command,
      });
      if (r.error) throw new Error("Write unavailable");
      const result = writeResult.parse(r.data);
      if (result.code !== "saved")
        return reply(
          {
            code: result.code,
            message: resultMessage[result.code] ?? "Permintaan belum berhasil.",
          },
          result.code === "denied" ? 403 : 409,
        );
      if (result.revision !== parsed.data.revision + 1)
        throw Error("Write revision not confirmed");
      message =
        parsed.data.command.type === "holiday"
          ? `Hari libur tersimpan: ${result.added ?? 0} ditambahkan/diperbarui, ${result.skipped ?? 0} tanggal dilewati.`
          : "Pengaturan berhasil disimpan.";
      confirmed = await loadSettings(args.p_actor, args.p_session);
      confirmSettings(confirmed, parsed.data.command, result.revision!);
      await collectUnusedLogos(args.p_actor, args.p_session);
    }
    return reply({
      settings: confirmed ?? (await loadSettings(args.p_actor, args.p_session)),
      message,
      ...(mutate ? { code: "saved" } : {}),
    });
  } catch (error) {
    return reply(
      {
        message:
          error instanceof AccessDenied
            ? "Akses ditolak. Selesaikan pengaturan keamanan akun atau periksa hak akses."
            : "Hasil belum dapat dipastikan. Muat ulang pengaturan sebelum mencoba kembali.",
      },
      error instanceof AccessDenied ? 403 : 503,
    );
  }
}
export async function GET(request: NextRequest) {
  return handle(request, false);
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return privateJson({ message: "Permintaan tidak diizinkan." }, 403);
  return handle(request, true);
}
