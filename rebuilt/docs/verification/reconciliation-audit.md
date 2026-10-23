# Audit Rekonsiliasi — 23 Oktober 2026

Baseline main `16fa8bf46845bfc90b3a90d57acdd43438042a81`; branch `fix/reconciliation-audit`.

## Analisis dan alur sebelum perubahan

Dibaca service page/panel, reader/snapshot/filter, API services/[module] dan services/exports, serviceExportRows/exportServices, operationsData/exportRows, learningData/object/period labels, educationContext/failure, SQL app_services_read dan override terbaru, agregat ledger/arsip/survei serta tes services/production/jobs/notifications/points. Spesifikasi M17/U27–29, kebijakan bisnis dan batas rekonsiliasi sumber ikut diperiksa sebelum modifikasi.

Alur existing: sesi server dan gate survei → app_services_read khusus Admin/onboarding → metrik global pada extra; rows memang kosong. Form mengekspor lima domain operational/SPK dengan query terotorisasi masing-masing. API tetap mendukung reports/survey-results. Tidak ada CRUD, modal atau mekanisme pencocokan sumber otomatis pada halaman ini. sourceAvailable masih false pada pembaca SQL; tidak mengarang keberhasilan pencocokan/backup/restore.

## Temuan dan perbaikan

| Temuan / penyebab | Perbaikan |
| --- | --- |
| Ekspor ringkasan memakai rows kosong sehingga metrik extra hilang | Cabang ekspor Rekonsiliasi memakai kontrak metrik bersama; nilai angka/0 tetap numerik dalam XLSX |
| UI menampilkan label internal/raw boolean dan empty state palsu | Card/dl metrik Indonesia dan rupiah; status sumber jelas, tanpa menganggap rows kosong berarti tidak ada ringkasan |
| Outage dan denied tercampur dalam fallback page | Outage ke error boundary existing; AccessDenied tetap menjelaskan izin Admin |
| Snapshot generik membiarkan metrik salah/unsafe dan kelas duplikat | Kontrak khusus module/admin/revision/date/count/monetary safe integer dan unique classes; upstream rusak menjadi 503 |
| Filter paket tidak diperiksa lengkap sebelum domain dibaca | Shared packageQuery: kalender/rentang/awal bulan, UUID, modul unik, dependency kelas rapor/periode survei; repeated query key ditolak |
| Paket dapat mencampur revision operations/services berbeda | Bandingkan revision yang memakai operations_state; hasil berbeda ditolak sebelum file diserahkan |
| Ekspor navigasi GET langsung memindahkan pengguna ke halaman error | Fetch unduhan read-only di halaman sama dengan feedback loading/success/error; tidak mengklaim unduhan tersimpan ke filesystem |
| Double download dan request tanpa cleanup/timeout | Lock sinkron, AbortController/60 detik, mounted guard, Blob URL/timer cleanup |
| MIME/JSON error dapat diperlakukan sebagai berkas | Cek MIME XLSX dan signature ZIP sebelum memicu unduhan; generated workbook diuji dengan ExcelJS roundtrip |
| Pengaturan bulan SPK berupa input date dapat memilih tanggal selain 1 | Input month dinormalisasi YYYY-MM-01, validator yang sama di client/API |
| Refresh dapat menghilangkan draft/kelas yang tak lagi tersedia | Draft dipertahankan; kelas hilang diberi opsi tidak tersedia dan ekspor diblokir sampai pilihan eksplisit baru, tidak melebar diam-diam |
| Label kelas tahun berbeda dapat membingungkan | Tahun ajaran memakai formatAcademicYear existing bila metadata tahun tersedia |
| Kontrol tanggal/select, angka panjang dan action mobile | Scoped min-width0/max-width, wrapping, padding responsif, kontrol44px dan semantic h2/dl/fieldset/legend |
| Generic panel/fallback Rekonsiliasi tidak dipakai lagi | ReconciliationPanel terpisah; hapus panel generic dan fallback yang telah tidak terjangkau, ekspor obj/list untuk modul lain dipertahankan |

## Lingkup, kompatibilitas dan batas konsistensi

Tidak ada migrasi, tabel/database/grant/RLS/auth baru atau perubahan data produksi. Formula saldo tabungan, iuran, poin, rapor PH20/ATS30/ASAS50 dan Praktik terpisah tetap memakai domain existing. Filter API, endpoint GET, field response dan nama file server existing dipertahankan; query invalid kini ditolak sebelum query domain. Ekspor paket tetap dapat diakses role lain sesuai izin masing-masing domain; halaman/ringkasan Rekonsiliasi tetap khusus Admin. Tidak menambahkan gate Admin menyeluruh ke API ekspor paket yang sebelumnya terskop per modul.

Metrik ringkasan global tidak difilter oleh form paket; UI/XLSX/PDF menjelaskan cakupan tersebut. Paket default tetap attendance, mentoring, fees, savings, discipline. month adalah bulan kalender SPK, bukan tahun ajaran; reports/survey-results API tetap tersedia dan label tahun/semester memakai helper existing. Hasil parsial ditolak, maksimum10.000 baris per worksheet, isi string tidak ditafsirkan sebagai objek formula XLSX dan nilai angka dipertahankan.

Pemeriksaan revision bukan transaksi snapshot database lintas seluruh domain. operations/services berbagi operations_state, sementara learning memiliki revision terpisah; revision rapor tidak dibandingkan dengan revision operations. Perubahan yang tidak menaikkan revision tersebut tidak dapat dideteksi oleh pemeriksaan ini. Tidak mengklaim atomic global snapshot atau exactly-once download.

## File yang berubah

- `src/app/account/services/[module]/reconciliation-panel.tsx`: UI typed, filter/draft/download lifecycle.
- Service page/panel: routing ke panel, error/denied dan layout; helper ekspor shared tetap dipertahankan.
- `src/lib/services/reconciliation.ts`: kontrak snapshot, label metrik dan validator query bersama.
- `src/lib/services/server.ts`: validasi snapshot Rekonsiliasi, tanpa perubahan RPC.
- `src/lib/services/export.ts`: ekspor metrik dari extra dan keterangan cakupan PDF.
- `src/app/api/services/exports/route.ts`: validasi query sebelum pembacaan dan pemeriksaan revision.
- `src/app/globals.css`: selector `.reconciliation-panel` saja.
- `tests/reconciliation.test.mjs`: handler/reader/page/helper asli, XLSX roundtrip; boundary Auth/SDK/domain reader sintetis.
- `tests/notifications-page.test.mjs`: expectation error boundary Rekonsiliasi; regresi Notifikasi/Jobs tetap diuji.
- Browser fixture/verifier, package scripts dan dokumentasi design system/verifikasi.

## Hasil verifikasi

- `npm ci` berhasil tanpa perubahan dependency/lockfile.
- `npm run check` exit0: 476 tes/55 kelompok, tanpa kegagalan; TypeScript, lint nol warning, tes database/auth/domain/API, tipe database14 tabel public dan production build berhasil.
- Enam tes Rekonsiliasi mencakup ringkasan rows kosong/nilai0, validasi sebelum query, ekspor lima domain/format angka/teks, partial/size/revision, reports/survey-results dan label 2026/2027/Ganjil/Praktik0, auth/survey/denied serta page outage.
- Typecheck/lint/build diulang setelah penyempurnaan pilihan kelas stale dan semuanya lulus.
- Browser final dengan CSS hasil build produksi: 59 pemeriksaan/5 axe, pageerror kosong; viewport320/768/1440, landscape, touch dan keyboard native date. Termasuk 100 kelas/nama panjang/saldo maksimum aman/zero data, real Blob download dan pembacaan workbook, query bulan/kelas/rentang, konfirmasi filename, lock double click, input invalid tanpa network, refresh preserving draft, stale class, 503/403/401/network, MIME/signature invalid dan malformed snapshot.
- Tidak ditemukan horizontal overflow atau elemen keluar viewport dalam skenario yang diuji. Scroll vertikal halaman normal untuk mengakses seluruh isi.
- Deadcode: 136 entry, 197 source files, unreachable kosong.
- Query read-only produksi: app_services_read tetap SECURITY INVOKER, EXECUTE anon/authenticated=false, service_role=true. Tidak ada mutasi data produksi untuk QA.

## Batas bukti

Browser memakai komponen asli dan HTTP/data sintetis; ekspor server dibuktikan dengan workbook nyata tetapi Auth/SDK/domain data pada tes API sintetis. Suite database memakai migrasi nyata pada PGlite terisolasi. Perangkat fisik, screen reader manual, unduhan menggunakan akun produksi dan kesetaraan data sumber→target belum diuji. Sumber pembanding belum terintegrasi/tersedia pada pembaca SQL; tidak menyatakan rekonsiliasi bisnis selesai atau seluruh data telah cocok. Pemeriksaan MIME/signature client tidak menggantikan validasi seluruh struktur ZIP/XLSX; workbook yang dibuat server diuji secara roundtrip.
