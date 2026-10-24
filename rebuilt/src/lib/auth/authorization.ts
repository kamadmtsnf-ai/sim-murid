import "server-only";
import type { requestAuth } from "@/lib/auth/http";
import { accessSchema } from "./access-validation";
export { accessSchema } from "./access-validation";
/** A user-scoped request client is required. Never call with a service-role client. */
export async function loadAccessContext(
  client: ReturnType<typeof requestAuth>,
) {
  const { data, error } = await client.rpc("app_access_context");
  if (error) throw new Error("Authorization service unavailable");
  return data === null ? null : accessSchema.parse(data);
}
export class AccessDenied extends Error {}
/** Scope MUST be resolved from the database record, never a claimed owner in a DTO.
 * Domain mutations still require their own RLS, validation, gates and transactional audit.
 */
export async function requireCapability(
  client: ReturnType<typeof requestAuth>,
  capability: string,
  record: { ownerId?: string; classId?: string } = {},
) {
  const { data, error } = await client.rpc("app_access_check", {
    p_capability: capability,
    ...(record.ownerId ? { p_owner: record.ownerId } : {}),
    ...(record.classId ? { p_class: record.classId } : {}),
  });
  if (error) throw new Error("Authorization service unavailable");
  if (data !== true) throw new AccessDenied("Akses tidak diizinkan.");
}
