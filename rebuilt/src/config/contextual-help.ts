/** Public guidance only: never derive support text from page data or URL parameters. */
export type HelpTopic = { title: string; steps: readonly string[] };
const academic =
  "Pastikan tahun ajaran berbentuk 2026/2027 dan semester sesuai. Ganjil Juli–Desember tahun pertama; Genap Januari–Juni tahun kedua.";
const save =
  "Periksa hasil simpan sebelum berpindah. Jika hasil belum pasti, muat ulang dan periksa data; jangan mengirim ulang secara berulang.";
const scope =
  "Jika pilihan tidak tersedia, periksa penugasan atau relasi melalui Hak akses saya di sidebar. Hubungi admin madrasah untuk meninjau izin.";
export function helpFor(href: string): HelpTopic {
  if (href === "/account/classes" || href === "/account/schedules")
    return {
      title: "Kelas dan jadwal",
      steps: [
        academic,
        "Pilih kelas sebelum mengisi siswa, jadwal KBM atau piket. Periksa hari, waktu dan pilihan siswa pada pratinjau.",
        save,
        scope,
      ],
    };
  if (href.startsWith("/account/learning/"))
    return {
      title: "Layanan akademik",
      steps: [
        academic,
        "Periksa kelas, mata pelajaran dan siswa sebelum menyimpan atau menerbitkan. Praktik ditampilkan terpisah dari nilai rapor.",
        "Periksa pratinjau sebelum finalisasi. Rapor terbit adalah arsip; perubahan nilai tidak mengubah arsip secara otomatis.",
        save,
        scope,
      ],
    };
  if (
    href === "/account/operations/savings" ||
    href === "/account/operations/fees"
  )
    return {
      title: "Transaksi siswa",
      steps: [
        "Pastikan siswa atau rekening, tanggal dan nominal benar. Tahun transaksi adalah tahun kalender.",
        "Cocokkan riwayat dan slip setelah menyimpan. Gunakan pembatalan atau reversal yang tersedia sesuai izin; jangan menambahkan transaksi pengganti sebelum status jelas.",
        save,
        scope,
      ],
    };
  if (href.startsWith("/account/operations/"))
    return {
      title: "Kegiatan siswa",
      steps: [
        "Periksa tanggal, kelas dan siswa dalam cakupan penugasan sebelum mencatat kegiatan.",
        "Gunakan pencarian atau filter untuk memeriksa catatan yang sudah ada sebelum menambah catatan baru.",
        save,
        scope,
      ],
    };
  if (href.startsWith("/account/services/"))
    return {
      title: "Layanan dan tindak lanjut",
      steps: [
        "Pilih periode atau filter yang sesuai. Data yang terlihat mengikuti kewenangan akun.",
        "Periksa kelengkapan sebelum memfinalkan survei. Status pekerjaan pengiriman bukan bukti pesan sudah diterima.",
        "Analisis AI perlu ditinjau manusia sebelum digunakan untuk keputusan.",
        save,
        scope,
      ],
    };
  if (href === "/account/directory" || href === "/account/families")
    return {
      title: "Pengguna dan relasi",
      steps: [
        "Cari akun terlebih dahulu untuk menghindari duplikasi. Username adalah teks, termasuk nol di awal dan tanda minus.",
        "Periksa identitas target dan relasi sebelum mengonfirmasi perubahan. Jangan membagikan kredensial akun.",
        save,
        scope,
      ],
    };
  return {
    title: "Akun dan ruang kerja",
    steps: [
      "Gunakan sidebar untuk membuka layanan. Pencarian menu hanya mencari layanan yang tersedia bagi akun Anda.",
      "Periksa identitas akun dan perangkat. Jika menemukan perangkat tidak dikenal, gunakan pengamanan sesi yang tersedia.",
      "Verifikasi email hanya menggunakan kode yang dikirim untuk akun Anda. Jangan bagikan password atau OTP kepada siapa pun.",
      save,
      scope,
    ],
  };
}
export function supportTemplate(
  pageLabel: string,
  reference: string | null,
): string {
  return [
    "Laporan kendala SiM-Murid",
    `Halaman: ${pageLabel}`,
    `Kode laporan: ${reference ?? "tidak tersedia"}`,
    "Waktu kejadian (WIB): [isi]",
    "Langkah sebelum kendala: [isi tanpa data pribadi]",
    "Hasil yang diharapkan: [isi]",
    "Hasil yang terjadi: [isi]",
    "Perangkat/browser: [isi]",
    "Jangan sertakan password, OTP, cookie, kunci API, nama siswa, dokumen, saldo atau tangkapan layar yang belum disunting.",
  ].join("\n");
}
