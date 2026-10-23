import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createAuthAdmin } from "@/lib/auth/admin";
import { privateJson, requestAuth, verifiedPrincipal } from "@/lib/auth/http";
import { AccessDenied, requireCapability } from "@/lib/auth/authorization";
import { settingsSnapshot } from "./validation";
export async function settingsCaller(
  request: NextRequest,
  jar: ReturnType<typeof privateJson>,
) {
  const client = requestAuth(request, jar),
    caller = await verifiedPrincipal(client);
  if (!caller) return null;
  if (!caller.principal.is_admin) throw new AccessDenied();
  await requireCapability(client, "settings.manage");
  return caller;
}
export async function loadSettings(actor: string, session: string) {
  const r = await createAuthAdmin().rpc("app_settings_read", {
    p_actor: actor,
    p_session: session,
  });
  if (r.error) throw new Error("Settings unavailable");
  if (!r.data) throw new AccessDenied();
  return settingsSnapshot.parse(r.data);
}
export async function collectUnusedLogos(actor: string, session: string) {
  const admin = createAuthAdmin(),
    args = { p_actor: actor, p_session: session };
  try {
    const r = await admin.rpc("app_settings_asset_gc", args);
    if (r.error) return;
    for (const path of z
      .array(z.string().regex(/^[a-f0-9-]{36}\.png$/))
      .parse(r.data)) {
      const removed = await admin.storage.from("school-assets").remove([path]);
      if (!removed.error)
        await admin.rpc("app_settings_asset_gc", { ...args, p_done: path });
    }
  } catch {
    /* Metadata is already committed. The durable queue retries on the next settings write. */
  }
}
export async function readBounded(request: NextRequest, limit: number) {
  if (Number(request.headers.get("content-length") ?? 0) > limit)
    throw new RangeError("Body too large");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > limit) {
        await reader.cancel();
        throw new RangeError("Body too large");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export { settingsAcknowledgement as writeResult } from "./confirmation";
export const resultMessage: Record<string, string> = {
  stale: "Pengaturan berubah. Muat ulang sebelum menyimpan.",
  duplicate: "Nama atau tanggal sudah digunakan.",
  not_found: "Data tidak ditemukan.",
  invalid: "Periksa isian formulir.",
  denied: "Selesaikan keamanan akun atau periksa hak akses.",
  request_conflict: "ID permintaan sudah digunakan.",
  profile_required: "Simpan profil sekolah terlebih dahulu.",
};
