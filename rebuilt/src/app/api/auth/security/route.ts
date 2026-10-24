import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { createAuthAdmin } from "@/lib/auth/admin";
import {
  privateJson,
  requestAuth,
  sameOrigin,
  verifiedPrincipal,
} from "@/lib/auth/http";
import { securityState, confirmCurrentPassword } from "@/lib/auth/security";
import {
  passwordChangeSchema,
  questionChangeSchema,
} from "@/lib/auth/security-validation";
import { readBounded } from "@/lib/settings/server";
import { hashAnswer } from "@/lib/auth/answer-hash";
export async function GET(request: NextRequest) {
  const cookies = privateJson({});
  const respond = (body: unknown, status = 200) => {
    const result = privateJson(body, status);
    cookies.cookies.getAll().forEach((c) => result.cookies.set(c));
    return result;
  };
  try {
    const state = await verifiedPrincipal(requestAuth(request, cookies));
    if (!state)
      return respond({ message: "Sesi berakhir. Silakan masuk kembali." }, 401);
    const data = await securityState(state.principal.id, state.sessionId);
    return respond(
      data ?? { message: "Sesi tidak berlaku." },
      data ? 200 : 401,
    );
  } catch {
    return respond({ message: "Pemeriksaan keamanan belum tersedia." }, 503);
  }
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return privateJson({ message: "Permintaan tidak diizinkan." }, 403);
  let input: unknown;
  try {
    input = JSON.parse(
      new TextDecoder().decode(await readBounded(request, 8192)),
    );
  } catch (error) {
    return privateJson(
      {
        message:
          error instanceof RangeError
            ? "Permintaan terlalu besar."
            : "Permintaan tidak valid.",
      },
      error instanceof RangeError ? 413 : 400,
    );
  }
  const cookies = privateJson({});
  let started = false;
  let providerChanged = false;
  const respond = (data: unknown, status = 200) => {
    const result = privateJson(data, status);
    cookies.cookies.getAll().forEach((c) => result.cookies.set(c));
    return result;
  };
  try {
    const client = requestAuth(request, cookies);
    const state = await verifiedPrincipal(client);
    if (!state)
      return respond({ message: "Sesi berakhir. Silakan masuk kembali." }, 401);
    const gate = await securityState(state.principal.id, state.sessionId);
    if (!gate) return respond({ message: "Sesi tidak berlaku." }, 401);
    const password = passwordChangeSchema(state.principal.username).safeParse(
      input,
    );
    const question = questionChangeSchema.safeParse(input);
    if (!password.success && !question.success)
      return respond(
        { message: "Periksa isian dan ketentuan keamanan akun." },
        400,
      );
    if (question.success && !gate.can_set_question)
      return respond(
        {
          message:
            "Selesaikan langkah keamanan atau profil yang diwajibkan terlebih dahulu.",
          destination: "/account/security",
        },
        403,
      );
    const admin = createAuthAdmin();
    const args = { p_user: state.principal.id, p_session: state.sessionId };
    const limit = await admin.rpc("app_security_rate", args);
    if (limit.error) throw new Error("Rate limiter unavailable");
    if (limit.data !== true)
      return respond(
        {
          message:
            "Batas 5 percobaan keamanan per 15 menit tercapai. Coba lagi nanti.",
        },
        429,
      );
    const old = password.success
      ? password.data.currentPassword
      : question.success
        ? question.data.currentPassword
        : "";
    if (!(await confirmCurrentPassword(state.principal.id, old)))
      return respond({ message: "Password saat ini tidak sesuai." }, 400);
    if (password.success) {
      const operation = randomUUID();
      const begin = await admin.rpc("app_password_begin", {
        ...args,
        p_operation: operation,
      });
      if (begin.error) throw new Error("Password transaction unavailable");
      if (begin.data !== true)
        return respond(
          {
            message:
              "Perubahan sedang diproses atau sesi tidak berlaku. Masuk kembali bila diperlukan.",
          },
          409,
        );
      started = true;
      const changed = await admin.auth.admin.updateUserById(
        state.principal.id,
        { password: password.data.newPassword },
      );
      if (changed.error) throw new Error("Password provider unavailable");
      providerChanged = true;
      const finished = await admin.rpc("app_password_finish", {
        p_user: state.principal.id,
        p_operation: operation,
      });
      if (finished.error || finished.data !== true)
        throw new Error("Password finalization unavailable");
      await client.auth.signOut({ scope: "global" });
      return respond({
        message:
          "Password berhasil diperbarui. Seluruh sesi diakhiri. Masuk kembali dengan password baru.",
        signed_out: true,
        destination: "/login?password=changed",
      });
    }
    if (question.success) {
      const saved = await admin.rpc("app_security_question_save", {
        ...args,
        p_question: question.data.question,
        p_hash: await hashAnswer(question.data.answer),
      });
      if (saved.error) throw new Error("Security question storage unavailable");
      if (saved.data !== true)
        return respond(
          { message: "Langkah keamanan berubah. Muat ulang halaman." },
          409,
        );
      let next = null;
      try {
        next = await securityState(state.principal.id, state.sessionId);
      } catch {
        /* The write has already been acknowledged. Client can reload state safely. */
      }
      return respond({
        message: "Pertanyaan keamanan berhasil disimpan.",
        saved: true,
        state: next,
      });
    }
    return respond({ message: "Permintaan tidak valid." }, 400);
  } catch {
    return respond(
      {
        message: started
          ? providerChanged
            ? "Password sudah berubah, tetapi proses konfirmasi belum selesai. Masuk dengan password baru untuk melanjutkan atau hubungi administrator."
            : "Sesi telah diakhiri untuk keamanan. Perubahan password belum dapat dipastikan. Coba masuk kembali atau hubungi administrator."
          : "Layanan keamanan belum tersedia. Silakan coba kembali.",
        signed_out: started,
      },
      503,
    );
  }
}
