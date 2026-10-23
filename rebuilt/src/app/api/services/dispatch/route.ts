import type { NextRequest } from "next/server";
import { sameOrigin, privateJson } from "@/lib/auth/http";
import { educationContext, failure } from "@/lib/education/server";
import { dispatchDelivery } from "@/lib/services/dispatch";
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
    // A current Admin with completed onboarding is required before claiming work.
    const { servicesData } = await import("@/lib/services/server");
    await servicesData(caller.principal.id, caller.sessionId, "jobs");
    const delivery = await dispatchDelivery();
    return reply(delivery, delivery.code === "unconfirmed" ? 503 : 200);
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
