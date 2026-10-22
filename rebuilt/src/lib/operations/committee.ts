import { z } from "zod";
import { filtersSchema, operationsSnapshot } from "./validation";
const id = z.uuid(),
  integer = z.number().int().nonnegative().safe(),
  money = integer.max(1e12),
  month = z.iso
    .date()
    .refine((v) => v.endsWith("-01") && v >= "2000-01-01" && v <= "2100-12-01");
export const committeeFilters = z.preprocess(
  (input) =>
    typeof input === "object" && input !== null
      ? Object.fromEntries(
          Object.entries(input).filter(([, v]) => v !== "" && v !== undefined),
        )
      : input,
  z
    .object({
      year: filtersSchema.shape.year,
      start: filtersSchema.shape.start,
      end: filtersSchema.shape.end,
      classId: filtersSchema.shape.classId,
      studentId: filtersSchema.shape.studentId,
      page: filtersSchema.shape.page,
      export: filtersSchema.shape.export,
    })
    .strict()
    .refine((f) => {
      const year =
        f.year ??
        Number(
          new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            timeZone: "Asia/Jakarta",
          }).format(new Date()),
        );
      const start = f.start ?? `${year}-01-01`,
        end = f.end ?? `${year}-12-31`;
      return (
        start <= end && (Date.parse(end) - Date.parse(start)) / 86400000 <= 366
      );
    }, "Pilih rentang tanggal maksimal 366 hari."),
);
export const paymentContextQuery = z
  .object({ year: z.coerce.number().int().min(2000).max(2100), studentId: id })
  .strict();
export const committeeSnapshot = operationsSnapshot
  .extend({
    module: z.literal("fees"),
    revision: integer,
    total: integer,
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    summary: z.record(z.string(), integer),
    rows: z.array(
      z.object({
        id,
        student_id: id,
        name: z.string(),
        date: z.iso.date(),
        notes: z.string(),
        amount: integer,
        can_edit: z.boolean(),
        allocations: z
          .array(z.object({ month, amount: money.min(1) }))
          .min(1)
          .max(12),
      }),
    ),
    extra: z.object({
      months: z.array(
        z.object({
          student_id: id,
          name: z.string(),
          month,
          status: z.enum(["paid", "waived", "unpaid"]),
          amount: money,
          waiverSources: integer,
          tariff: money.nullable(),
          outstanding: money.nullable(),
        }),
      ),
      trend: z.array(
        z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), value: integer }),
      ),
    }),
  })
  .superRefine((s, ctx) => {
    if (
      s.total < s.rows.length ||
      new Set(s.rows.map((r) => r.id)).size !== s.rows.length ||
      new Set(s.people.map((p) => p.id)).size !== s.people.length ||
      new Set(s.extra.months.map((m) => m.student_id + ":" + m.month)).size !==
        s.extra.months.length ||
      s.rows.some(
        (r) =>
          new Set(r.allocations.map((a) => a.month)).size !==
            r.allocations.length ||
          r.amount !== r.allocations.reduce((n, a) => n + a.amount, 0),
      ) ||
      s.extra.months.some((m) =>
        m.status === "paid"
          ? m.amount <= 0 || m.outstanding !== 0
          : m.amount !== 0 ||
            (m.status === "waived"
              ? m.waiverSources < 1 || m.outstanding !== 0
              : m.outstanding !== m.tariff),
      )
    )
      ctx.addIssue({ code: "custom", message: "Data iuran tidak konsisten." });
  });
export type CommitteeSnapshot = z.infer<typeof committeeSnapshot>;
export function paymentContext(
  input: unknown,
  studentId: string,
  year: number,
) {
  const s = committeeSnapshot.parse(input);
  if (
    s.extra.months.length !== 12 ||
    s.extra.months.some(
      (m) => m.student_id !== studentId || !m.month.startsWith(year + "-"),
    )
  )
    throw Error("Status bulan belum lengkap.");
  return s;
}
export function monthLocked(
  context: CommitteeSnapshot,
  month: string,
  studentId: string,
  edit: CommitteeSnapshot["rows"][number] | null,
) {
  const m = context.extra.months.find(
    (m) => m.student_id === studentId && m.month === month,
  );
  return (
    !m ||
    (m.status !== "unpaid" &&
      !(
        edit?.student_id === studentId &&
        edit.allocations.some((a) => a.month === month)
      ))
  );
}
export const committeeMessages: Record<string, string> = {
  invalid:
    "Periksa siswa, tanggal pembayaran, bulan alokasi, tarif, nominal, dan alasan koreksi.",
  duplicate:
    "Bulan sudah dibayar atau mendapat pembebasan saudara. Muat ulang status bulan sebelum mencoba lagi.",
  denied:
    "Akses ditolak. Pengelolaan iuran memerlukan hak admin atau bendahara komite.",
};
export const rupiah = (value: number) =>
  "Rp" + new Intl.NumberFormat("id-ID").format(value);
