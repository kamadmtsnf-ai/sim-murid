import type { NextRequest } from "next/server";
import { sameOrigin, privateJson } from "@/lib/auth/http";
import { educationContext, failure } from "@/lib/education/server";
import { dispatchOne } from "@/lib/services/dispatch";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return privateJson({ message: "Origin ditolak." }, 403);
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  if (!caller.principal.is_admin)
    return reply({ message: "Admin diperlukan." }, 403);
  try {
    return reply({ message: await dispatchOne() });
  } catch (error) {
    const e = failure(error);
    return reply(
      {
        message:
          "Penyedia atau antrean belum tersedia. Tidak ada pengiriman yang dinyatakan berhasil.",
      },
      e.status,
    );
  }
}
