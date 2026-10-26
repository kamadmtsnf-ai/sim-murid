import type { ComponentProps } from "react";
import { Status } from "@/components/ui/status";
import type { MutationPhase } from "@/lib/forms/mutation-result";
const presentation = {
  idle: { tone: "info" },
  pending: {
    tone: "pending",
    heading: "Sedang diproses",
    hint: "Tunggu hingga hasil ditampilkan. Hindari menekan tombol simpan kembali.",
  },
  success: { tone: "success", heading: "Perubahan tersimpan" },
  error: {
    tone: "error",
    heading: "Perlu perhatian",
    hint: "Ikuti keterangan di atas. Periksa isian sebelum menentukan langkah berikutnya.",
  },
  blocked: {
    tone: "warning",
    heading: "Periksa sebelum melanjutkan",
    hint: "Periksa sesi, hak akses, dan data terbaru sebelum melanjutkan.",
  },
  uncertain: {
    tone: "warning",
    heading: "Hasil belum terkonfirmasi",
    hint: "Jangan kirim ulang sekarang. Pertahankan halaman ini dan periksa data terbaru; memuat ulang dapat menghilangkan isian yang belum disimpan.",
  },
} as const;
/** Only an explicit caller phase determines outcome; never infer success from message text. */
export function MutationFeedback({
  phase,
  ...props
}: Omit<ComponentProps<typeof Status>, "tone"> & { phase: MutationPhase }) {
  return <Status {...presentation[phase]} {...props} tone={presentation[phase].tone} />;
}
