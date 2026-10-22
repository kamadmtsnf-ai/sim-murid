# Audit Guru Wali dan bimbingan — 22 Oktober 2026 WIB

Basis main `b8412891cf1e316b627b22e0450b742d34079c94` (PR21); branch `fix/mentoring-audit`.

## A. Temuan dan pembacaan sebelum perubahan

Ditelaah halaman operations SSR, seluruh panel generik (termasuk fees helper yang diimpor), API GET/POST, operationsData, DTO/filter/snapshot, mutation hook, ekspor Excel/PDF, Dialog/TableRegion/kontrol/Button, WorkspaceShell dan CSS. Spesifikasi M05 (Guru Wali berbeda dari Wali Kelas), matriks role dan keputusan bisnis dibaca. Ditelusuri app_mentor_access, app_mentoring_mutate, app_operations_read/write beserta wrapper slip dan override singleton terbaru, tabel/index/RLS, serta tes integrasi operasi. Alur ini memakai Supabase RPC; tidak ada Google Apps Script.

Temuan:

1. Form penugasan replacement memakai people dari hasil filter riwayat. Siswa di luar filter/katalog aktif tidak dirender sebagai checkbox; menyimpan daftar tersebut dapat melepas siswa yang tidak terlihat.
2. Checkbox penugasan uncontrolled hanya diremount saat teacher berubah. Sesudah save/refresh, defaultChecked dapat tertinggal; siswa yang masih memiliki guru lain tetap dapat dipilih sehingga konflik baru diketahui saat submit.
3. Form hafalan/perkembangan selalu memuat kontrol campuran. Predikat/deskripsi/aspek tidak jelas wajibnya; master dapat tersisa saat jenis berganti. Koreksi report tidak mensyaratkan reason di schema API, meskipun SQL wrapper sudah mewajibkannya.
4. Filter native mengirim start/end/studentId kosong yang ditolak schema optional. Pagination tidak memakai lock sinkron yang sama dengan write. Filter/pagination dapat menimpa state hasil aksi lain.
5. Save menampilkan pesan sebelum refresh tervalidasi dan membuka retry setelah hasil network tidak pasti. Tidak ada timeout/blokir stale yang bertahan; snapshot record bebas tidak memvalidasi bentuk laporan/assignment.
6. Koreksi inline tidak mengelola fokus/draf; pembatalan tidak meminta konfirmasi. Tabel menggunakan kolom nominal/saldo lintasmodul dan tidak menampilkan Guru Wali secara jelas. Kontrol mobile, wrapping dan feedback perlu dirapikan.

Alur tetap: principal/session terverifikasi → survey gate API → bounded JSON dan schema → app_operations_write dengan request UUID/revision. Database mengunci operations_state, memeriksa replay/stale/role/task, lalu mutate dan audit atomik. Penugasan admin mengganti seluruh daftar guru; satu siswa hanya satu mentor aktif, maksimal 500 siswa. Konflik replacement rollback seluruh perubahan. Guru hanya mengubah laporan miliknya pada siswa bimbingan sah; siswa/orang tua membaca diri/anak sesuai scope. Void mempertahankan arsip, tidak hard-delete. Katalog hafalan aktif menentukan subject; predikat hafalan dan deskripsi perkembangan wajib. Tidak ada migrasi/perubahan SQL, auth, RLS/RBAC, data produksi atau dependency.

## B. Perbaikan

- MentoringPanel khusus menggunakan tokens/komponen existing. Cabang mentoring lama di GenericOperationsPanel dihapus, pemanggil OperationsPanel tetap kompatibel. Modul lain dipertahankan.
- Penugasan terpisah dari riwayat/filter laporan. Selected IDs controlled diprefill dari seluruh extra.assignments guru, termasuk siswa di luar katalog people. Pencarian hanya menyaring tampilan, tidak selected IDs/payload. Siswa milik guru lain diberi label dan checkbox disabled. Empty replacement memerlukan konfirmasi; pilihan >500 diblokir, assignTask tetap opsional. Pergantian guru/penutupan dialog menghormati draf; pencarian sendiri tidak menandai perubahan data.
- Form input/koreksi dalam Dialog existing. Jenis hafalan menampilkan master/alternatif dan predikat; perkembangan menampilkan aspek dan deskripsi. Catalog/predicate tidak dikirim sebagai hafalan ketika kind development. Master historis yang tidak aktif ditandai, pengguna memilih master aktif atau alternatif sebelum koreksi; void hanya membutuhkan alasan sehingga tetap dapat membatalkan laporan lama.
- Validasi reason report ber-ID sekarang sesuai SQL (minimal 3 karakter) sebelum write. Tanggal form dibatasi sampai today WIB dan server tetap memvalidasi tanggal/role/membership/katalog.
- Filter khusus year/start/end/studentId/page/export menormalkan blank dan memvalidasi rentang efektif maksimal 366 hari, termasuk default tahun, sebelum write. Kontrol filter tidak menampilkan opsi yang tidak didukung query SQL.
- Memakai useDomainMutation confirmed existing: lock sinkron, schema payload, timeout 30 detik, snapshot baru sebelum sukses, draf tetap saat gagal, stale/not_found/request_conflict/denied/hasil tak pasti meminta reload tanpa retry otomatis. Read mempunyai timeout, mounted guard dan lock yang sama; read gagal tidak mengosongkan riwayat terakhir.
- Mentoring POST mempertahankan result/message dan menambah code/data seperti Duty/Attendance. Ack unknown/malformed atau upstream read malformed diperlakukan sebagai kegagalan layanan. Response non-Duty/non-Attendance/non-Mentoring tetap kontrak lama. Snapshot memeriksa UUID/jenis/metadata/revision aman/duplikasi serta canAssign; outage mentoring masuk error boundary retry existing.
- Tabel hanya kolom laporan: tanggal, siswa/guru, jenis, hafalan/aspek, predikat, catatan, tindakan. Empty/loading/error/success eksplisit; export memakai filter dan scope existing. Focus trap/return focus (fallback ke judul filter bila baris hilang sesudah void/koreksi), error feedback di dalam dialog, guard pending Escape/dismiss, konfirmasi void, pembungkus min-width 0, teks panjang wrap, tabel scroll lokal, kontrol 44px dan modal scroll dalam viewport.

## C. File final

| File | Alasan |
| --- | --- |
| src/app/account/operations/[module]/mentoring-panel.tsx | UI/state laporan dan penugasan, dialog, search pilihan, filter/pagination/export |
| src/app/account/operations/[module]/panel.tsx | Delegasi dan penghapusan cabang mentoring lama |
| src/app/account/operations/[module]/page.tsx | Kegagalan layanan mentoring memakai retry boundary |
| src/lib/operations/mentoring.ts | DTO snapshot, filter dan pesan khusus |
| src/lib/operations/validation.ts | Reason koreksi report sesuai aturan server existing |
| src/lib/operations/server.ts | Validasi snapshot upstream mentoring |
| src/app/api/operations/[module]/route.ts | Filter sebelum write, confirmed ack/snapshot dan pesan mentoring |
| src/app/globals.css | CSS scoped controls/wrapping/dialog |
| tests/mentoring.test.mjs | Actual route/page/schema/export dengan boundary Auth/SDK sintetis |
| tests/database/operations.test.mjs | Regression rollback assignment konflik dan revision tidak berubah |
| tests/ui/mentoring-fixture.tsx + mentoring-navigation-shim.ts | Fixture komponen nyata, tanpa route/login fiktif |
| scripts/verify-mentoring.mjs | Browser, axe, geometry, input/assignment/correction/error/timeout |
| package.json | Perintah test/browser mentoring dan integrasi ke check |
| docs/design-system/MASTER.md | Pedoman mentoring sesuai design system existing |
| docs/verification/mentoring-audit.md + mentoring/*.json | Audit dan bukti hasil terukur |

## D. Validasi

`npm ci` dan `npm run check` lulus **310/310 tes**, **41 kelompok runner**, termasuk **8 tes API/schema/page/export mentoring baru** dan **1 tes database rollback baru**. TypeScript, ESLint tanpa warning, integrasi DB terisolasi, generated DB types 14 tabel dan production build lulus. Browser mentoring **87 pemeriksaan / 7 axe runs** lulus, nol violation, uncaught JavaScript error dan horizontal page overflow dalam skenario teruji. Regresi browser Absensi **84 pemeriksaan / 6 axe runs** lulus. Lint serta build/TypeScript diulang sesudah perbaikan fallback fokus; audit source unreachable kosong dan git diff --check lulus.

Browser mencakup normal/kosong/banyak/read-only/guru/loading/error; viewport 320/375/768/1440, modal 320×568, landscape 812×375/resize desktop. Prefill penugasan penuh, hidden selected IDs sesudah search/filter, siswa di luar katalog, konflik guru lain, assignTask, clear-all confirmation, draf saat ganti guru, hafalan master/alternatif dan perkembangan, required fields/reason, double submit, koreksi/void, fokus keyboard/Escape/Tab, footer dapat digulir, pending dismissal, pagination/export, read failure, invalid/duplicate/stale/denied/network/malformed dan timeout 30 detik. Aktivasi input melalui touch browser teruji; bukan perangkat fisik.

Node route tests memanggil route/page/parser/export aktual dan hanya mengganti boundary Auth/SDK; memeriksa actor/session server, command, filter sebelum RPC, hak akses/survey/Origin, konflik, uncertain reads, schema metadata/duplikasi, byte XLSX/PDF aktual dan outage boundary. Tes DB membuktikan konflik assignment tidak melepas penugasan sebelumnya dan tidak menaikkan revision, serta izin guru/anak/siswa, pencabutan assignment, audit, replay/stale dan RLS.

Batas: browser memakai fixture dan respons API sintetis, bukan authenticated production CRUD setiap role atau manual screen-reader/perangkat fisik. PGlite menguji kontrak/migrasi, bukan ekstensi C pg-safeupdate native. Katalog people tetap batas server existing 2.000 profil aktif; pilihan assignment yang tidak ada dalam katalog dipertahankan agar tidak terhapus diam-diam, tetapi status siswa/guru tetap diverifikasi server dan dapat memerlukan pembaruan status/reload. Tidak memperluas hak untuk mengelola guru nonaktif. Gulir vertikal halaman/modal serta gulir lokal tabel tetap normal. Tidak mengklaim bebas semua bug di luar skenario teruji.

Kendala lokal: cache Turbopack generated dibersihkan sebelum check/build agar tidak memakai cache tersimpan yang rusak. Locator label field required pada harness memakai accessible textbox name; tidak mengubah validasi aplikasi untuk meloloskan test. Screenshot/failure diagnostic dan data pribadi tidak dimasukkan commit.
