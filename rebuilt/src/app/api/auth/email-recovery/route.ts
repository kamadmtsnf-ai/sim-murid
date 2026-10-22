import { readBounded } from "@/lib/settings/server";
import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createAuthAdmin } from "@/lib/auth/admin";
import { privateJson, sameOrigin } from "@/lib/auth/http";
import { passwordValueSchema } from "@/lib/auth/security-validation";
import {
  recoveryEmailRequest,
  recoveryEmailReset,
} from "@/lib/email/validation";
import { reserveAndSend, emailContextSchema } from "@/lib/email/service";
import { emailEnvironment } from "@/lib/email/gmail";
import { otpDigest } from "@/lib/email/otp";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return privateJson({ message: "Permintaan tidak diizinkan." }, 403);
  let body: unknown;
  try {
    body = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        await readBounded(request, 8192),
      ),
    );
  } catch (error) {
    return privateJson(
      {
        message:
          error instanceof RangeError
            ? "Permintaan terlalu besar."
            : "Permintaan pemulihan tidak dapat dibaca. Periksa isian Anda.",
      },
      error instanceof RangeError ? 413 : 400,
    );
  }
  const send = recoveryEmailRequest.safeParse(body);
  const reset = recoveryEmailReset.safeParse(body);
  if (!send.success && !reset.success)
    return privateJson(
      { message: "Periksa username, kode enam digit dan isian password." },
      400,
    );
  let started = false;
  try {
    const admin = createAuthAdmin();
    const env = emailEnvironment();
    const ipRate = await admin.rpc("app_auth_attempt", {
      p_key: createHash("sha256")
        .update(
          "email-recovery-ip:" +
            (request.headers.get("x-vercel-forwarded-for") ?? "local"),
        )
        .digest("hex"),
    });
    if (ipRate.error) throw new Error("Rate unavailable");
    if (!ipRate.data)
      return privateJson(
        { message: "Terlalu banyak percobaan. Coba kembali setelah 15 menit." },
        429,
      );
    if (send.success) {
      const id = randomUUID();
      const reply = () =>
        privateJson(
          {
            message:
              "Jika akun memiliki email kontak yang sudah terverifikasi, kode pemulihan akan dikirim. Jika tidak menerima kode, gunakan bantuan Admin.",
            challengeId: id,
          },
          202,
        );
      const rate = await admin.rpc("app_recovery_probe", {
        p_key: createHash("sha256")
          .update("email-recovery-user:" + send.data.username)
          .digest("hex"),
      });
      if (rate.error) throw new Error("Rate unavailable");
      if (!rate.data) return reply();
      const lookup = await admin.rpc("app_email_recovery_identity", {
        p_username: send.data.username,
      });
      if (lookup.error) throw new Error("Lookup unavailable");
      const found = z
        .object({ user_id: z.uuid(), email: z.email() })
        .safeParse(lookup.data);
      if (found.success) {
        try {
          await reserveAndSend(
            found.data.user_id,
            null,
            found.data.email,
            "recovery",
            id,
          );
        } catch {
          /* Preserve the generic public response even if delivery is unavailable. */
        }
      }
      return reply();
    }
    if (!reset.success)
      return privateJson({ message: "Permintaan tidak valid." }, 400);
    const input = reset.data;
    const strength = passwordValueSchema(input.username).safeParse(
      input.newPassword,
    );
    if (!strength.success || input.newPassword !== input.confirmPassword)
      return privateJson(
        {
          message:
            "Password minimal 8 karakter, maksimal 72 byte; huruf besar/kecil, angka dan simbol, tanpa username atau tiga karakter sama berurutan. Konfirmasi harus sama.",
        },
        400,
      );
    const lookup = await admin.rpc("app_email_context", {
      p_id: input.challengeId,
    });
    if (lookup.error) throw new Error("Lookup unavailable");
    const ticket = emailContextSchema.safeParse(lookup.data);
    const invalid = () =>
      privateJson(
        {
          message:
            "Kode atau permintaan pemulihan tidak berlaku. Kode hanya dapat dipakai sekali dan maksimal 5 percobaan.",
        },
        400,
      );
    if (
      !ticket.success ||
      ticket.data.username !== input.username ||
      ticket.data.purpose !== "recovery"
    )
      return invalid();
    const operation = randomUUID();
    started = true;
    const consumed = await admin.rpc("app_email_consume", {
      p_user: ticket.data.user_id,
      p_session: null!,
      p_id: input.challengeId,
      p_hash: otpDigest(
        env.secret,
        input.challengeId,
        ticket.data.user_id,
        ticket.data.email,
        "recovery",
        input.code,
      ),
      p_operation: operation,
    });
    if (consumed.error) throw new Error("Consume unavailable");
    if (consumed.data !== true) {
      started = false;
      return invalid();
    }
    const changed = await admin.auth.admin.updateUserById(ticket.data.user_id, {
      password: input.newPassword,
    });
    if (changed.error) throw new Error("Auth unavailable");
    const done = await admin.rpc("app_password_finish", {
      p_user: ticket.data.user_id,
      p_operation: operation,
    });
    if (done.error || !done.data) throw new Error("Finish unavailable");
    return privateJson({
      message:
        "Password berhasil diperbarui dan seluruh sesi diakhiri. Masuk kembali dengan password baru.",
      destination: "/login?password=changed",
    });
  } catch {
    return privateJson(
      {
        message: started
          ? "Perubahan password belum dapat dipastikan selesai. Kode mungkin sudah digunakan dan sesi mungkin telah diakhiri. Minta kode baru setelah dua menit atau hubungi Admin."
          : "Layanan pemulihan email belum tersedia. Coba kembali atau gunakan bantuan Admin.",
      },
      503,
    );
  }
}
