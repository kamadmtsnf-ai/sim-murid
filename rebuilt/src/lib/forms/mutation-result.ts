export type MutationPhase =
  | "idle"
  | "pending"
  | "success"
  | "error"
  | "blocked"
  | "uncertain";
const correctable = new Set([
  "invalid",
  "duplicate",
  "overlap",
  "invalid_membership",
  "class_in_use",
  "insufficient",
  "incomplete",
  "rate_limited",
  "archived",
]);
/** Only an explicit business rejection allows correction and another write. */
export function rejectionPhase(status: number, code: unknown): MutationPhase {
  if (!Number.isInteger(status) || status >= 500 || status < 400 || status === 408) return "uncertain";
  if (status === 401 || status === 403) return "blocked";
  return typeof code === "string" && correctable.has(code)
    ? "error"
    : "blocked";
}
export function savedAcknowledgement(
  body: Record<string, unknown>,
  snapshot: unknown,
  previousRevision: number,
) {
  const result = body.result;
  if (
    body.code !== "saved" ||
    (result !== undefined &&
      (typeof result !== "object" ||
        result === null ||
        !("code" in result) ||
        result.code !== "saved"))
  )
    return false;
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    !("revision" in snapshot)
  )
    return false;
  return (
    Number.isSafeInteger(previousRevision) &&
    previousRevision >= 0 &&
    Number.isSafeInteger(snapshot.revision) &&
    Number(snapshot.revision) > previousRevision
  );
}

/** Next steps come from protocol evidence, never from matching translated message text. */
export function mutationGuidance(phase: MutationPhase, code?: unknown, status?: number): string | undefined {
  if (phase === 'pending') return 'Tunggu hasilnya. Jangan kirim permintaan yang sama lagi atau meninggalkan formulir saat proses berjalan.';
  if (phase === 'success') return 'Perubahan sudah dikonfirmasi. Periksa hasil terbaru yang ditampilkan sebelum melanjutkan pekerjaan.';
  if (phase === 'uncertain') return 'Pertahankan halaman ini dan jangan kirim ulang. Gunakan pemeriksaan data/status yang tersedia untuk memastikan hasil; memuat ulang dapat menghilangkan isian yang belum disimpan.';
  if (phase === 'blocked') {
    if (status === 401) return 'Sesi perlu diperiksa. Masuk kembali melalui alur akun yang tersedia; jangan mengulang penyimpanan sebelum sesi dan data terbaru dipastikan.';
    if (status === 403) return 'Periksa peran, tugas tambahan, dan cakupan data akun. Hubungi administrator bila akses seharusnya masih berlaku.';
    if (code === 'stale') return 'Data sudah berubah. Periksa versi terbaru sebelum melanjutkan; jangan menimpa perubahan pengguna lain.';
    if (code === 'request_conflict') return 'Permintaan bertentangan dengan proses sebelumnya. Periksa hasil sebelumnya sebelum membuat permintaan baru.';
    if (code === 'not_found') return 'Data atau referensi tidak lagi tersedia. Muat ulang data dan pilih referensi yang masih dapat diakses.';
    return 'Periksa sesi, izin, dan data terbaru sebelum melanjutkan. Jika masih terblokir, laporkan kendala kepada administrator.';
  }
  if (phase === 'error') {
    if (code === 'duplicate') return 'Periksa apakah data yang sama sudah tercatat. Ubah isian hanya bila memang perlu membuat data berbeda.';
    if (code === 'overlap') return 'Periksa rentang waktu atau penempatan yang bertabrakan, lalu sesuaikan isian sebelum menyimpan kembali.';
    if (code === 'insufficient') return 'Periksa saldo atau jumlah yang tersedia. Sesuaikan nominal sesuai data terbaru sebelum mencoba lagi.';
    if (code === 'rate_limited' || status === 429) return 'Batas percobaan tercapai. Tunggu sesuai keterangan layanan sebelum mencoba kembali; jangan menekan tombol berulang.';
    if (code === 'archived') return 'Data sudah diarsipkan. Pilih periode/data yang masih dapat diubah sesuai kewenangan; jangan menimpa arsip.';
    if (code === 'invalid_membership') return 'Periksa keanggotaan siswa, kelas, dan periode yang dipilih sebelum menyimpan kembali.';
    if (code === 'class_in_use') return 'Kelas masih dipakai data lain. Periksa keterkaitannya sebelum mengubah atau menghapus kelas.';
    if (code === 'incomplete') return 'Lengkapi bagian yang masih kurang sesuai keterangan di atas, kemudian periksa kembali sebelum menyimpan.';
    return 'Periksa dan koreksi isian yang ditandai, lalu simpan kembali setelah isian sesuai.';
  }
  return undefined;
}
