import "server-only";
import { createAuthAdmin } from "@/lib/auth/admin";
import { directoryDetailSchema } from "./directory.ts";
/** One validated read for page and API; null never distinguishes missing from denied records. */
export async function loadDirectoryDetail(
  actor: string,
  session: string,
  target: string,
) {
  try {
    const result = await createAuthAdmin().rpc("app_directory_detail", {
      p_actor: actor,
      p_session: session,
      p_target: target,
    });
    if (result.error) throw new Error("Directory detail unavailable");
    if (result.data === null) return null;
    const parsed = directoryDetailSchema.safeParse(result.data);
    if (
      !parsed.success ||
      parsed.data.id.toLowerCase() !== target.toLowerCase()
    )
      throw new Error("Directory detail unavailable");
    // Keep the established API payload (including fields not displayed by this view).
    return { person: parsed.data, payload: result.data };
  } catch {
    throw new Error("Directory detail unavailable");
  }
}
