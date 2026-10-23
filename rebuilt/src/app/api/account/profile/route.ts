import type { NextRequest } from "next/server";
import { createAuthAdmin } from "@/lib/auth/admin";
import {
  privateJson,
  requestAuth,
  sameOrigin,
  verifiedPrincipal,
} from "@/lib/auth/http";
import { readBounded } from "@/lib/settings/server";
import { profileWriteSchema } from "@/lib/auth/profile";
import { profileSchema } from "@/lib/auth/recovery-validation";
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
    if (mutate) {
      let input: ReturnType<typeof profileWriteSchema.parse>;
      try {
        input = profileWriteSchema.parse(
          JSON.parse(
            new TextDecoder().decode(await readBounded(request, 16384)),
          ),
        );
      } catch (error) {
        return respond(
          {
            message:
              error instanceof RangeError
                ? "Permintaan terlalu besar."
                : "Periksa nama, nomor HP, email dan bio.",
          },
          error instanceof RangeError ? 413 : 400,
        );
      }

      if (input.username !== caller.principal.username)
        return respond(
          { message: "Username tidak dapat diubah di sini." },
          403,
        );
      const result = await admin.rpc("app_profile_update", {
        ...args,
        p_version: input.updated_at,
        p_name: input.full_name,
        p_phone: input.phone,
        p_email: input.contact_email,
        p_bio: input.bio,
      });
      if (result.error) throw new Error("Update unavailable");
      if (result.data !== true)
        return respond(
          {
            message:
              "Profil berubah atau langkah akun belum mengizinkan pembaruan. Muat ulang sebelum menyimpan.",
          },
          409,
        );
    }
    const result = await admin.rpc("app_profile_read", args);
    if (result.error) throw new Error("Read unavailable");
    if (!result.data)
      return respond(
        {
          message:
            "Selesaikan langkah keamanan atau profil wajib terlebih dahulu.",
          destination: "/account/security",
        },
        403,
      );
    const profile = profileSchema.parse(result.data);
    if (profile.username !== caller.principal.username)
      throw new Error("Profile identity unavailable");
    return respond({
      profile,
      ...(mutate ? { message: "Profil berhasil diperbarui." } : {}),
    });
  } catch {
    return respond(
      {
        message:
          "Layanan profil belum tersedia. Periksa status profil sebelum mengirim ulang perubahan.",
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
