import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { privateJson } from "@/lib/auth/http";
import { createAuthAdmin } from "@/lib/auth/admin";
import { dispatchOne } from "@/lib/services/dispatch";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET,
    token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (
    !expected ||
    !token ||
    Buffer.byteLength(token) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  )
    return privateJson({ message: "Akses ditolak." }, 401);
  const r = await createAuthAdmin().rpc("app_jobs_tick", { p_dry_run: false });
  if (r.error)
    return privateJson({ message: "Pekerjaan belum tersedia." }, 503);
  let delivery = "disabled";
  if (process.env.SERVICES_DISPATCH_ENABLED === "true")
    delivery = await dispatchOne();
  return privateJson({ message: "Pemeriksaan pekerjaan selesai.", delivery });
}
