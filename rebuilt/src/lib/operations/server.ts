import {savingsSnapshot} from './savings';
import {committeeSnapshot} from './committee';
import {mentoringSnapshot} from './mentoring';
import "server-only";
import { attendanceSnapshot } from "./attendance";
import { dutySnapshot } from "./duty";
import { createAuthAdmin } from "@/lib/auth/admin";
import { AccessDenied } from "@/lib/auth/authorization";
import {
  filtersSchema,
  operationsSnapshot,
  type OperationModule,
  type OperationsSnapshot,
} from "./validation";
import type { Json } from "@/lib/supabase/cloud.types";
export async function operationsData(
  actor: string,
  session: string,
  module: OperationModule,
  filters: unknown = {},
): Promise<OperationsSnapshot> {
  const parsed = filtersSchema.parse(filters);
  const r = await createAuthAdmin().rpc("app_operations_read", {
    p_actor: actor,
    p_session: session,
    p_module: module,
    p_filters: parsed as Json,
  });
  if (r.error) throw new Error("Operations unavailable");
  if (!r.data) throw new AccessDenied();
  if (module === "duty") {
    const result = dutySnapshot.safeParse(r.data);
    if (!result.success) throw new Error("Duty data unavailable");
    return result.data;
  }
  if (module === "attendance") {
    const result = attendanceSnapshot.safeParse(r.data);
    if (!result.success) throw new Error("Attendance data unavailable");
    return result.data;
  }
  if(module==="mentoring"){const result=mentoringSnapshot.safeParse(r.data);if(!result.success)throw new Error("Mentoring data unavailable");return result.data;}
  if(module==="fees"){const result=committeeSnapshot.safeParse(r.data);if(!result.success)throw new Error("Committee data unavailable");return result.data;}
  if(module==="savings"){const result=savingsSnapshot.safeParse(r.data);if(!result.success)throw new Error("Savings data unavailable");return result.data;}
  return operationsSnapshot.parse(r.data);
}
export const operationMessages: Record<string, string> = {
  overlap: "Rentang tarif bertumpang tindih.",
  saved: "Perubahan berhasil disimpan.",
  denied: "Akses ditolak. Periksa sesi, tugas, dan konfirmasi piket hari ini.",
  invalid: "Periksa kelengkapan, tanggal, nominal, dan referensi data.",
  duplicate:
    "Data sudah ada. Gunakan koreksi untuk transaksi yang sudah tercatat.",
  not_found: "Data tidak ditemukan atau sudah dibatalkan.",
  stale: "Data berubah. Muat ulang sebelum menyimpan.",
  request_conflict: "ID permintaan telah digunakan untuk perubahan lain.",
  insufficient:
    "Saldo tidak mencukupi setelah memperhitungkan transaksi yang dikoreksi.",
};
