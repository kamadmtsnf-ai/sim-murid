import { readBounded } from "@/lib/settings/server";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createAuthAdmin } from "@/lib/auth/admin";
import { privateJson, sameOrigin } from "@/lib/auth/http";
import { recoveryRequestSchema } from "@/lib/auth/recovery-validation";
import { verifyAnswer } from "@/lib/auth/answer-hash";
const identity = z.object({
  id: z.uuid(),
  question_code: z.string().nullable(),
  answer_hash: z.string().nullable(),
});
const accepted = {
  message:
    "Jika akun dan informasi sesuai, permintaan diteruskan kepada Admin. Hubungi petugas madrasah untuk verifikasi identitas. Permintaan ini tidak langsung mengubah password atau sesi.",
};
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return privateJson({ message: "Permintaan tidak diizinkan." }, 403);
  let body: unknown;
  try {
    body = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        await readBounded(request, 4096),
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
  const input = recoveryRequestSchema.safeParse(body);
  if (!input.success)
    return privateJson({ message: "Periksa isian permintaan pemulihan." }, 400);
  try {
    const admin = createAuthAdmin();
    const ip = request.headers.get("x-vercel-forwarded-for") ?? "local";
    const ipRate = await admin.rpc("app_auth_attempt", {
      p_key: createHash("sha256")
        .update("recovery-ip:" + ip)
        .digest("hex"),
    });
    if (ipRate.error) throw new Error("Rate unavailable");
    if (!ipRate.data)
      return privateJson(
        {
          message: "Terlalu banyak permintaan. Coba kembali setelah 15 menit.",
        },
        429,
      );
    const rate = await admin.rpc("app_recovery_probe", {
      p_key: createHash("sha256")
        .update("recovery-user:" + input.data.username)
        .digest("hex"),
    });
    if (rate.error) throw new Error("Rate unavailable");
    if (!rate.data) return privateJson(accepted, 202);
    const found = await admin.rpc("app_recovery_identity", {
      p_username: input.data.username,
    });
    if (found.error) throw new Error("Lookup unavailable");
    const account = identity.safeParse(found.data);
    const q = input.data.method === "question";
    const matchesQuestion =
      account.success && input.data.question === account.data.question_code;
    const hash =
      matchesQuestion && account.success && account.data.answer_hash
        ? account.data.answer_hash
        : "scrypt$v1$16384$8$1$" + "0".repeat(32) + "$" + "0".repeat(64);
    const answerMatches = q
      ? await verifyAnswer(input.data.answer ?? "", hash)
      : false;
    if (account.success) {
      const proof = q && matchesQuestion && answerMatches;
      if (!q || proof) {
        const saved = await admin.rpc("app_recovery_request", {
          p_user: account.data.id,
          p_type: input.data.requestType,
          p_answer_verified: proof,
        });
        if (saved.error) throw new Error("Request unavailable");
      }
    }
    return privateJson(accepted, 202);
  } catch {
    return privateJson(
      {
        message: "Layanan pemulihan belum tersedia. Hubungi petugas madrasah.",
      },
      503,
    );
  }
}
