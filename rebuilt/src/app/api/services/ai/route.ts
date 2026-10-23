import type { NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { sameOrigin, privateJson } from "@/lib/auth/http";
import { educationContext, jsonBody, failure } from "@/lib/education/server";
import { createAuthAdmin } from "@/lib/auth/admin";
import { encryptKey, analyzeEssays } from "@/lib/services/providers";
import { servicesData } from "@/lib/services/server";
import type { Json } from "@/lib/supabase/cloud.types";
export const runtime = "nodejs";
export const maxDuration = 60;
const input = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("configure"),
      provider: z.enum(["anthropic", "gemini", "openai"]),
      model: z.string().regex(/^[a-zA-Z0-9._:-]{1,150}$/),
      key: z.string().min(10).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.enum(["analyze", "invalidate"]),
      provider: z.enum(["anthropic", "gemini", "openai"]),
      periodId: z.uuid(),
    })
    .strict(),
]);
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return privateJson({ message: "Origin ditolak." }, 403);
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  try {
    const body = input.parse(await jsonBody(request)),
      admin = createAuthAdmin(),
      args = { p_actor: caller.principal.id, p_session: caller.sessionId };
    if (body.action === "configure") {
      if (!caller.principal.is_admin)
        return reply({ message: "Admin diperlukan." }, 403);
      const d = await servicesData(args.p_actor, args.p_session, "insights"),
        r = await admin.rpc("app_services_write", {
          ...args,
          p_request: randomUUID(),
          p_revision: d.revision,
          p_module: "insights",
          p_command: {
            type: "ai_config",
            provider: body.provider,
            model: body.model,
            encryptedKey: encryptKey(body.key),
          },
        });
      if (r.error || !r.data || (r.data as { code: string }).code !== "saved")
        throw new Error("Unavailable");
      return reply({ message: "Konfigurasi terenkripsi disimpan." });
    }
    const r = await admin.rpc("app_ai_run", {
      ...args,
      p_action: body.action === "analyze" ? "prepare" : "invalidate",
      p_data: { periodId: body.periodId, provider: body.provider },
    });
    if (r.error) throw new Error("Unavailable");
    const result = z
      .object({
        code: z.string(),
        id: z.uuid().optional(),
        essays: z.array(z.string()).optional(),
        config: z
          .object({ encrypted_key: z.string(), model: z.string() })
          .optional(),
      })
      .extend({
        analysis: z
          .object({ status: z.enum(["running", "succeeded", "failed"]) })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .parse(r.data);
    if (body.action === "invalidate")
      return reply(
        {
          message:
            result.code === "saved"
              ? "Cache selesai dihapus."
              : "Akses ditolak.",
        },
        result.code === "saved" ? 200 : 403,
      );
    if (result.code === "cached")
      return reply({
        message:
          result.analysis?.status === "running"
            ? "Analisis masih berjalan. Muat ulang beberapa saat lagi."
            : result.analysis?.status === "failed"
              ? "Analisis sebelumnya gagal. Hapus cache gagal sebelum mencoba ulang."
              : "Hasil analisis sudah tersedia. Muat ulang hasil.",
      });
    if (
      result.code !== "saved" ||
      !result.id ||
      !result.config ||
      !result.essays
    )
      return reply(
        {
          message:
            result.code === "not_configured"
              ? "Penyedia belum dikonfigurasi."
              : result.code === "incomplete"
                ? "Minimal lima esai diperlukan."
                : "Akses ditolak.",
        },
        409,
      );
    let generated = false;
    try {
      const output = await analyzeEssays(
        body.provider,
        result.config.encrypted_key,
        result.config.model,
        result.essays,
      );
      generated = true;
      const saved = await admin.rpc("app_ai_run", {
        ...args,
        p_action: "complete",
        p_data: {
          id: result.id,
          result: output.result,
          tokens: output.tokens as Json,
        },
      });
      if (
        saved.error ||
        !saved.data ||
        z.object({ code: z.literal("saved") }).safeParse(saved.data).success ===
          false
      )
        throw new Error("Result persistence failed");
      return reply({ message: "Analisis selesai dan hasil disimpan." });
    } catch {
      if (!generated)
        await admin.rpc("app_ai_run", {
          ...args,
          p_action: "complete",
          p_data: { id: result.id, error: "provider_or_schema_failure" },
        });
      return reply(
        {
          message:
            "Analisis gagal; jawaban survei tetap tersimpan. Periksa konfigurasi atau hapus cache gagal untuk mencoba ulang.",
        },
        503,
      );
    }
  } catch (error) {
    const e = failure(error);
    return reply({ message: e.message }, e.status);
  }
}
