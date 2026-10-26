import { z } from "zod";
import { newUserSchema, userRoles } from "./validation";
export const userHeaders = ["username", "full_name", "role", "contact_email"];
export const importUserRow = newUserSchema.omit({
  requestId: true,
  password: true,
});
export type ImportUserRow = z.infer<typeof importUserRow>;
export function parseUserRows(records: string[][]) {
  if (
    records.length < 2 ||
    records.length > 101 ||
    JSON.stringify(records[0]) !== JSON.stringify(userHeaders)
  )
    throw Error("Gunakan header template, 1–100 baris.");
  const seen = new Set<string>(),
    rows: ImportUserRow[] = [],
    issues: { row: number; message: string }[] = [];
  records.slice(1).forEach((cells, i) => {
    const raw = {
      username: cells[0],
      fullName: cells[1],
      role: cells[2],
      contactEmail: cells[3],
    };
    const r = importUserRow.safeParse(raw);
    if (!r.success || cells.length !== 4) {
      issues.push({
        row: i + 2,
        message: cells.length !== 4
          ? "Jumlah kolom harus sesuai template (4 kolom)."
          : !r.success ? [...new Set(r.error.issues.map((issue) => {
              const field = String(issue.path[0]);
              return ({ username: "Username wajib teks tanpa spasi awal/akhir atau karakter kontrol (maksimal 100 karakter).", fullName: "Nama wajib diisi (maksimal 200 karakter).", role: "Gunakan kode peran yang tercantum pada panduan.", contactEmail: "Email harus valid atau dikosongkan." } as Record<string, string>)[field] ?? "Periksa isian baris ini.";
            }))].join(" ") : "Periksa isian baris ini.",
      });
      return;
    }
    if (seen.has(r.data.username)) {
      issues.push({ row: i + 2, message: "Username duplikat dalam berkas." });
      return;
    }
    seen.add(r.data.username);
    rows.push(r.data);
  });
  return { rows, issues, count: records.length - 1 };
}
export const userImportInstructions = [
  "Template pengguna versi 1. Template lama tanpa penanda versi tetap diterima jika strukturnya valid.",
  "Contoh baris: 001-02 | Nama Lengkap | student | (email opsional). Isi sheet Data. Maksimal 100 baris; berkas .xlsx maksimal 1 MiB.",
  "Username wajib Text agar nol awal, tanda minus dan angka panjang tidak berubah. Jangan memakai formula atau hyperlink.",
  "Kode peran: " +
    Object.entries(userRoles)
      .map(([k, v]) => `${k} = ${v}`)
      .join("; "),
  "Email kontak boleh kosong; email tidak dianggap terverifikasi dan tidak dikirimi pesan otomatis.",
  "Kata sandi sementara dibuat aplikasi. Pengguna wajib mengganti saat login pertama.",
  "Impor akun bukan penempatan kelas, penugasan atau relasi keluarga. Atur melalui modul terkait.",
  "Batas existing 20 pembuatan akun per 15 menit tetap berlaku. Impor berhenti dan dapat dilanjutkan.",
];
export function createUserDraft(row: ImportUserRow) {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return {
    ...row,
    requestId: crypto.randomUUID(),
    password:
      "Aa1_" +
      Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""),
  };
}
