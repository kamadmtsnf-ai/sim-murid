import { z } from "zod";
import { settingsCommand, type SettingsSnapshot } from "./validation.ts";
export const settingsAcknowledgement = z
  .object({
    code: z.enum([
      "saved",
      "stale",
      "duplicate",
      "not_found",
      "invalid",
      "denied",
      "request_conflict",
      "profile_required",
    ]),
    revision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .optional(),
    added: z.number().int().nonnegative().optional(),
    skipped: z.number().int().nonnegative().optional(),
  })
  .refine((v) => v.code !== "saved" || v.revision !== undefined);
export function confirmSettings(
  data: SettingsSnapshot,
  command: unknown,
  revision: number,
) {
  if (data.revision !== revision)
    throw Error("Settings revision not confirmed");
  const logo = z
    .object({
      type: z.literal("logo"),
      slot: z.enum(["school", "cooperative"]),
      path: z.string(),
    })
    .safeParse(command);
  if (logo.success) {
    if (data.school?.asset_data[logo.data.slot] !== logo.data.path)
      throw Error("Logo not confirmed");
    return;
  }
  const c = settingsCommand.parse(command);
  if (c.type === "profile") {
    if (
      !data.school ||
      data.school.name !== c.profile.name ||
      Object.entries(c.profile.identity_data).some(
        ([k, v]) =>
          data.school!.identity_data[
            k as keyof typeof c.profile.identity_data
          ] !== v,
      ) ||
      Object.entries(c.profile.address_data).some(
        ([k, v]) =>
          data.school!.address_data[
            k as keyof typeof c.profile.address_data
          ] !== v,
      )
    )
      throw Error("Profile not confirmed");
  } else if (c.type === "logo_clear") {
    if (!data.school || data.school.asset_data[c.slot] !== undefined)
      throw Error("Logo clear not confirmed");
  } else if (c.type === "holiday_delete") {
    if (data.holidays.some((h) => h.id === c.id))
      throw Error("Holiday deletion not confirmed");
  } else if (c.type === "holiday") {
    if (c.id) {
      if (
        !data.holidays.some(
          (h) =>
            h.id === c.id &&
            h.holiday_date === c.start &&
            h.description === c.description,
        )
      )
        throw Error("Holiday edit not confirmed");
    } else {
      const dates = new Set(data.holidays.map((h) => h.holiday_date));
      for (
        let day = Date.parse(c.start);
        day <= Date.parse(c.end);
        day += 86400000
      )
        if (!dates.has(new Date(day).toISOString().slice(0, 10)))
          throw Error("Holiday range not confirmed");
    }
  } else {
    const rows =
      (c.type === "deactivate" ? c.catalog : c.type) === "subject"
        ? data.subjects
        : data.memorization;
    if (c.type === "deactivate") {
      if (!rows.some((r) => r.id === c.id && !r.active))
        throw Error("Deactivation not confirmed");
    } else if (
      !rows.some(
        (r) =>
          (c.id === null || r.id === c.id) &&
          r.name === c.name &&
          r.active === c.active,
      )
    )
      throw Error("Catalog not confirmed");
  }
}
