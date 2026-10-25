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
        message: "Periksa username teks, nama, kode peran dan email.",
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
