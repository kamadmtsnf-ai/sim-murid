# Audit Iuran Komite — 22 Oktober 2026 WIB

Basis main `dabd825e386db3a65cac837349dccafc1f5ef96e` (PR22). Branch `fix/committee-fees-audit`.

## A. Temuan dan analisis sebelum perubahan

Dibaca seluruh OperationsPanel dan fees helper (helper FeeBrackets/FeePreview/SlipActions ternyata terkait tabungan, bukan iuran), SSR page, API GET/POST, validation/filter/snapshot, operationsData, mutation hook, ekspor Excel/PDF, Dialog/TableRegion/control/Button, WorkspaceShell dan CSS. Spesifikasi M09 dan keputusan bisnis termasuk penegasan tahun ajaran/tahun kalender ditelaah. Ditelusuri committee_payments/payment_allocations/tariffs, app_fees_mutate, app_fee_waiver_student/natural_key, operations_read/write, wrapper slip dan override singleton terbaru, role/session/RLS/audit, serta seluruh tes integrasi operasi. Tidak ada Google Apps Script pada alur ini.

Temuan:

1. Koreksi hanya merender bulan dari tahun filter riwayat. Pembayaran beralokasi lintas tahun dapat kehilangan bulan tahun lain saat dikirim sebagai replacement.
2. Semua bulan dapat dipilih tanpa memuat status pembayaran/pembebasan. Konflik baru diketahui dari SQL; pilihan pembayaran, nominal dan tahun tercampur dengan filter riwayat.
3. Katalog siswa input mengikuti hasil filter. Kontrol uncontrolled tidak selalu mereset sesudah save atau pergantian konteks. Tarif/nominal kurang mendapat batas native dan tidak ada total pilihan lintas tahun.
4. Filter native mengirim tanggal/UUID kosong yang ditolak optional schema; pagination tidak memakai lock sinkron write. Save menampilkan pesan sebelum refresh tervalidasi, lalu membuka retry saat hasil jaringan tak pasti.
5. Snapshot bebas tidak memeriksa integer rupiah aman, konsistensi total/alokasi, status bulanan atau duplikasi. Reason koreksi payment optional pada API, padahal SQL mewajibkannya.
6. Tabel generik memuat kolom lintasmodul yang tidak relevan. Seluruh rekap siswa×bulan dirender sekaligus, tanpa pencarian/pagination lokal. Modal/fokus/draf/pending dan kontrol mobile perlu dirapikan.
7. Riwayat ekspor tidak menyertakan rincian alokasi bulan. PDF tidak menyertakan rekap bulanan dan pemotongan string berdasarkan jumlah karakter dapat melewati margin pada teks lebar.

Alur bisnis dipertahankan: principal/session terverifikasi → survey gate → bounded JSON/schema → operations RPC dengan request UUID/revision. Admin/bendahara komite mengelola; siswa/orang tua/pimpinan membaca sesuai scope existing. Write terkunci/idempotent, atomic, diaudit; pembayaran mempunyai 1–12 alokasi unik siswa+bulan, nominal rupiah bulat positif, tanggal pembayaran tidak mendatang. Tarif nol sah dan berbeda dari tarif belum ditetapkan. Pembebasan saudara bukan uang masuk: sumber berasal dari alokasi aktif, penerima menurut kelas terendah/natural ordering dan hubungan keluarga, koreksi/void merekonsiliasi sumber atomik. Tidak mengganti aturan keluarga, rumus, semester/tahun ajaran, SQL, RLS/RBAC, autentikasi, data produksi atau dependency.

## B. Perbaikan

- CommitteePanel khusus memakai tokens/komponen existing. Cabang fees lama di panel generik dihapus, helper tabungan dipertahankan dan OperationsPanel tetap kompatibel.
- Dialog pembayaran dan tarif terpisah. Alokasi controlled keyed YYYY-MM-01; koreksi memuat seluruh alokasi awal, tahun pemilih terpisah dari filter, pilihan lintas tahun tetap terlihat beserta total dan tombol hapus eksplisit. Mengganti tahun tidak melepas pilihan.
- Konteks GET tambahan `?view=payment&year=YYYY&studentId=UUID` hanya menerima satu siswa/tahun, tidak bercampur class/start/end/page/format. Memakai app_operations_read existing, page 1; status bulanan dihitung RPC sebelum pagination sehingga tidak bergantung pada baris riwayat. Client mensyaratkan 12 bulan unik untuk siswa/tahun yang tepat dan revision sama dengan halaman. Context kosong/parsial/gagal tidak dianggap unpaid; revision berbeda meminta reload. Semua tahun alokasi koreksi dimuat, dengan timeout/abort dan lock read/write. Tidak menambah route atau melewati izin.
- Bulan paid/waived terkunci, kecuali alokasi milik pembayaran yang dikoreksi pada siswa yang sama. Backend tetap otoritas konflik/sumber pembebasan final. Tarif positif dapat mengisi nominal awal; tarif belum tersedia/0 tidak menciptakan pembayaran Rp0. Seluruh nominal dipilih tetap wajib valid dan maksimal 12 bulan. Server/schema menolak desimal, bulan duplikat, payload kosong dan koreksi tanpa reason minimal 3 karakter.
- Filter khusus year/start/end/classId/studentId/page/export menormalkan blank dan memvalidasi periode efektif sesuai batas SQL sebelum write. Katalog input awal terpisah dari filter; kelas filter diberi label kelas aktif siswa sesuai query existing.
- Penyimpanan memakai useDomainMutation confirmed existing: lock sinkron, validasi payload, timeout 30 detik, snapshot baru sebelum sukses, draf dipertahankan saat gagal. Stale/not_found/request_conflict/denied/hasil tak pasti mengharuskan reload tanpa retry otomatis. Read gagal mempertahankan riwayat terakhir. POST fees mempertahankan result/message dan menambah code/data; Savings tetap result/message saja.
- committeeSnapshot memeriksa safe integer rupiah/revision/pagination, total sama dengan jumlah alokasi, bulan/status/referensi/duplikasi serta pembedaan null vs nol. Malformed/unknown acknowledgement atau upstream malformed menjadi kegagalan layanan; SSR outage memakai retry boundary.
- Dialog menjaga draf saat ditutup, pending dismissal, alasan/konfirmasi void, dan fokus kembali ke pemicu atau judul filter jika baris hilang. Void hanya membutuhkan alasan, sehingga tidak bergantung pada kelengkapan konteks pembayaran yang hendak dibatalkan. Tarif meminta konfirmasi overwrite termasuk Rp0. Kontrol 44px, pembungkus min-width 0, wrap teks, scroll lokal tabel dan modal dalam viewport.
- Riwayat memperlihatkan alokasi bulan/nominal; ringkasan uang masuk terpisah dari pembebasan dan tunggakan diketahui. Status bulanan membedakan paid/waived/unpaid, sumber aktif, tarif null/nol dan tunggakan unknown. Rekap memakai search/pagination lokal 50 baris; tren, filter, export dan history pagination tetap tersedia.
- Formatter ekspor fees menambah rincian bulan/nominal untuk XLSX dan PDF. PDF fees menyertakan status bulanan dan membungkus teks menurut lebar font, tanpa mengubah formatter domain lain. PDF dengan lebih dari 10.000 baris rekap ditolak 413 agar pengguna mempersempit pilihan; tidak memotong data diam-diam. Batas history 10.000 existing tetap. Excel status/summary tetap memakai nilai numerik dan null yang jelas.

## C. File final

| File | Alasan |
| --- | --- |
| src/app/account/operations/[module]/committee-panel.tsx | UI/state pembayaran/tarif, konteks bulan, koreksi/void, rekap/search/pagination |
| src/app/account/operations/[module]/panel.tsx | Delegasi dan hapus cabang fees lama |
| src/app/account/operations/[module]/page.tsx | Outage fees memakai retry boundary |
| src/lib/operations/committee.ts | Schema/filter/context/month lock/pesan/format rupiah |
| src/lib/operations/validation.ts | Reason koreksi payment selaras aturan SQL |
| src/lib/operations/server.ts | Validasi snapshot upstream fees |
| src/lib/operations/export.ts | Rincian alokasi, rekap PDF, wrapping dan complete-export guard |
| src/app/api/operations/[module]/route.ts | Context scoped, filter sebelum write dan confirmed ack/snapshot |
| src/app/globals.css | CSS scoped controls/wrapping/dialog |
| tests/committee.test.mjs | Actual route/page/schema/context/XLSX/PDF dan kontrak akses |
| tests/database/operations.test.mjs | Regression koreksi lintas tahun dan rekonsiliasi pembebasan |
| tests/duty.test.mjs | Kontrak result-only diuji pada Savings; Fees kini additive dan diuji di suite khusus |
| tests/ui/committee-fixture.tsx + committee-navigation-shim.ts | Fixture komponen nyata tanpa route/login fiktif |
| scripts/verify-committee.mjs | Browser/axe/geometry/status/nominal/CRUD/error/timeout |
| package.json | Test committee/browser dan integrasi check |
| docs/design-system/MASTER.md | Pedoman UI iuran sesuai design system existing |
| docs/verification/committee-audit.md + committee/*.json | Audit, hasil dan batas pengujian |

## D. Validasi

`npm ci` dan `npm run check` lulus **321/321 tes**, **42 kelompok runner**, termasuk **10 tes committee API/page/schema/export baru** dan **1 regression database lintas tahun**. TypeScript, ESLint tanpa warning, integrasi DB terisolasi, generated DB types 14 tabel dan production build lulus. Browser committee lulus **86 pemeriksaan / 6 axe runs**, tanpa violation, uncaught JavaScript error atau horizontal page overflow dalam skenario teruji. Regresi browser Guru Wali lulus **87 pemeriksaan / 7 axe runs**. Lint diulang sesudah perbaikan harness. Audit source unreachable kosong dan git diff --check lulus.

Browser: normal/kosong/50 history rows/80 siswa×12 bulan/read-only/loading/error; viewport 320/375/768/1440; modal 320×568, landscape 812×375, resize desktop, footer scroll; checkbox paid/waived lock dan own edit exception; nominal tarif diketahui/unknown, cross-year selection/correction, total tepat, double submit, reason/void/fallback focus, context outage/incomplete/revision mismatch/retry, tarif nol/declined overwrite, dirty close, keyboard/Tab/Escape/touch, recap search/page, history read failure, export links, invalid/duplicate/stale/denied/network/malformed dan timeout.

API tests memakai route/parser/page/export aktual dengan boundary Auth/SDK sintetis. Byte Excel dibaca ulang untuk alokasi lintas tahun, kas pembebasan Rp0 dan tarif unknown. PDF valid dengan teks panjang diuji multipage; complete-export cap diuji. Database membuktikan kedua bulan lintas tahun memberi pembebasan, pembayaran duplikat untuk penerima ditolak tanpa revision berubah, koreksi melepaskan hanya sumber yang dihapus, nominal/alokasi tetap tepat dan void merekonsiliasi pembebasan. Tes operasi existing tetap mencakup scope parent/student/head/manager, sumber saudara ganda, unknown tariff, replay/stale, role/session/RLS dan atomicity.

Batas: browser memakai fixture/API sintetis, bukan authenticated production CRUD tiap role, perangkat fisik atau manual screen reader. PGlite menguji kontrak/migrasi tanpa ekstensi C pg-safeupdate native. Katalog awal tetap batas 2.000 profil aktif; kelas filter mengikuti kelas aktif existing, bukan rekonstruksi historis. Eligibility/status dinamis tetap diperiksa server; perubahan data setelah context read tetap ditolak melalui revision. Nilai di luar safe integer ditolak, tidak dibulatkan diam-diam. Gulir vertikal halaman/modal dan gulir lokal tabel adalah perilaku normal. Tidak mengklaim semua kemungkinan bug di luar skenario teruji telah hilang.

Kendala QA lokal: cache Turbopack generated dibersihkan sebelum check. Full check awal berhenti karena harness browser masih dalam proses penulisan; dijalankan ulang sesudah file lengkap dan lulus. Mock browser kini mempertahankan revision setelah write agar menyerupai state server nyata dan tidak memicu konflik palsu. Screenshot/failure diagnostic/data pribadi tidak dimasukkan commit. Browser memakai Playwright runtime, esbuild/axe dan Chromium sementara lewat UI_TEST_TOOLS/UI_CHROMIUM_EXECUTABLE, tanpa menambah dependency aplikasi.
