import { z } from "zod";

/** DTO bersama; setiap repository masih wajib menerapkan izin dan scope sendiri. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).default(""),
});

