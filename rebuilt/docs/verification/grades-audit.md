# Audit Penilaian dan KKM — 23 Oktober 2026 (Asia/Jakarta)

## A. Temuan

- Koreksi memakai classId/subjectId dan daftar siswa dari filter aktif, bukan dari penilaian asal. Memilih penilaian dari kelas/mapel/tahun lain dapat menampilkan roster yang salah atau menolak koreksi; filter siswa juga dapat menyembunyikan nilai lama dari formulir.
- ATS/ASAS/Praktik memakai upsert pada backend. Form input baru belum memuat nilai existing untuk jenis tersebut, sehingga isian kosong dapat menimpa nilai lama tanpa konteks koreksi yang jelas.
- KKM number input belum memiliki batas/step native yang sama dengan rentang nilai. Pengaturan KKM, input, koreksi dan pembatalan bercampur dalam panel generik; prompt pembatalan belum mengelola fokus/draf.
- Read dan write belum berbagi lock; read gagal setelah write belum dibedakan dari gagal simpan. Response result/message belum mensyaratkan snapshot valid sebelum sukses; unknown/malformed ack dapat salah diklasifikasikan sebagai input error.
- Snapshot generik belum memeriksa periode tanggal/tahun kelas, nomor PH/non-PH, score IDs unik, safe revision dan struktur nilai nullable. Perlu menjaga nilai 0, nilai kosong/null, KKM 0 dan KKM bawaan 75 secara berbeda.
- Filter siswa SQL mempersempit people, sedangkan scores pada riwayat mengikuti izin baca. Tampilan perlu menyaring rincian siswa dengan konsisten tanpa menghilangkan score asal yang harus dipertahankan pada koreksi.
- Form panjang membutuhkan pagination yang mempertahankan semua draf; riwayat memerlukan hierarki kelas/mapel/tahun/semester, empty state, pencarian dan scroll tabel lokal.

## B. Analisis dan perbaikan

Dibaca sebelum perubahan: seluruh blok grades pada LearningPanel, dependencies filter/submit/load/mutate dan modul tetangganya; LearningPage; API learning dan batch exports; validation/server/print; Dialog/TableRegion/domain controls/confirmed mutation; M11, kebijakan D01/D10/ACADEMIC-1.0; SQL assessments/KKM/access/counters/scores, report draft/publish/immutable archive, learning read/write serta override singleton terbaru. Scope internal: principal/session → onboarding/survey gate → scoped RPC → snapshot → filter/history/modal; command → UUID/revision → atomic write/audit → scoped readback → UI.

**Kebijakan:** rekomendasi historis M11 tentang bobot Praktik telah digantikan keputusan D01. Tetap PH20% + ATS30% + ASAS50%; Praktik terpisah termasuk 0. D10 masih OPEN: audit ini tidak menetapkan aturan koreksi/re-publish baru dan tidak mengubah arsip. KKM periode tetap memengaruhi penilaian baru dan rapor draf sesuai SQL existing; KKM snapshot assessment dan rapor terbit tidak ditulis ulang.

- GradesPanel khusus mendelegasikan dari LearningPanel; cabang dan variabel grades lama yang tidak terpakai dihapus. Nama LearningPanel dan API/RPC existing tetap; Rapor/Promosi/Buku memakai alur lama.
- Modal input/koreksi/KKM/pembatalan menggunakan komponen/tokens existing. Konteks ditampilkan eksplisit dan dimuat tanpa menahan pembukaan modal. Loading/error/retry konteks tidak ditafsirkan sebagai roster kosong yang boleh disimpan.
- Koreksi mengikuti ID/classId/subjectId/semester/kind assessment asal. Mengambil snapshot konteks dengan scope dan revision identik, memakai row terbaru yang masih dapat diedit; jenis terkunci. Roster menggabungkan siswa kelas dan semua score asal, termasuk siswa yang tidak lagi ada pada katalog. Grade draft mempertahankan value 0, null, notes dan UUID siswa.
- Jenis ATS/ASAS/Praktik existing dimuat sebagai koreksi eksplisit dengan ID existing, isian lama dan alasan wajib. Perubahan jenis meminta konfirmasi bila draf berubah. Penilaian baru semua-kosong memerlukan konfirmasi, tetap kompatibel dengan nilai nullable existing.
- Katalog entryPeople di services reader learning mengikuti kelas/mapel/semester, tidak menyempit mengikuti filter siswa laporan. Read tambahan memakai principal/session sama dan revision/semester identik. Filter siswa dan pencarian riwayat membatasi rincian tampilan, bukan isi batch yang dipertahankan.
- gradesSnapshot memeriksa struktur scope/nilai/KKM, semester, tanggal dalam tahun/semester kelas, FK tahun kelas, assessment IDs, score IDs dan PH sequence; tidak menghitung ulang rumus rapor di frontend. gradeFilters hanya menerima classId/subjectId/studentId/semester dan menormalkan blank. GET/POST memvalidasi filter sebelum write/read.
- POST grades tetap result/message dan menambah code/data setelah acknowledgement dikenal dan readback valid. Unknown/malformed ack, upstream rusak, readback gagal atau konteks berbeda menjadi kegagalan layanan; confirmed mutation mempertahankan draf dan memblokir retry buta. Stale/not_found/request_conflict/denied meminta reload. Read gagal mempertahankan snapshot sebelumnya; read/write lock dan timeout/abort mencegah overwrite terlambat.
- Tanggal memakai helper akademik existing. Ganjil Juli–Desember tahun pertama; Genap Januari–Juni tahun kedua. Tanggal dibatasi semester assessment, bukan tanggal filter lain. Tidak menambah larangan tanggal masa depan yang tidak ada pada backend.
- KKM form 0..100 step 0.01, mempertahankan 0 via nullish fallback. Konfirmasi menyebut kelas/tahun/semester dan dampak KKM pada penilaian baru/draf, tanpa mengubah assessment snapshot/rapor terbit. Nilai lama mempertahankan kkm_snapshot dan fallback flag.
- Pembatalan modal hanya memerlukan ID dan alasan, tidak bergantung pada roster atau field nilai yang sedang invalid. Mengikuti can_edit; konfirmasi menjelaskan soft void, nomor PH tidak dipakai ulang dan arsip rapor tetap dipertahankan.
- Form controlled dengan pencarian/pagination 20 siswa menjaga seluruh isian lintas halaman; submit seluruh batch, maksimal 500 sesuai API. Pencarian formulir tidak menandai draf berubah dan Enter tidak mengirim batch. Validasi seluruh nilai mencakup rentang dan maksimal dua desimal, termasuk input pada halaman tersembunyi; kontrak API legacy tetap. Riwayat pagination 10 penilaian, filter jenis/nomor PH/nama, identitas kelas/tahun/semester dan rincian nilai dalam TableRegion. Ringkasan membedakan penilaian, nilai terisi dan belum diisi. Data 0 tidak dianggap kosong.
- Dirty/pending dismissal guard, beforeunload cleanup, focus trap/return/fallback, feedback lokal, kontrol 44px, wrapping nama/catatan, modal bounded dan scroll lokal. Halaman grades memakai retry boundary saat layanan gagal.

Tidak ada migrasi atau modifikasi database, autentikasi, RBAC/RLS, assignment jadwal, kontrak RPC, PH counters, upsert semantics, RAPOR-1.0, predikat, aset/Storage atau arsip rapor. Tidak menambahkan ekspor baru pada grades; ekspor rapor existing tetap memakai formatter/rumus yang sama.

## C. File final

| File | Alasan |
| --- | --- |
| src/app/account/learning/[module]/grades-panel.tsx | Modal, scope, roster/draft, KKM, void, filter/search/pagination dan status |
| src/app/account/learning/[module]/panel.tsx | Dispatcher dan hapus cabang grades lama |
| src/app/account/learning/[module]/page.tsx | Retry boundary grades dan min-width layout |
| src/lib/learning/grades.ts | Schema, filter, roster/draft yang mempertahankan score asal |
| src/lib/learning/server.ts | Validasi upstream, scope dan roster tanpa filter siswa |
| src/app/api/learning/[module]/route.ts | Confirmed ack/readback, validasi query sebelum mutation |
| src/app/globals.css | CSS scoped dialog/kontrol/tabel/wrapping |
| tests/grades.test.mjs | Actual route/page/server/schema/helpers dan kontrak reports |
| tests/database/learning.test.mjs | Subset correction, null/zero, KKM snapshot/100 dan immutable report |
| tests/ui/grades-fixture.tsx + grades-navigation-shim.ts | Komponen nyata/shell dengan data sintetis |
| scripts/verify-grades.mjs | Browser/axe/geometry/interaksi/error/timeout |
| tests/ui/academic-fixture.tsx + scripts/verify-academic.mjs | Regresi periode disesuaikan ke modal tanpa mengurangi assert batas tanggal |
| package.json | Grades test/browser dan integrasi check |
| docs/design-system/MASTER.md + docs/verification/grades* | Pedoman, audit dan hasil QA |

## D. Validasi

`npm ci` dan `npm run check` lulus **369/369 tes / 45 kelompok runner**, termasuk **16 tes grades route/page/server/schema/helper/kontrak reports baru** dan **1 regression database baru**. TypeScript, ESLint tanpa warning, unit/integrasi DB, generated types 14 tabel dan production build lulus. Setelah penyelarasan pencarian dan validasi seluruh halaman input, browser serta rangkaian check lengkap dijalankan ulang pada kode final. Suite learning diulang setelah menambahkan assertion Praktik 0/100 dan arsip immutable; 3 unit + 14 integrasi DB lulus. Audit source graph tidak menemukan unreachable source; diff check lulus.

Browser Penilaian/KKM lulus **61 pemeriksaan / 7 axe runs**, tanpa violation, uncaught JavaScript error atau horizontal page overflow pada skenario teruji. Regresi periode akademik lulus **41 pemeriksaan / 6 axe runs**, meliputi grades, reports, promotions, survei, insights dan jadwal. Harness lama disesuaikan dengan modal grades baru dan metadata scope; assertion tanggal/tahun ajaran tetap dipertahankan. Bukti: grades/browser-results.json, check-results.json dan academic-regression/browser-results.json. Screenshot desktop/mobile diperiksa visual, tidak dikomit.

Cakupan browser: normal/kosong/30 penilaian/60 siswa/baca-saja/loading/error; 320/375/768/1440; rincian tabel pada 320; input modal, KKM landscape 812×375, batch 768×375 dan footer terjangkau; zero/null dan KKM0/100; prefill existing non-PH/ID/reason; koreksi dari tahun/kelas/mapel lain tanpa filter aktif, score di luar katalog tetap; Genap Januari–Juni tahun kedua dan penolakan tanggal di luar semester; context failure/retry/revision mismatch; student filter tidak menyusutkan batch; pencarian sesuai student scope; pencarian formulir tidak memicu dirty guard/submit saat Enter; desimal invalid di halaman tersembunyi ditolak sebelum network; pagination/search menjaga seluruh 60 isian; void/reference/reason/fallback focus; dirty/pending Escape; single write pada double click; failed read preserves snapshot; uncertain dan timeout 30 detik mencegah blind retry.

Integrasi DB memverifikasi ownership/jadwal, null/zero, PH sequence tidak dipakai ulang, snapshot KKM, non-PH upsert, subset correction mempertahankan score/notes yang tidak dikirim, KKM baru100 tanpa mengubah assessment lama, Praktik0/100 terpisah dari final berbobot, immutable published report, role/student/parent/head scope, idempotency/stale/revoked session/RLS serta batas periode akademik. Tidak ada transaksi produksi atau penerbitan ulang rapor dilakukan selama QA.

Batas: browser/Auth/SDK sintetis, bukan authenticated production CRUD setiap role, perangkat fisik atau manual screen reader. PGlite menguji migrasi/kontrak tanpa ekstensi native pg-safeupdate; singleton predicate regression tetap dijalankan. Katalog read existing maksimal 2.000 people dan command maksimal 500 siswa/batch; roster di atas 500 meminta perbaikan cakupan, tidak dipotong diam-diam. Perubahan enrollment/permission setelah read tetap diperiksa backend. Tidak menambah kebijakan baru untuk D10. Gulir vertikal halaman/modal dan gulir lokal tabel adalah perilaku normal untuk menjaga konten tetap terjangkau; tidak menutupi overflow global. Tidak mengklaim seluruh kemungkinan bug di luar skenario teruji telah hilang.
