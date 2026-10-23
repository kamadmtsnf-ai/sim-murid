import { z } from "zod";
import { learningSnapshot, learningFilters } from "./validation";
export const bookFilters = learningFilters.pick({
  query: true,
  subjectId: true,
  level: true,
  category: true,
  page: true,
});
export const bookRow = z
  .object({
    id: z.uuid(),
    title: z.string().min(1),
    author: z.string(),
    publisher: z.string(),
    publication_year: z.number().int().nullable(),
    version: z.string(),
    category: z.string(),
    subject_id: z.uuid().nullable(),
    level: z.number().int().nullable(),
    external_url: z.string().nullable(),
    premium: z.boolean(),
    active: z.boolean(),
    assets: z.array(z.object({ id: z.uuid(), filename: z.string() })),
  })
  .passthrough();
export const booksSnapshot = learningSnapshot.extend({
  module: z.literal("books"),
  revision: z.number().int().nonnegative(),
  rows: z.array(bookRow).max(50),
  extra: z
    .object({
      total: z.number().int().nonnegative(),
      page: z.number().int().min(1),
      subjects: z.array(z.object({ id: z.uuid(), name: z.string() })),
    })
    .passthrough(),
});
export type Book = z.infer<typeof bookRow>;
export type BooksSnapshot = z.infer<typeof booksSnapshot>;
/** Only HTTPS locators may reach an iframe/link; legacy Drive URLs use its preview endpoint. */
export function bookLocator(value: string | undefined) {
  try {
    const u = new URL(value ?? "");
    if (u.protocol !== "https:" || u.username || u.password) return null;
    if (u.hostname === "drive.google.com") {
      const id =
        u.pathname.match(/^\/file\/d\/([\w-]+)/)?.[1] ??
        u.searchParams.get("id");
      if (id && /^[\w-]+$/.test(id))
        return {
          href: u.href,
          preview: `https://drive.google.com/file/d/${id}/preview`,
        };
    }
    return { href: u.href, preview: u.href };
  } catch {
    return null;
  }
}
