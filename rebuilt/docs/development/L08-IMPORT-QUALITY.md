# L08 — Pekerjaan massal dan kualitas data

Baseline main `849452b4d917197ee353e87fc38d2a14e66256d8` (PR82). Branch `feat/l08-import-quality`. 26 Oktober 2026 (Asia/Jakarta).

## Audit dan ruang lingkup

Dibaca ImportUsers, provisioning/validasi pengguna, API preview/template, BulkImport, parser dan katalog domain, API preview/commit/status, workbook reader/writer, pengamanan ZIP, test browser/route/database serta roadmap/keputusan bisnis. Existing sudah memakai XLSX dan menjaga username teks, leading zero/minus, 100 baris/1MiB, serta kuota20 akun/15menit. Pengguna diproses per akun (parsial); penempatan/jadwal/nilai memakai transaksi batch atomik. Tidak mengubah kontrak atau memperluas hak akses ini.

Gap: template belum berversi; pesan invalid lokal terlalu umum dan lintas-domain; belum ada persentase valid atau daftar kesalahan/hasil XLSX terpisah dari kredensial. Konfirmasi popup hanya diwajibkan untuk batch yang berisi Admin, walau checkbox/backup credential sudah diwajibkan untuk semua. Respons preview bulk belum memeriksa koherensi jumlah baris valid/invalid. Pemeriksaan visual320 menemukan focus otomatis pada feedback menggeser scroll container modal yang overflow-hidden sehingga judul/close dapat terpotong.

## Perubahan

- Template pengguna, penempatan, jadwal dan nilai sekarang menyertakan identitas/versi1 di sheet Panduan. Contoh existing dipertahankan: pengguna di panduan (Data kosong agar tidak membuat akun contoh); tiga bulk di Data dengan instruksi hapus contoh sebelum impor. Header, Data/Panduan, text types dan batas tetap sama.
- Reader memeriksa jenis/versi ketika marker tersedia, termasuk pada endpoint commit. Salah versi/jenis atau marker ganda ditolak sebelum RPC/provisioning. Template lama tanpa marker tetap diterima **setelah** semua pemeriksaan struktur/tipe/ZIP/domain existing. Marker adalah kompatibilitas/advisory, bukan bukti keamanan atau tanda tangan. Menghapus marker tidak melewati validasi bisnis.
- Validasi pengguna dan tiga domain bulk memberi petunjuk per kolom tanpa menggemakan email/nama/nilai input mentah. API preview pengguna mengembalikan ringkasan count/valid/invalid/percentage secara additive. Invalid row dihitung unik. UI membedakan pemeriksaan format workbook dari validasi referensi/izin di sumber; preview bukan bukti tersimpan.
- ImportUsers meminta konfirmasi popup untuk semua batch; pesan tambahan untuk akun Admin tetap eksplisit. Batal tidak mengirim POST pembuatan akun. Epoch/mounted/active diperiksa kembali setelah await konfirmasi, agar draft yang berubah/ditutup tidak memakai keputusan lama. Kredensial wajib diunduh dan checkbox diperiksa seperti sebelumnya.
- Komponen ImportReport reusable mengekspor whitelist kolom hasil/kesalahan ke XLSX. Laporan pengguna berisi nomor baris Excel, username, status, keterangan; **tanpa password, email, nama, request ID atau payload**. Kredensial tetap lewat unduhan rahasia existing yang terpisah. Laporan bulk berisi nomor baris, hasil validasi dan status seluruh batch, tanpa nilai/nama/ID referensi.
- Status pending/uncertain tidak diklaim sebagai berhasil. Bulk yang uncertain tetap menandai status batch unknown walaupun hasil validasi ready sebelumnya tersedia. Instruksi menyatakan laporan adalah snapshot saat unduhan diminta dan bukan template impor; unduh ulang setelah selesai.
- Laporan memakai wrap text, kolom keterangan64 dan tinggi baris berdasarkan teks (batas Excel409). Format ini opt-in pada laporan; default ekspor modul lain tidak berubah. Semua string tetap scalar/text, bukan formula executable. Download error dapat dicoba lagi tanpa menghapus draft/status atau mengirim mutasi.
- Feedback bulk memakai focus preventScroll dan hanya menggulir dialog-body; shell/header tidak ikut bergeser. Regresi browser memeriksa scroll shell0 serta posisi judul/close pada semua domain/viewport. Komponen Dialog global tidak diubah.
- Parser/preview bulk memeriksa koherensi jumlah baris dan nomor isu sebelum merender persentase. Tidak menambah persistence workbook/password, retry otomatis, fitur restore kredensial atau perubahan kuota. Retry existing mempertahankan payload/request/password yang sama; hasil created tidak dikirim ulang. Failed row harus dikoreksi melalui alur baru setelah memeriksa akun yang sudah dibuat.

Tidak ada schema/RPC/DB migration, env, dependency aplikasi atau perubahan auth/RBAC/rumus nilai/semester. ExcelJS existing tetap digunakan sesuai stack pengguna. Tidak membuat akun, mengimpor nilai atau mengirim email pada produksi.

## Verifikasi

- npm ci dan npm run check lulus: 773 tes, TypeScript/lint, replay tipe database dan production build pada checkout baru.
- Tiga tes tambahan sesudah full check (endpoint workbook, petunjuk bulk, layout laporan) lulus dalam suite terarah: test:bulk dan test:excel. Check/CI kini mencakup 776 tes total.
- TypeScript/lint dan build diulang setelah perbaikan fokus modal; final exit0. Build ulang dengan cache sempat gagal pada persistence Turbopack runner; output .next lama dipindahkan reversibel, lalu build bersih standar lulus tanpa mengubah compiler/config produk.
- Browser pengguna: 58 checks / 4 axe, nol JS error. XLSX riil dibuka ulang untuk memeriksa username/text, report tanpa password, pending/uncertain/created, nomor baris error; cancel ordinary/Admin, kredensial wajib, retry lost-response dengan payload sama, quota pause/resume, download error/recovery.
- Browser tiga bulk: 106 checks / 12 axe, nol JS error. Enrollment/grades/schedules pada320/390/768/1440, formatinvalid/duplicate, sumberstale/denied, lost/wrong acknowledgement, readback tanpa commit ulang, laporan saved/unknown dan error row; root modal scroll0 serta judul/close tetap di dalam modal setelah fokus feedback.
- Total browser164checks/16axe. Screenshot320 pengguna dan bulk diperiksa. Tabel memakai scroll internal; tidak ada horizontal page overflow pada viewport yang diuji. Axe nol bukan sertifikasi WCAG penuh.
- Kontrak DB existing dites pada PGlite terisolasi: idempotent retry/content dedup, konflik request, peran/grant/membership, seluruh batch rollback jika invalid, dan kuota provisioning. Tidak ada test write produksi. Sesi kerja sebelumnya tidak mempertahankan checkout lokal yang belum dipublikasikan; perubahan dipulihkan pada checkout main terverifikasi dan dites ulang, bukan menganggap hasil lama cukup.

Uji browser memakai komponen aktual/CSS production, workbook XLSX riil dan batas HTTP sintetis. Ini bukan UAT manusia atau uji impor data produksi. Waktu koreksi admin/manusia belum diukur. L02 UAT manusia tetap terbuka.

## File dan alasan

- `lib/spreadsheets/templates.ts`: identitas versi dan ringkasan kualitas.
- `lib/spreadsheets/{read,write}.ts`: verifikasi marker opsional; metadata template dan layout laporan opt-in.
- `lib/users/import.ts`, `lib/bulk/rows.ts`: petunjuk validasi per kolom.
- `api/directory/users/import/route.ts`: template versi dan quality preview tanpa provisioning.
- `api/bulk-input/{route,workbook/route}.ts`: versi sama pada parse preview/commit dan template.
- `components/imports/import-report.tsx`: ekspor laporan reusable, lock, unmount guard dan error/recovery.
- `account/directory/import-users.tsx`: ringkasan, konfirmasi semua batch dan laporan bebas password.
- `components/bulk/bulk-import.tsx`: kualitas/koherensi preview dan laporan status atomik/uncertain.
- `tests/{excel,user-import-route,bulk,bulk-route}.test.mjs`: versi/legacy, scope, teks/formula, quality/diagnostics dan laporan.
- `scripts/verify-{user-import,bulk}.mjs`: laporan riil, cancel, lost response, quota, error/recovery dan responsive.
- MASTER/roadmaps dan `docs/verification/l08-import-quality/`: kontrak serta bukti tersunting.

## Rilis / rollback

PR mencatat CI, merge dan exact SHA Production; dokumen commit adalah snapshot sebelum publikasi. Revert kode UI/parser/template/report jika perlu, tanpa rollback database. Versi1 memakai struktur header yang sama sehingga reader lama tetap membaca Data; jangan menganggap template versi masa depan kompatibel otomatis. Laporan bukan templat dan tidak boleh diimpor sebagai kredensial/batch baru. State impor pengguna tetap hanya pada halaman yang sama; jangan menutup/muat ulang selama hasil belum pasti.
