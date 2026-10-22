# Audit Jadwal dan piket siswa — 22 Oktober 2026 WIB

Basis: main `085569b18a9a237ea2efa1f51d91d4b2271c4415`. Branch `fix/schedules-audit`.

## A. Temuan

1. POST memvalidasi filter year/class/day setelah app_schedules_write. URL invalid dapat menyimpan data lalu membalas 400, sehingga pengguna berpotensi mengulang tindakan yang sebenarnya sudah dilakukan.
2. Parser snapshot read dan acknowledgement write melempar ZodError; failure() menganggapnya salah isian pengguna (400), padahal ini kegagalan upstream yang memerlukan pemeriksaan hasil.
3. Snapshot menerima revision pecahan/negatif, hari/menit tidak valid, waktu selesai tidak konsisten dan ID baris duplikat. UI dapat menampilkan waktu salah atau state seleksi ambigu jika upstream rusak.
4. Mode mutasi lama membuka pengunci setelah network error/respons rusak dan tidak memiliki timeout; pengguna berpotensi mengirim ulang hasil yang belum pasti.
5. Halaman menelan seluruh exception menjadi pesan akses generik tanpa retry, termasuk saat layanan bermasalah.
6. Filter kelas mencampur semua tahun ajaran. Mengganti tahun dapat meninggalkan classId tahun sebelumnya.
7. Draf dapat hilang ketika berpindah editor, menyimpan formulir lain atau reload. Edit tidak memindahkan fokus/viewport ke form di atas tabel. Batas waktu hari yang sama hanya ditolak server.
8. Guru/mapel lama yang tidak lagi tersedia tidak mendapat arahan pemilihan ulang yang jelas. Penugasan piket nonaktif tidak tampil dalam checklist, tetapi dibersihkan pada replacement; konsekuensinya belum dijelaskan.
9. Judul kartu bukan heading semantik, feedback belum dapat difokuskan, nama panjang dan baris piket belum mempunyai aturan wrapping/target sentuh yang memadai.

## Alur yang diaudit sebelum perubahan

Page → readServerPrincipal → classesData + schedulesData → SchedulePanel. GET filters dikirim ke app_schedules_read. Ketiga command (lesson, duties, schedule_delete) melewati sameOrigin, educationContext/survey gate, bounded JSON dan Zod → app_schedules_write → snapshot baru. Revision dan request UUID mengamankan concurrency/idempotency. SQL memeriksa sesi, onboarding, app_class_access dan setiap ID sebelum mutasi; education_state dikunci untuk transaksi. Pelajaran memeriksa benturan kelas/guru termasuk istirahat. Piket mengganti seluruh minggu secara atomik tanpa menghapus pelajaran. Daftar duties terfilter hari berbeda dari duty_roster seluruh minggu. Enrollment yang berakhir membersihkan piket siswa. Seluruh alur tersebut dipertahankan.

Dibaca: page/panel/route, server/validation/use-mutation, komponen kontrol/Card/Button/TableRegion, WorkspaceShell/CSS, spesifikasi M06/U08/D05, SQL schedules read/write dan override singleton terbaru, serta tes pendidikan/RBAC yang terkait. Tidak ada integrasi Google Apps Script di alur ini.

## B. Perbaikan

- Validasi seluruh filter sebelum RPC write; payload/actor/session/revision/UUID dan kontrak respons tetap sama.
- safeParse snapshot/acknowledgement upstream → exception layanan aman (503), tanpa detail internal.
- Snapshot mengecek rentang integer, revision aman, keunikan ID serta persamaan waktu selesai.
- Memakai useDomainMutation existing dengan confirmed dan scheduleCommand: pending mengunci sinkron, konflik isian dapat diperbaiki, stale/akses/hasil tak pasti mengunci sampai reload, timeout 30 detik, tidak retry otomatis.
- Loading/error boundary kontekstual, retry existing, main dapat difokuskan; denied tetap dibedakan dari outage.
- Filter kelas mengikuti tahun pilihan. SSR panel mendapat key filter/revision sehingga state tidak tertinggal ketika data berubah.
- Guard draf dan konfirmasi antarform; editor reset hanya setelah save terkonfirmasi atau discard yang diterima. Edit fokus ke field pertama; feedback fokus; pemilihan batch maksimal 500.
- Waktu akhir live, tombol simpan menolak melewati hari yang sama. Guru/mapel tidak aktif memerlukan pilihan aktif, tanpa substitusi diam-diam.
- Piket memakai duty_roster tujuh hari. Cleanup nonaktif dan pengosongan kelas dijelaskan; konfirmasi replacement tetap wajib.
- Ringkasan jumlah sesuai scope/filter, heading semantik, grid responsif, tabel scroll lokal keyboard, wrapping nama dan target sentuh 44px. Tidak memakai overflow hidden untuk menyembunyikan konten.

Tidak ada migrasi atau perubahan schema database, RBAC, autentikasi maupun dependency. Kontrak API tetap kompatibel. Predikat singleton safeupdate dari PR17 dipertahankan. Tidak mengubah aturan semester, benturan, istirahat, histori, arsip, atau D10.

## C. Kode final dan file berubah

| File | Alasan |
| --- | --- |
| src/app/account/schedules/page.tsx | Outage/denied terpisah, fokus main, remount sesuai filter/revision |
| src/app/account/schedules/schedule-panel.tsx | Filter, draf, mutasi aman, form, fokus, ringkasan dan responsive |
| src/app/account/schedules/loading.tsx | Loading kontekstual |
| src/app/account/schedules/error.tsx | Retry kontekstual memakai AccountError |
| src/app/api/schedules/route.ts | Pre-write filter validation dan upstream acknowledgement |
| src/lib/education/server.ts | Klasifikasi kegagalan schedulesData |
| src/lib/education/validation.ts | Integritas scheduleSnapshot |
| src/app/globals.css | Aturan scoped schedules-panel |
| tests/schedules.test.mjs | Sembilan tes actual route/page/schema dengan Auth/SDK boundary sintetis |
| tests/ui/schedules-fixture.tsx | Komponen nyata, data sintetis, tanpa route/fake auth aplikasi |
| tests/ui/schedules-navigation-shim.ts | Path fixture sesuai halaman jadwal |
| scripts/verify-schedules.mjs | Browser/axe/geometry/interaksi dan hasil mesin |
| package.json | Masukkan tes ke check dan perintah browser |
| docs/design-system/MASTER.md | Pola interaksi dan tata letak jadwal |
| docs/verification/schedules-audit.md + schedules/*.json | Laporan dan bukti pengujian |

## D. Validasi

- `npm run check`: **277/277 tes**, TypeScript, lint tanpa warning, integrasi database terisolasi, check generated types, production build: lulus.
- `npm run test:schedules`: **9/9**. Menjalankan tes yang sama terhadap source basis: **5 gagal / 4 lulus**; source final dipulihkan sesudah eksperimen.
- `npm run test:schedules:browser`: **72 pemeriksaan**, **8 axe runs**, nol pelanggaran. Desktop/mobile/tablet 320, 375, 768, 1440px; short mobile 320×568, landscape 812×375 dan resize desktop. Normal, kosong, 75 pelajaran/80 siswa, read-only, loading/error. Full-week duty, break/edit, midnight, pending, overlap, stale, network/malformed reply, fokus, keyboard Enter, touch tap, seleksi hapus, cleanup nonaktif dan referensi tidak tersedia diperiksa.
- `npm run test:academic:browser`: **41 pemeriksaan**, **6 axe runs**, nol pelanggaran; label tahun dan periode lintasmodul tetap konsisten.
- `npm run audit:deadcode`: tidak ada source unreachable. `git diff --check`: lulus.
- Tidak ditemukan uncaught JavaScript error atau horizontal overflow halaman pada viewport/skenario browser yang diuji. Tabel dan daftar tetap dapat digulir; gulir vertikal dokumen normal dipertahankan.
- Build pertama gagal karena cache Turbopack lama; setelah membersihkan .next, build menemukan satu tipe opsional di fixture, diperbaiki. Build final lulus. Tidak ada perubahan konfigurasi produksi untuk mengatasi cache lokal.

Batas: browser memakai fixture sintetis dan respons API terintersepsi; bukan login/Admin/Guru/Siswa nyata di produksi. Aturan role/ID dan transaksi diuji pada database terisolasi. PGlite tidak memuat ekstensi C pg-safeupdate. Tidak membuat pengguna, kelas, pelajaran atau piket di produksi untuk QA. Hasil ini tidak merupakan jaminan bebas seluruh bug pada kondisi yang belum diuji.
