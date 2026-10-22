# Jadwal dan piket siswa — audit tab dan modal

22 Oktober 2026 WIB. Basis main `7d2431cf7a33adeabc789a8465c2039f9edf61c1` (PR18). Branch `feat/schedules-tabs-modals`.

## A. Temuan dan dampak

Implementasi PR18 telah memvalidasi URL sebelum write, memisahkan kegagalan upstream, memeriksa snapshot, menjaga revision/idempotency dan mengunci hasil simpan tak pasti. Pemeriksaan ulang tidak menemukan alasan mengganti aturan database/API tersebut.

Temuan race yang diperbaiki: classesData dan schedulesData dibaca berurutan melalui RPC terpisah. Mutasi di antara kedua read dapat membuat daftar anggota kelas lama dipasangkan dengan roster/revision jadwal baru. Halaman sekarang membandingkan revision dari education_state dan menolak snapshot campuran menuju retry boundary sebelum editor dirender. Tes actual page mereproduksi mismatch tanpa menulis data.

Kebutuhan baru: dua jenis jadwal dan dua editor sebelumnya tampil sekaligus sehingga halaman padat. Pemindahan editor ke modal memerlukan penanganan risiko berikut, bukan perubahan aturan bisnis:

- Seleksi dua jenis data pada tampilan terpisah dapat menyembunyikan ID yang ikut terhapus.
- Feedback di halaman belakang tidak dapat dijangkau ketika focus trap modal aktif; reload untuk hasil tak pasti juga harus tersedia di modal.
- Modal yang ditutup saat request berlangsung dapat menghilangkan konteks hasil dan memungkinkan draft baru sebelum hasil pertama pasti.
- Escape/X/Batal/perubahan kelas dapat membuang draf tanpa konfirmasi; fokus harus kembali ke pemicu yang tepat.
- Modal form panjang dapat terpotong pada smartphone pendek atau landscape jika hanya body flex yang dibatasi.
- Form filter GET dapat kembali ke tab KBM setelah pengguna memilih tab Piket jika tab tidak dibawa pada query.

## Analisis alur sebelum perubahan

Dibaca ulang seluruh page, panel, LessonForm, DutyForm, API route, schedulesData/educationContext, schema command/snapshot, hook useDomainMutation, komponen Dialog/Button/Card/TableRegion/control, CSS dan WorkspaceShell, serta spesifikasi M06/U08, keputusan periode akademik dan SQL schedules read/write/override singleton. React best-practices digunakan untuk review struktur/hook/aksesibilitas.

Alur server tetap: principal terverifikasi → daftar kelas sesuai scope → schedules read dengan tahun/kelas/hari/personal. POST sameOrigin + survey/session gate → bounded JSON/Zod → RPC write → snapshot tervalidasi. SQL memeriksa onboarding/role/class scope, request UUID/revision, overlap kelas/guru termasuk istirahat, membership piket dan semua ID batch. Full-week duty_roster berbeda dari daftar duties terfilter hari; penggantian tetap atomik dan tidak menghapus pelajaran. Tidak ada GAS pada alur ini.

Alur UI baru: filter bersama → Radix Tabs → daftar dan tombol input sesuai izin → satu Dialog terkontrol berisi LessonForm atau DutyForm yang sama. Tidak ada duplikasi form atau implementasi modal/tab dasar baru.

## B. Perbaikan

1. Tambah Jadwal KBM/Jadwal Piket dengan primitive Radix existing: aria-selected/controls/panel, navigasi panah/Home/End. Tab tidak memicu fetch/mutasi baru. Query view mempertahankan tab saat filter GET; nilai tidak dikenal/berulang menjadi KBM.
2. Input Jadwal KBM, Input Jadwal Piket dan Edit membuka Dialog existing. Form di-mount saat dibuka dan di-unmount saat ditutup. Satu modal menghilangkan kebutuhan menyimpan dua draft silang sekaligus; state/ref/effect editor inline lama dihapus.
3. Input menampilkan kelas dari tahun yang diterapkan; KBM bisa memakai kelas filter, piket memakai kelas filter atau satu-satunya kelas writable. Mengganti kelas piket menghormati konfirmasi draft.
4. Perpindahan tab mengosongkan seleksi. Command hapus juga dibatasi eksplisit hanya ke lessonIds atau dutyIds dari tab aktif; revision/RBAC tetap diverifikasi server.
5. Guard simpan sinkron mencegah penutupan saat pending. Sukses snapshot baru menutup modal dan membersihkan seleksi/draft. Error/overlap/stale/network/respons rusak/timeout mempertahankan isian dan feedback di modal. Hasil tak pasti tetap terkunci dan reload dapat dijangkau dalam focus trap.
6. Escape/X/Batal meminta discard bila dirty. Dialog mengembalikan fokus ke input/Edit. Tidak menutup dengan klik backdrop (perilaku Dialog existing).
7. CSS scoped schedules-dialog membatasi viewport, mengizinkan seluruh modal bergulir pada layar pendek, serta memakai kontrol 44px dan wrapping existing. Tidak mengubah Dialog global atau memotong konten halaman.
8. Istirahat, larangan melewati tengah malam, referensi nonaktif, roster tujuh hari, konfirmasi pengosongan dan cleanup piket nonaktif tetap dipertahankan.

## C. File final dan alasan

| File | Perubahan |
| --- | --- |
| src/app/account/schedules/schedule-panel.tsx | Tabs, tombol, Dialog, satu editor, state/feedback/fokus/seleksi aman; kedua form existing digunakan ulang |
| src/app/account/schedules/page.tsx | Tab awal dari query view yang dinormalisasi dan key sinkron |
| src/app/globals.css | Tampilan tab dan batas/gulir modal khusus schedules |
| tests/schedules.test.mjs | Tiga tes actual page untuk persistensi/fallback tab; sembilan tes API/schema sebelumnya tetap dijalankan, plus guard revision kelas/jadwal |
| tests/ui/schedules-fixture.tsx | Tab awal dan kelas kedua sintetis untuk empty/dirty class switch |
| scripts/verify-schedules.mjs | Browser regression modal/tab, hasil mesin dan screenshot sementara |
| docs/design-system/MASTER.md | Mengganti aturan editor inline dengan tab/modal saat ini |
| docs/verification/schedules-tabs-audit.md + schedules-tabs/*.json | Laporan dan bukti terbaru |

Tidak ada perubahan dependency/lockfile, migrasi, data produksi, role/grant/RLS, authentikasi, backend RPC/API contract, struktur data, histori atau aturan semester. D10 tetap tidak diubah.

## D. Validasi yang benar-benar dijalankan

- npm run check: **280/280 tes**, 38 kelompok test runner; TypeScript, ESLint tanpa warning, integrasi database terisolasi, generated database types dan production build lulus.
- npm run test:schedules: **12/12**; filter sebelum write, actor/session, foreign Origin, gate, ketiga command, snapshot invalid, uncertain read-after-write, konflik dan tab query.
- npm run test:schedules:browser: **145 pemeriksaan**, **14 axe runs**, nol pelanggaran. Viewport 320/375/768/1440; short mobile 320×568, resize landscape 812×375 dan desktop 1440×900.
- Browser: normal/kosong/75 pelajaran/80 siswa/read-only/loading/error; kedua tab; modal KBM/Piket; keyboard panah/Home/Enter/Escape/Tab; touch selection; trigger return focus; dirty close/class switch; kelas tanpa siswa; roster seluruh minggu dengan filter satu hari; empty replacement; break/edit; midnight; pending close lock; overlap/stale/denied/network/malformed reply; 30 detik timeout tanpa retry; hapus perjenis; initial Piket query dan filter tahun.
- Seluruh modal yang diuji berada dalam viewport dan footer dapat digulir untuk dijangkau; tidak ditemukan horizontal overflow halaman/modal atau uncaught JavaScript error pada skenario tersebut. Gulir vertikal normal tetap tersedia.
- npm run test:academic:browser: **41 pemeriksaan / 6 axe runs**, nol pelanggaran; label tahun/semester lintasmodul tetap konsisten.
- npm run audit:deadcode: tidak ada source unreachable. git diff --check lulus.

Perbaikan pada harness selama QA: menunggu aktivasi keyboard Radix yang asynchronous sebelum assertion, dan mengubah loop uncheck menjadi mengambil checkbox checked pertama karena indeks locator berubah setelah uncheck. Kegagalan awal ini berasal dari harness, bukan disembunyikan sebagai tes lulus. Hasil final tersimpan dalam browser-results.json.

Batas: browser memakai komponen aktual dengan data sintetis dan API intersepsi; bukan login/mutasi Admin/Guru/Siswa nyata di produksi. Role/SQL diuji melalui suite database terisolasi; PGlite tidak memuat ekstensi C safeupdate. Touch/resize adalah emulasi Chromium, bukan perangkat fisik atau uji pembaca layar manual. Tidak mengklaim jaminan bebas bug di kondisi yang belum diuji.
