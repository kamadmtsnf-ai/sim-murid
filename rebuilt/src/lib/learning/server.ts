import "server-only";
import { createAuthAdmin } from "@/lib/auth/admin";
import { AccessDenied } from "@/lib/auth/authorization";
import {
  learningFilters,
  learningSnapshot,
  type LearningModule,
} from "./validation";
import type { Json } from "@/lib/supabase/cloud.types";
export async function learningData(
  actor: string,
  session: string,
  domain: LearningModule,
  filters: unknown = {},
) {
  const parsed = learningFilters.parse(filters),
    r = await createAuthAdmin().rpc("app_learning_read", {
      p_actor: actor,
      p_session: session,
      p_module: domain,
      p_filters: parsed as Json,
    });
  if (r.error) throw new Error("Unavailable");
  if (!r.data) throw new AccessDenied();
  return learningSnapshot.parse(r.data);
}
