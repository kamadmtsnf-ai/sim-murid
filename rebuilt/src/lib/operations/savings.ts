import { z } from "zod";
import { filtersSchema, operationsSnapshot } from "./validation";
const id = z.uuid(),
  nonnegative = z.number().int().nonnegative().safe(),
  signed = z.number().int().safe();
export const savingsAmount = z
  .number()
  .int()
  .safe()
  .min(1000)
  .max(1e12)
  .multipleOf(1000);
export const savingsFilters = z.preprocess(
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
const bracket = z.object({
  id,
  minimum: nonnegative,
  maximum: nonnegative.nullable(),
  percent: z.number().min(0).max(100),
  active: z.boolean(),
});
const account = z.object({
  id,
  owner_id: id,
  name: z.string(),
  category: z.enum(["S", "G", "N"]),
  balance: nonnegative,
});
export const savingsSnapshot = operationsSnapshot
  .extend({
    module: z.literal("savings"),
    revision: nonnegative,
    total: nonnegative,
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    summary: z.object({
      balance: nonnegative,
      periodNet: signed,
      deposits: nonnegative,
      withdrawals: nonnegative,
    }),
    rows: z.array(
      z.object({
        id,
        account_id: id,
        student_id: id,
        name: z.string(),
        date: z.iso.date(),
        kind: z.enum(["deposit", "withdrawal", "reversal"]),
        amount: savingsAmount,
        delta: signed,
        balance_before: nonnegative,
        balance: nonnegative,
        notes: z.string(),
        reverses_id: id.nullable(),
        reversed: z.boolean(),
        can_edit: z.boolean(),
        slip_id: id.optional(),
        fee: nonnegative.optional(),
        cash_received: nonnegative.optional(),
      }),
    ),
    extra: z.object({
      accounts: z.array(account),
      catalogAccounts: z.array(account).optional(),
      brackets: z.array(bracket).optional(),
      trend: z.array(
        z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), value: signed }),
      ),
    }),
  })
  .superRefine((s, ctx) => {
    if (
      s.total < s.rows.length ||
      new Set(s.rows.map((r) => r.id)).size !== s.rows.length ||
      new Set(s.extra.accounts.map((a) => a.owner_id)).size !==
        s.extra.accounts.length ||
      s.rows.some(
        (r) =>
          r.balance_before + r.delta !== r.balance ||
          Math.abs(r.delta) !== r.amount ||
          (r.kind === "deposit" && r.delta !== r.amount) ||
          (r.kind === "withdrawal" && r.delta !== -r.amount) ||
          (r.kind === "reversal"
            ? r.reverses_id === null || r.can_edit
            : r.reverses_id !== null) ||
          (r.reversed && r.can_edit) ||
          (r.slip_id &&
            (r.kind !== "withdrawal" ||
              r.fee === undefined ||
              r.cash_received === undefined ||
              r.fee + r.cash_received !== r.amount)),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Data tabungan tidak konsisten.",
      });
  });
export type SavingsSnapshot = z.infer<typeof savingsSnapshot>;
export const feeQuoteSchema = z.object({
  applied: z.boolean(),
  bracket: z.record(z.string(), z.unknown()).nullable(),
  raw: z.number().nonnegative(),
  fee: nonnegative.multipleOf(1000),
  cash: nonnegative,
  policy: z.literal("FEE-1.0"),
  matched: z.boolean(),
});
export function parseFeeQuote(
  input: unknown,
  amount: number,
  applied: boolean,
) {
  const quote = feeQuoteSchema.parse(input);
  if (
    quote.applied !== applied ||
    quote.fee + quote.cash !== amount ||
    (!applied && quote.fee !== 0)
  )
    throw Error("Invalid quote");
  return quote;
}
export const slipDeliverySchema = z.object({
  reversed: z.boolean(),
  deliveries: z.array(
    z.object({
      email: z.email(),
      status: z.enum(["queued", "sending", "sent", "failed", "ambiguous"]),
      attempts: nonnegative,
    }),
  ),
});
export const savingsMessages: Record<string, string> = {
  invalid:
    "Periksa rekening, tanggal, nominal kelipatan Rp1.000, tarif, dan alasan perubahan.",
  duplicate:
    "Rekening atau setoran pada tanggal tersebut sudah ada. Periksa riwayat sebelum membuat transaksi baru.",
  denied:
    "Akses ditolak. Pengelolaan tabungan memerlukan hak admin atau Pengelola Tabungan.",
  insufficient:
    "Saldo tidak mencukupi setelah memperhitungkan transaksi yang dikoreksi.",
  overlap:
    "Rentang tarif aktif bertumpang tindih. Batas minimum dan maksimum termasuk dalam rentang.",
};
export const rupiah = (value: number) =>
  "Rp" + new Intl.NumberFormat("id-ID").format(value);
