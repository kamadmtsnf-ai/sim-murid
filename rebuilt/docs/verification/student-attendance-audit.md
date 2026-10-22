# Audit Absensi Siswa — 22 Oktober 2026 WIB

Basis main: `9fe6923c1cbfba96a78f629d1b513716474a0ae2` (PR20). Branch: `fix/student-attendance-audit`.

## A. Temuan dan analisis sebelum perubahan

Dibaca: halaman SSR/OperationsPanel, handler GET/POST operations, validasi payload/filter/snapshot, operationsData, ekspor Excel/PDF, mutation hook, Dialog, TableRegion, kontrol form/Button, WorkspaceShell dan CSS; spesifikasi M07/U09–U11, matriks akses serta keputusan bisnis. Ditelusuri SQL student_attendance, app_attendance_access/mutate, app_operations_read/write termasuk override singleton terakhir, duty confirmation dan seluruh tes integrasi operasi. Tidak ada integrasi Google Apps Script pada alur ini.

1. Kalender mengambil status dari `data.rows` riwayat yang dipaginasi 50 baris dan dapat difilter status. Hari yang tercatat di luar halaman/filter keliru ditampilkan “Belum dicatat”. Pemilihan kalender juga mengganti filter riwayat dan katalog untuk input.
2. Tombol massal mengganti key kontainer dan meremount kontrol uncontrolled, sehingga catatan/status individual hilang. Form tidak mereset konsisten sesudah penyimpanan.
3. Katalog input memakai `data.people` hasil filter riwayat; memilih seorang siswa/kelas dapat tanpa sengaja menyempitkan batch berikutnya.
4. Filter mengirim tanggal/UUID/status kosong yang ditolak schema optional. Pagination tidak memakai lock sinkron yang sama dengan write; respons read dapat menimpa state ketika aksi bersamaan.
5. Save menampilkan pesan berhasil sebelum refresh tervalidasi dan membuka retry setelah hasil jaringan tidak pasti. Tidak ada timeout/blokir konflik yang bertahan. Snapshot record bebas membiarkan status/metadata malformed masuk UI.
6. Koreksi inline tidak mengelola fokus/draf. Pembatalan hanya memakai alasan tanpa konfirmasi; form tetap dapat berubah ketika pending. Tabel memuat kolom nominal/saldo yang tidak terkait absensi; nama panjang dan kontrol mobile memerlukan pembatasan konten.

Alur bisnis tetap: sesi/principal server → survey gate API → schema/filter → RPC operations dengan actor/session/request UUID/revision. Database memeriksa konfirmasi piket sesuai tanggal, hari sekolah, enrollment pada tanggal absensi, status aktif siswa, unique siswa+tanggal, batch atomik dan hak pencatat/admin untuk koreksi. Pembatalan piket mencabut izin segera. Tidak ada perubahan SQL, RLS, autentikasi, data produksi atau rumus hari efektif. Hari kosong tidak otomatis Alpha; Sabtu tetap efektif; Minggu/libur dikecualikan. Tahun kalender rekap tidak diubah menjadi tahun ajaran.

## B. Perbaikan

- `AttendancePanel` khusus memakai tokens dan komponen existing. Cabang attendance lama di panel generik dihapus; modul lain tetap memakai alurnya. Input, ringkasan, tren, kalender dan riwayat memiliki konteks terpisah.
- Status/catatan batch controlled. Tandai Hadir/Kosongkan status mempertahankan notes; payload hanya memuat status yang dipilih. Ganti tanggal/kelas meminta konfirmasi ketika ada draf, reload/tab close memberi beforeunload. Batch sukses mereset isian; koreksi/void mempertahankan draf batch yang terpisah.
- Katalog awal tanpa filter dipakai input dan pemilih kalender/riwayat. Filter riwayat tidak mengubah roster input. Daftar memakai enrollment aktif saat halaman dimuat; server tetap memeriksa enrollment historis saat write.
- Kalender GET tambahan `?calendar=YYYY-MM&studentId=UUID` memaksa satu siswa, rentang bulan lengkap, page 1 dan mode baca lengkap. Tidak menerima campuran status/class/page/format. Memakai RPC dan izin existing; tidak menambah route atau melewati scope. UI menolak snapshot parsial/lintas-siswa/lintas-bulan/duplikat, serta menghapus tampilan lama ketika request gagal agar tidak menyimpulkan “Belum dicatat”. Leap year ditangani dengan UTC.
- Filter blank dinormalisasi, batas tahun/tanggal serta rentang efektif maksimal 366 hari divalidasi sebelum write. Read/filter/page/write/calendar mempunyai guard sinkron, timeout 30 detik dan perlindungan setState setelah unmount. Read gagal mempertahankan riwayat terakhir.
- Memakai `useDomainMutation` confirmed existing: validasi command, lock, snapshot tervalidasi sebelum sukses, draf bertahan saat error, konflik/akses dicabut/hasil tak pasti mengharuskan reload. Tidak retry otomatis setelah respons terputus.
- POST attendance mempertahankan `result/message` dan menambah `code/data`; format modul non-Duty/non-Attendance tetap. Malformed/unknown ack atau read sesudah write gagal menjadi 503. Schema attendance memvalidasi module, revision aman, pagination, status/UUID/date, nilai ringkasan/tren, holidays dan duplikasi siswa/tanggal. Upstream malformed masuk error boundary layanan, bukan dianggap salah input pengguna.
- Dialog koreksi memakai focus trap/return focus existing, reason minimal 3 karakter, konfirmasi pembatalan, guard draf dan pending dismissal. Feedback error berada dalam dialog aktif. Tabel hanya enam kolom absensi, scroll horizontal lokal, teks panjang wrap, grid responsif dan kontrol sentuh minimal 44px. Modal dapat digulir pada viewport pendek.

## C. File final dan alasan

| File | Perubahan |
| --- | --- |
| src/app/account/operations/[module]/attendance-panel.tsx | UI, state, kalender independen, input controlled, koreksi/void dialog, filter/pagination/export |
| src/app/account/operations/[module]/panel.tsx | Delegasi AttendancePanel, hapus cabang attendance lama |
| src/app/account/operations/[module]/page.tsx | Attendance outage memakai error boundary retry existing |
| src/lib/operations/attendance.ts | Schema, filter, bulan UTC, validasi kalender lengkap dan pesan relevan |
| src/lib/operations/server.ts | Validasi snapshot attendance dan klasifikasi kegagalan upstream |
| src/app/api/operations/[module]/route.ts | Baca kalender lengkap, filter sebelum write dan confirmed acknowledgement/snapshot |
| src/app/globals.css | Scoped controls/wrapping/dialog, memakai tokens existing |
| tests/attendance.test.mjs | API/page/schema/export nyata dengan boundary Auth/SDK sintetis |
| tests/ui/attendance-fixture.tsx + attendance-navigation-shim.ts | Fixture komponen nyata tanpa route/login fiktif |
| tests/ui/fixture.tsx | Fixture generik disesuaikan dengan bentuk data attendance nyata |
| scripts/verify-attendance.mjs | Browser, axe, geometri, focus/touch/CRUD/error/timeout |
| package.json | Test attendance/browser dan integrasi ke check; tanpa dependency baru |
| docs/design-system/MASTER.md | Pola UI absensi yang konsisten |
| docs/verification/student-attendance-audit.md + attendance/*.json | Audit dan bukti hasil verifikasi |

## D. Validasi dan batas

`npm ci` dan `npm run check` dijalankan: **301/301 tes**, **40 kelompok runner**, termasuk 8 tes attendance baru, integrasi database terisolasi, TypeScript, ESLint tanpa warning, generated database types (14 tabel), dan production build. Regresi browser Guru Piket: **131 pemeriksaan / 9 axe runs**, tanpa error/violation. Audit source unreachable kosong dan `git diff --check` lulus. Browser attendance final lulus **84 pemeriksaan / 6 axe runs**, nol violation/error JavaScript/overflow horizontal pada skenario teruji; footer modal pendek dapat dijangkau lewat scroll. Pengulangan lint dan production build sesudah penyesuaian draf/fokus juga lulus. Hasil final browser attendance dan pengulangan pemeriksaan UI tercatat dalam `attendance/automated-results.json` dan `attendance/browser-results.json`.

Cakupan: normal/kosong/banyak/read-only/loading/error; viewport 320/375/768/1440, 320×568 dan landscape 812×375; input status/keterangan, massal, reset sukses, larangan batch kosong, duplicate submit, koreksi/void/reason, draf independen, filter/pagination/export link, kalender penuh/holiday/future/error/parsial, fokus/Tab/Escape, pending, stale/denied/invalid/duplicate/network/malformed dan timeout. Tes route membaca byte Excel/PDF aktual; SQL integrasi mencakup batch atomik, duplikasi, tanggal/enrollment/libur, own/child/homeroom scope, pencabutan piket, replay/revision/session/RLS dan dua persentase.

Batas: browser memakai fixture dan respons API terintersepsi, bukan akun produksi setiap role/perangkat fisik/pembaca layar manual. PGlite menguji migrasi/kontrak bisnis, bukan ekstensi C native pg-safeupdate. Roster input merupakan katalog aktif saat halaman dimuat (batas server existing 2.000 orang); bukan pemilih roster historis. Koreksi data historis tetap melalui riwayat dan izin database. Perubahan keanggotaan memerlukan reload; backend memvalidasi ulang setiap write. Gulir vertikal halaman/modal dan gulir lokal tabel tetap normal; tidak mengklaim semua kemungkinan bug di luar skenario teruji sudah hilang.

Kendala QA lokal: cache Turbopack tersimpan tidak dapat dibaca ulang; cache generated dibuang sebelum build ulang tanpa perubahan config aplikasi. Locator test label select diperbaiki memakai accessible combobox name; ini bukan kegagalan event aplikasi. Tidak memasukkan screenshot/failure diagnostic atau data pribadi ke commit.
