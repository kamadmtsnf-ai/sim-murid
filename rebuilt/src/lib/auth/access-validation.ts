import { z } from "zod";
// Shared shape only; authorization remains in the existing user-scoped RPCs.
export const accessSchema = z.object({
  user_id: z.uuid(),
  role: z.string(),
  assignments: z.array(
    z.object({ code: z.string(), class_id: z.uuid().nullable() }),
  ),
  grants: z.array(
    z.object({
      capability: z.string(),
      scope: z.enum(["all", "own", "class"]),
      class_id: z.uuid().nullable(),
    }),
  ),
});
export const accessPageSchema = accessSchema
  .extend({
    class_labels: z
      .array(z.object({ id: z.uuid(), label: z.string().min(1) }))
      .default([]),
    details_available: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (!value.role.trim())
      ctx.addIssue({ code: "custom", message: "Missing role", path: ["role"] });
    for (const [i, g] of value.grants.entries())
      if (
        !g.capability.trim() ||
        (g.scope === "class" ? !g.class_id : g.class_id !== null)
      )
        ctx.addIssue({
          code: "custom",
          message: "Invalid permission scope",
          path: ["grants", i],
        });
  });
export type AccessPageData = z.infer<typeof accessPageSchema>;
