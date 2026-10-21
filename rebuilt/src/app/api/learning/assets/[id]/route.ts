import type { NextRequest } from "next/server";
import { z } from "zod";
import { educationContext, failure } from "@/lib/education/server";
import { createAuthAdmin } from "@/lib/auth/admin";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  try {
    const id = z.uuid().parse((await params).id),
      download = request.nextUrl.searchParams.get("download") === "true",
      admin = createAuthAdmin();
    const r = await admin.rpc("app_asset_get", {
      p_actor: caller.principal.id,
      p_session: caller.sessionId,
      p_id: id,
      p_download: download,
    });
    if (r.error) throw new Error("Unavailable");
    if (!r.data) return reply({ message: "Akses ditolak." }, 403);
    const meta = z
        .object({ path: z.string(), mime: z.string(), filename: z.string() })
        .parse(r.data),
      file = await admin.storage.from("learning-private").download(meta.path);
    if (file.error || !file.data) throw new Error("Storage unavailable");
    return new Response(file.data.stream(), {
      headers: {
        "Content-Type": meta.mime,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="document.${meta.mime === "application/pdf" ? "pdf" : meta.mime === "image/png" ? "png" : "jpg"}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const e = failure(error);
    return reply({ message: e.message }, e.status);
  }
}
