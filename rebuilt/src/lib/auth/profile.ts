import type { z } from "zod";
import { profileSchema } from "./recovery-validation.ts";
export type PersonalProfile = z.infer<typeof profileSchema>;
export const profileFields = [
  "full_name",
  "phone",
  "contact_email",
  "bio",
] as const;
export type ProfileField = (typeof profileFields)[number];
export function profileDraft(profile: PersonalProfile) {
  return {
    full_name: profile.full_name,
    phone: profile.phone,
    contact_email: profile.contact_email,
    bio: profile.bio,
  };
}
export function sameProfileContent(a: PersonalProfile, b: PersonalProfile) {
  return a.username === b.username && profileFields.every((k) => a[k] === b[k]);
}

/** Keep legacy snapshots readable; reject control bytes on new writes before PostgreSQL. */
export const profileWriteSchema = profileSchema.extend({
  full_name: profileSchema.shape.full_name.refine(
    (s) => !/[\u0000-\u001f\u007f]/.test(s),
    "Nama tidak boleh memuat karakter kontrol.",
  ),
  phone: profileSchema.shape.phone.refine(
    (s) => !/[\u0000-\u001f\u007f]/.test(s),
    "Nomor HP tidak boleh memuat karakter kontrol.",
  ),
  bio: profileSchema.shape.bio.refine(
    (s) => !s.includes("\u0000"),
    "Bio memuat karakter yang tidak valid.",
  ),
});
