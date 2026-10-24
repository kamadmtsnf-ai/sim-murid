import "server-only";
import { z } from "zod";
import type { requestAuth } from "./http";
import { loadAccessContext } from "./authorization";
import { accessPageSchema } from "./access-validation";
import { formatAcademicYear } from "@/lib/academic/period";
const classSchema = z.array(
  z.object({
    id: z.uuid(),
    name: z.string().min(1),
    level: z.number().int(),
    academic_years: z
      .object({ start_year: z.number().int().min(1900).max(2199) })
      .nullable(),
  }),
);
/** Display metadata is read with the caller's RLS-scoped client, never service role. */
export async function loadOwnAccess(
  client: ReturnType<typeof requestAuth>,
  userId: string,
) {
  const context = await loadAccessContext(client);
  if (!context) return null;
  if (context.user_id !== userId) throw Error("Access identity mismatch");
  const base = accessPageSchema.parse(context);
  const ids = [
    ...new Set(
      [
        ...context.grants
          .filter((g) => g.scope === "class")
          .map((g) => g.class_id),
        ...context.assignments.map((a) => a.class_id),
      ].filter((v): v is string => v !== null),
    ),
  ];
  let details_available = true;
  const labels = await Promise.all(
    Array.from({ length: Math.ceil(ids.length / 100) }, async (_, i) => {
      const allowed = new Set(ids.slice(i * 100, (i + 1) * 100));
      try {
        const r = await client
          .from("classes")
          .select("id,name,level,academic_years(start_year)")
          .abortSignal(AbortSignal.timeout(5000))
          .in("id", [...allowed]);
        if (r.error) throw Error("Metadata unavailable");
        return classSchema
          .parse(r.data)
          .filter((c) => allowed.has(c.id))
          .map((c) => ({
            id: c.id,
            label: `Kelas ${c.level} · ${c.name}${c.academic_years ? ` · ${formatAcademicYear(c.academic_years.start_year)}` : ""}`,
          }));
      } catch {
        details_available = false;
        return [];
      }
    }),
  );
  return accessPageSchema.parse({
    ...base,
    class_labels: labels.flat(),
    details_available,
  });
}
