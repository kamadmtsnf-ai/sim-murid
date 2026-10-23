import { z } from "zod";
import { familyCommand, familySnapshot } from "./validation.ts";
export type FamilySnapshot = z.infer<typeof familySnapshot>;
export type FamilyCommand = z.infer<typeof familyCommand>;
export const familyAcknowledgement = z
  .object({
    code: z.enum([
      "saved",
      "denied",
      "stale",
      "invalid",
      "duplicate",
      "not_found",
      "request_conflict",
    ]),
    id: z.uuid().nullable().optional(),
  })
  .refine((v) => v.code !== "saved" || typeof v.id === "string");
export function confirmFamily(
  data: FamilySnapshot,
  command: FamilyCommand,
  target?: string | null,
) {
  if (command.type === "guardian") {
    if (target !== command.studentId)
      throw Error("Guardian target not confirmed");
    const exists = data.guardians.some(
      (g) =>
        g.student_id === command.studentId &&
        g.parent_id === command.parentId &&
        g.relationship === command.relationship,
    );
    if (exists === command.remove) throw Error("Relationship not confirmed");
  } else {
    if (target && command.id && target !== command.id)
      throw Error("Family target not confirmed");
    const family = data.families.find((f) => f.id === (command.id ?? target));
    if (
      !family ||
      family.name !== command.name ||
      family.members.length !== command.studentIds.length ||
      family.members.some((m) => !command.studentIds.includes(m.student_id))
    )
      throw Error("Family not confirmed");
  }
}
export function familySelection(
  data: FamilySnapshot,
  id: string | null,
  selected: string[],
) {
  const current = data.families.find((f) => f.id === id);
  const retained =
    current?.members
      .filter((m) => selected.includes(m.student_id))
      .map((m) => m.student_id) ?? [];
  return [...retained, ...selected.filter((x) => !retained.includes(x))];
}
