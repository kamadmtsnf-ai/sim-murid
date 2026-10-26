import type { NextRequest } from "next/server";
import { createAuthAdmin } from "@/lib/auth/admin";
import {
  privateJson,
  requestAuth,
  sameOrigin,
  verifiedPrincipal,
} from "@/lib/auth/http";
import { securityState } from "@/lib/auth/security";
import { emailCommand, emailStateSchema } from "@/lib/email/validation";
import { emailContextSchema, reserveAndSend } from "@/lib/email/service";
import { emailEnvironment } from "@/lib/email/gmail";
import { otpDigest } from "@/lib/email/otp";
import type { z } from "zod";
import { readBounded } from "@/lib/settings/server";
async function handle(request: NextRequest, mutate = false) {
  const jar = privateJson({});
  const respond = (body: unknown, status = 200) => {
    const r = privateJson(body, status);
    jar.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };
  try {
    const caller = await verifiedPrincipal(requestAuth(request, jar));
    if (!caller) return respond({ message: "Sesi tidak berlaku." }, 401);
    const admin = createAuthAdmin();
    const args = { p_user: caller.principal.id, p_session: caller.sessionId };
    const read = await admin.rpc("app_email_state", args);
    if (read.error) throw new Error("State unavailable");
    if (read.data === null)
      return respond(
        {
          message:
            "Selesaikan langkah keamanan akun sebelumnya untuk menggunakan verifikasi email.",
          destination: "/account/security",
        },
        403,
      );
    const state = emailStateSchema.parse(read.data);
    if (!mutate)
      return respond({ state, serverTime: new Date().toISOString() });
    let command: z.infer<typeof emailCommand>;
    try {
      command = emailCommand.parse(
        JSON.parse(new TextDecoder().decode(await readBounded(request, 2048))),
      );
    } catch (error) {
      return respond(
        {
          message:
            error instanceof RangeError
              ? "Permintaan terlalu besar."
              : "Periksa permintaan dan kode enam digit angka.",
        },
        error instanceof RangeError ? 413 : 400,
      );
    }

    if (command.action === "address") {
      if (state.email !== command.expectedEmail)
        return respond(
          { message: "Email berubah. Muat ulang status sebelum menyimpan." },
          409,
        );
      const write = await admin.rpc("app_email_address", {
        ...args,
        p_expected_email: command.expectedEmail,
        p_email: command.email,
      });
      if (write.error) throw Error("Address unavailable");
      if (write.data !== true)
        return respond(
          { message: "Profil berubah. Muat ulang status sebelum menyimpan." },
          409,
        );
      const fresh = await admin.rpc("app_email_state", args);
      if (fresh.error) throw Error("Readback unavailable");
      const confirmed = emailStateSchema.parse(fresh.data);
      if (confirmed.email !== command.email) throw Error("Unconfirmed email");
      return respond({
        message: "Email kontak tersimpan. Selanjutnya kirim kode verifikasi.",
        state: confirmed,
        serverTime: new Date().toISOString(),
      });
    }
    if (command.action === "send") {
      if (state.verified)
        return respond({ message: "Email sudah terverifikasi." });
      const result = await reserveAndSend(
        caller.principal.id,
        caller.sessionId,
        state.email,
        "verify",
      );
      if (!result.ok) {
        const rate = ["cooldown", "daily_limit", "global_limit"].includes(
          result.code,
        );
        const messages: Record<string, string> = {
          cooldown:
            "Tunggu 60 detik dari permintaan terakhir sebelum mengirim ulang.",
          daily_limit:
            "Batas 5 permintaan kode hari ini telah tercapai. Coba kembali besok (WIB).",
          global_limit:
            "Kuota pengiriman aplikasi sedang penuh. Coba kembali nanti.",
          invalid_email:
            "Isi dan simpan email kontak yang valid pada halaman ini terlebih dahulu.",
          address_changed:
            "Email atau langkah akun berubah. Muat ulang sebelum meminta kode.",
          busy: "Perubahan password sedang diproses. Coba lagi setelah dua menit.",
          delivery_failed:
            "Pengiriman belum dapat dikonfirmasi. Periksa kotak masuk dan spam, lalu muat ulang status. Hubungi Admin jika masalah berlanjut.",
        };
        return respond(
          {
            message:
              messages[result.code] ?? "Permintaan kode tidak diizinkan.",
            retry_after: result.retry_after,
          },
          rate ? 429 : result.code === "delivery_failed" ? 503 : 400,
        );
      }
      return respond({
        message:
          "Kode verifikasi telah diterima layanan pengiriman untuk email kontak Anda. Periksa kotak masuk dan spam. Kode berlaku maksimal 10 menit.",
        challengeId: result.challengeId,
        expires_at: result.expires_at,
      });
    }
    const context = await admin.rpc("app_email_context", {
      p_id: command.challengeId,
    });
    if (context.error) throw new Error("Context unavailable");
    const ticket = emailContextSchema.safeParse(context.data);
    if (
      !ticket.success ||
      ticket.data.user_id !== caller.principal.id ||
      ticket.data.purpose !== "verify"
    )
      return respond(
        { message: "Kode atau permintaan verifikasi tidak berlaku." },
        400,
      );
    const consumed = await admin.rpc("app_email_consume", {
      ...args,
      p_id: command.challengeId,
      p_hash: otpDigest(
        emailEnvironment().secret,
        command.challengeId,
        caller.principal.id,
        ticket.data.email,
        "verify",
        command.code,
      ),
    });
    if (consumed.error) throw new Error("Verification unavailable");
    if (consumed.data !== true)
      return respond(
        {
          message:
            "Kode tidak sesuai, sudah dipakai, kedaluwarsa, atau batas percobaan tercapai. Maksimal 5 percobaan per kode.",
        },
        400,
      );
    return respond({
      message: "Email berhasil diverifikasi.",
      state: await securityState(caller.principal.id, caller.sessionId),
    });
  } catch {
    return respond(
      {
        message:
          "Layanan verifikasi email belum tersedia. Coba kembali beberapa saat lagi.",
      },
      503,
    );
  }
}
export async function GET(request: NextRequest) {
  return handle(request);
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return privateJson({ message: "Permintaan tidak diizinkan." }, 403);
  return handle(request, true);
}
