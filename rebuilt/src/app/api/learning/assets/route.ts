import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { sameOrigin, privateJson } from "@/lib/auth/http";
import { educationContext, jsonBody, failure } from "@/lib/education/server";
import { createAuthAdmin } from "@/lib/auth/admin";
import { assetPrepare, assetAction } from "@/lib/learning/validation";
import { inspectDocument } from "@/lib/documents/inspect";
import type { Json } from "@/lib/supabase/cloud.types";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return privateJson({ message: "Permintaan ditolak." }, 403);
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  try {
    if (!caller.principal.is_admin)
      return reply({ message: "Admin diperlukan." }, 403);
    const body = await jsonBody(request),
      admin = createAuthAdmin(),
      args = { p_actor: caller.principal.id, p_session: caller.sessionId };
    const cleanup = async () => {
      const pending = await admin.rpc("app_asset_cleanup", args);
      if (pending.error) return;
      const list = z
        .array(z.object({ id: z.uuid(), path: z.string() }))
        .safeParse(pending.data);
      if (!list.success) return;
      for (const asset of list.data) {
        const removed = await admin.storage
          .from("learning-private")
          .remove([asset.path]);
        if (!removed.error)
          await admin.rpc("app_asset_write", {
            ...args,
            p_action: "purge",
            p_data: { id: asset.id },
          });
      }
    };
    await cleanup();
    const prepare = assetPrepare.safeParse(body);
    if (prepare.success) {
      const input = prepare.data,
        id = randomUUID();
      const r = await admin.rpc("app_asset_write", {
        ...args,
        p_action: "prepare",
        p_data: { ...input, id } as Json,
      });
      if (r.error) throw new Error("Unavailable");
      if ((r.data as { code: string }).code !== "saved")
        return reply({ message: "Referensi berkas tidak valid." }, 409);
      const path = input.kind + "/" + input.targetId + "/" + id;
      const upload = await admin.storage
        .from("learning-private")
        .createSignedUploadUrl(path, { upsert: false });
      if (upload.error || !upload.data) throw new Error("Storage unavailable");
      return reply({ id, upload: { path, token: upload.data.token } });
    }
    const cmd = assetAction.parse(body),
      r = await admin.rpc("app_asset_admin", { ...args, p_id: cmd.id });
    if (r.error) throw new Error("Unavailable");
    if (!r.data) return reply({ message: "Akses ditolak." }, 403);
    const meta = z
      .object({
        id: z.uuid(),
        path: z.string(),
        mime: z.string(),
        size: z.number(),
        state: z.string(),
      })
      .parse(r.data);
    if (cmd.action === "finalize") {
      const downloaded = await admin.storage
        .from("learning-private")
        .download(meta.path);
      if (downloaded.error || !downloaded.data)
        return reply({ message: "Unggahan belum selesai." }, 409);
      let hash: string;
      try {
        hash = await inspectDocument(
          new Uint8Array(await downloaded.data.arrayBuffer()),
          meta.mime,
          meta.size,
        );
      } catch {
        await admin.rpc("app_asset_write", {
          ...args,
          p_action: "failed",
          p_data: { id: cmd.id },
        });
        await admin.storage.from("learning-private").remove([meta.path]);
        return reply({ message: "Isi berkas tidak sesuai atau rusak." }, 400);
      }
      const saved = await admin.rpc("app_asset_write", {
        ...args,
        p_action: "ready",
        p_data: { id: cmd.id, sha256: hash },
      });
      if (saved.error) throw new Error("Finalize unavailable");
      if ((saved.data as { code: string }).code !== "saved")
        return reply(
          { message: "Unggahan kedaluwarsa atau telah diganti; muat ulang." },
          409,
        );
    } else {
      const removed = await admin.rpc("app_asset_write", {
        ...args,
        p_action: "delete",
        p_data: { id: cmd.id },
      });
      if (removed.error) throw new Error("Unavailable");
      if (
        !z.object({ code: z.literal("saved") }).safeParse(removed.data).success
      )
        throw Error("Delete not confirmed");
      await admin.storage.from("learning-private").remove([meta.path]);
    }
    await cleanup();
    return reply({
      message: "Berkas berhasil diperbarui.",
      code: "saved",
      id: cmd.id,
      action: cmd.action,
    });
  } catch (error) {
    const e = failure(error);
    return reply({ message: e.message }, e.status);
  }
}
