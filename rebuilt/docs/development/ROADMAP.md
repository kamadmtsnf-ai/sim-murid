# Rencana pengembangan profesional SiM-Murid — 12 tahap

Versi 1.0 • 24 Oktober 2026 • Zona bisnis Asia/Jakarta.

## Tujuan dan otoritas

Rencana ini menyimpan persetujuan pengguna atas saran pengembangan fitur, UI/UX, keandalan dan operasional setelah audit Hak akses saya (PR #44). Ini **siklus pengembangan baru**, berbeda dari Tahap 1–30 pembangunan ulang sebelumnya. Gunakan kode `P01`–`P12` untuk menghindari kekeliruan nomor.

Repositori: `kamadmtsnf-ai/sim-murid`, aplikasi `rebuilt/`. Identitas produk SiM-Murid/MTs Nurul Falah dipertahankan. Stack tetap Next.js App Router, TypeScript strict, Tailwind, shadcn/Radix, Lucide, Zod, Supabase dan Vercel.

Instruksi terbaru pengguna → keputusan bisnis disepakati → spesifikasi existing → rencana ini. Rencana bukan bukti fitur sudah selesai dan bukan izin mengubah kebijakan bisnis yang belum diputus. D10 tentang koreksi KKM/arsip tetap terbuka. Persetujuan arah pengembangan tidak menentukan tarif, kewenangan persetujuan baru, atau penggunaan layanan berbayar.

## Cara melanjutkan pada sesi berikutnya

1. Baca `AGENTS.md`, dokumen ini, [hasil P01](STAGE-01-AUDIT.md), dan [snapshot sumber](stage-01-baseline.json).
2. Periksa commit `main` terkini dan perubahan sejak baseline. Jangan menganggap snapshot lama sebagai kondisi produksi terbaru.
3. Baca keputusan pada `../decisions/approved-business-policy.md`, spesifikasi modul dan audit terdahulu sebelum mengubah perilaku.
4. Pilih pekerjaan tahap aktif dari backlog P01. Tandai sedang dikerjakan; jangan menjalankan seluruh tahap sekaligus tanpa instruksi.
5. Catat implementasi, file, alasan, hasil tes aktual, batas bukti, PR dan kendala pada laporan tahap. Perbarui status tabel ini.
6. Tahap hanya selesai bila kriteria penerimaan dipenuhi. Keberhasilan merge atau halaman tampil tidak menggantikan pembuktian alur bisnis.

## Tahap, hasil dan gerbang penerimaan

| ID | Tahap | Ruang lingkup dan hasil wajib | Gerbang selesai | Status |
|---|---|---|---|---|
| P01 | Audit kondisi awal dan rencana kerja | Inventaris fitur existing; dependency UI/API/data; skenario peran; gap dan prioritas; ukuran keberhasilan; batas perubahan | Bukti sumber, backlog berurutan, kriteria penerimaan, risiko dan batas verifikasi terdokumentasi | Selesai; lihat laporan P01 |
| P02 | Penyatuan design system | Evaluasi MASTER existing; satukan token, tombol, tabel, filter, formulir, dialog, pagination, loading/error/empty; pilot halaman read-only dan mutasi | Pilot konsisten pada 320/390/768/1440 px; keyboard/fokus/axe; error/loading/empty; tidak mengubah hasil bisnis | Selesai; lihat [laporan P02](STAGE-02-DESIGN-SYSTEM.md) |
| P03 | Konteks akademik global | Tahun ajaran/semester/kelas konsisten dan dapat dipertahankan lintas modul relevan; validasi scope dan fallback eksplisit | Periode lintas halaman benar; pilihan usang/kelas dicabut ditangani; tanggal WIB dan server tetap otoritas | Selesai; lihat [laporan P03](STAGE-03-ACADEMIC-CONTEXT.md) |
| P04 | Keandalan formulir dan penyimpanan | Standar pending/saved/error/uncertain, readback aman, lock submit, perlindungan isian dan draf selektif | Timeout/offline/konflik/submit ganda tidak menyebabkan duplikasi atau kehilangan draf; tidak retry mutasi ambigu otomatis | Belum dimulai |
| P05 | Navigasi dan UI/UX antarmodul | Terapkan standar per kelompok modul; sidebar, istilah, hierarki, tabel dan mobile | Peran/scope tetap; navigasi sidebar; kontrol sentuh/fokus; tidak ada overflow halaman atau elemen terpotong pada skenario uji | Belum dimulai |
| P06 | Beranda sesuai peran | Ringkasan pekerjaan harian yang relevan berdasarkan peran, penugasan aktif dan relasi; prioritas tugas | Angka dapat ditelusuri ke sumber; empty/error/loading jelas; tidak ada kebocoran antarperan; bukan angka dummy | Belum dimulai |
| P07 | Pusat tindak lanjut dan notifikasi | Pekerjaan tertunda, pemilik, tenggat, status; urgensi/modul; deduplikasi dan preferensi notifikasi | Perubahan status mengikuti sumber; akses scoped; satu kejadian tidak menimbulkan kiriman ganda; preferensi tidak menonaktifkan pengamanan wajib | Belum dimulai |
| P08 | Input massal dan kualitas data | Unggah → validasi → pratinjau → konfirmasi → hasil per baris; pemeriksaan duplikasi/relasi/jadwal/nilai | Batch salah ditolak sebelum commit; retry aman; batas ukuran/baris; username tetap teks; hasil deterministik dan berizin | Belum dimulai |
| P09 | Finalisasi dan jejak perubahan | Matriks state per domain, draf/pemeriksaan/final/pembukaan kembali sesuai aturan; riwayat siapa/kapan/alasan/perubahan | Kewenangan eksplisit, final lock dan konflik teruji; arsip/ledger tidak ditimpa; field sensitif disunting dari log | Belum dimulai |
| P10 | Ketahanan operasional dan performa | Pemantauan error/ID, pengujian lintas peran, performa terukur, backup dan simulasi restore | Bukti restore staging, UAT, rekonsiliasi dan load terautentikasi; runbook rollback; tidak menyimpulkan kapasitas dari health | Belum dimulai |
| P11 | Bantuan dan evaluasi pengguna | Panduan kontekstual, pelaporan kendala, sesi tugas bersama pengguna, perbaikan berdasarkan temuan | Tugas utama dapat diselesaikan; baseline dan hasil bandingan tercatat; bantuan tidak meminta password/OTP | Belum dimulai |
| P12 | AI terkontrol | Perluas adapter existing untuk ringkasan/draf/tren agregat sesuai kebutuhan; privasi, human review dan kendali biaya | Output dapat ditinjau; sumber/periode/label AI jelas; refusal/error aman; tanpa keputusan otomatis akademik/keuangan/akses | Belum dimulai |

## Urutan dan dependensi

- P01 → P02 → P03 → P04 → P05 merupakan fondasi utama. P02–P05 dirilis per kelompok modul, bukan satu PR besar.
- P06 memakai komponen dan konteks P02–P05. P07 memakai definisi pekerjaan P06 dan outbox existing.
- P08 memakai kontrak penyimpanan P04. P09 memakai P04 dan pemetaan aturan domain; impor P08 tidak boleh melewati final lock existing.
- P10 mengonsolidasikan bukti operasional; pengujian dan keamanan tetap wajib sejak P01. Kekurangan kritis yang ditemukan lebih awal ditangani sebelum merilis fitur yang bergantung padanya.
- P11 memanfaatkan uji tugas awal P01 dan fitur stabil; masukan pengguna dapat mengoreksi prioritas tahap lain.
- P12 setelah fondasi stabil; keberadaan adapter AI sekarang tidak berarti P12 sudah selesai.

## Batas yang berlaku pada semua tahap

- Pertahankan autentikasi internal, API contract yang digunakan, validasi server, RLS, scope own/class/all, serta database existing. Perubahan additive untuk fitur baru harus dianalisis, dimigrasikan dan diuji pada tahap terkait; jangan mengubah backend hanya demi visual.
- Peran dasar berbeda dari penugasan: Kepala, Wali kelas, Piket, Pembimbing, Bendahara dan Pengelola tabungan bukan alasan menambah role baru tanpa kebutuhan.
- Tahun ajaran `2026/2027` atau input `2026-2027`; Ganjil Juli–Desember 2026, Genap Januari–Juni 2027. Kalender transaksi, tahun terbit buku dan tahun lulus tidak disamakan dengan tahun ajaran.
- D01 nilai PH20/ATS30/ASAS50, Praktik terpisah; D02 fee half-up ribuan dan saldo/slip existing; D03 instrumen/esai wajib existing. Jangan mengubah arsip terbit berdasarkan D10 yang belum diputus.
- Sidebar tetap jalur utama perpindahan halaman; tombol konten berfokus pada tindakan. Modal untuk pekerjaan singkat, halaman untuk alur panjang.
- Gulir vertikal normal diperbolehkan. Hindari overflow halaman/elemen terpotong; tabel lebar memakai region gulir lokal yang dapat diakses keyboard.
- Jangan simpan password, OTP, dokumen pribadi, kunci API atau ekspor produksi dalam git, telemetry atau draf browser generik. Draf sensitif memerlukan rancangan terpisah.
- Tidak mengaktifkan pengiriman email/WA, AI berbayar, scheduler atau perpindahan data produksi sebagai efek samping pengujian.

## Protokol setiap tahap

Analisis → kriteria penerimaan → branch terpisah → implementasi minimum → tes fungsi/izin/regresi → dokumentasi → PR → pemeriksaan wajib → merge sesuai instruksi → verifikasi hasil rilis yang relevan. Catat tes yang belum dijalankan dan blocker dengan jujur. Jangan menyebut 100% bebas bug.

Setiap laporan menyimpan baseline SHA, daftar file, sumber bukti, hasil perintah/exit code, skenario browser jika relevan, batas mock/staging/produksi, risiko dan pekerjaan berikutnya. Untuk perubahan dokumen, validasi tautan, struktur dan diff; tes aplikasi dicatat sebagai baseline, bukan bukti fitur baru.

## Ukuran keberhasilan

Lihat rancangan pengukuran pada P01. Ukur waktu tugas, keberhasilan tugas, kesalahan/ulang input, ketidakpastian penyimpanan, penyelesaian tindak lanjut, dukungan pengguna, aksesibilitas dan performa. Nilai awal yang belum diukur ditulis **belum tersedia**, bukan nol. Target numerik produk dikalibrasi setelah pengukuran awal; integritas data dan penolakan akses terlarang wajib lulus.

## Riwayat

- 24 Oktober 2026: rencana 12 tahap disimpan berdasarkan persetujuan pengguna; P01 dilaksanakan sebagai audit sumber dan rencana kerja. Tidak mengimplementasikan P02–P12 dalam tahap ini.

- 24 Oktober 2026: P02 selesai pada pilot Hak akses saya dan Profil pribadi; standar dan bukti pada laporan P02. P03–P12 belum dimulai.

- 24 Oktober 2026: P03 menambahkan preferensi akademik per akun dan transfer eksplisit pada Kelas/Jadwal/Nilai/Rapor. Kalender transaksi, periode Survei ber-ID dan dua sisi kenaikan tetap eksplisit sesuai semantik modul. P04–P12 belum dimulai.
