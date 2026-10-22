# Audit Poin Siswa — 23 Oktober 2026 (Asia/Jakarta)

## A. Temuan

- Panel generik mencampur form kejadian, katalog, pengaturan dan arsip. Input bulan berupa tanggal bebas berisiko ditolak saat bukan tanggal 1. Filter dan mutasi tidak berbagi lock; respons pembacaan terlambat dapat menimpa state lebih baru.
- Pilihan siswa berasal dari hasil laporan yang telah difilter; filter kelas dapat menyembunyikan siswa untuk pencatatan. Sebaliknya, katalog awal saja tidak cukup ketika berganti bulan/tahun ajaran dengan susunan siswa berbeda.
- Snapshot generik belum memeriksa identitas siswa/periode, saldo/delta, duplikasi event dan bentuk katalog/pengaturan. Join user_roles pada RPC read dapat mengulang baris siswa dengan beberapa role, menggandakan kartu dan rekap ekspor.
- Write lama hanya result/message, belum memerlukan snapshot terbaca kembali sebelum sukses. Gagal baca sesudah write bisa membuat retry dengan UUID baru tanpa kepastian hasil; belum ada timeout dan penguncian hasil tak pasti.
- Poin negatif pada form katalog tidak memiliki batas angka yang sesuai; label mentah dan form panjang menyulitkan pemahaman. Pengaturan dapat mengosongkan subjectId tersimpan jika mapel nonaktif sudah tidak ada dalam daftar pilihan.
- Pembatalan memakai prompt tanpa pengelolaan fokus dan alasan yang jelas. Tampilan tindakan harus mengikuti admin/pembuat yang masih dapat mencatat serta status arsip; isManager adalah hak survei dan tidak boleh digunakan untuk memberi hak pengelolaan poin.
- Arsip/sinkronisasi belum memiliki konfirmasi yang menjelaskan bulan dan sifat immutable/idempotent. Penerima sertifikat kosong menjadi error layanan generik. PDF membutuhkan label kolom dan pemecahan token nama panjang agar tidak keluar halaman.

## B. Analisis dan perbaikan

Dibaca sebelum modifikasi: seluruh blok discipline panel generik; ServicesPage/ServicesPanel dan dependencies domain controls, Dialog, TableRegion, confirmed mutation; route services dan batch exports; validation/server/export; M15 dan kebijakan final; SQL event/catalog/replay/access, notifications/reset/affective/ranking, read analytics dan override write singleton terbaru. Tidak mengubah backend/domain lain untuk kepentingan visual.

Alur: principal/session server → onboarding/survey gate → servicesData → RPC scoped → snapshot; filter bulan/kelas → read; modal → command schema → UUID+revision → write atomik → readback → UI. Event memakai katalog snapshot, replay tanggal/ordinal, queue notifikasi pada write, pembatalan memicu replay saat dibaca. Arsip immutable, sinkron afektif memakai snapshot/mapel dan melewati duplikat.

- DisciplinePanel khusus menggantikan cabang generik; helper generik yang tidak lagi dipakai dihapus. Modul survei/insights/jobs/reconciliation mempertahankan handler existing; Notifikasi tetap panel sendiri. Key user/revision/month mencegah state identitas/periode SSR lama terbawa.
- Modal kejadian/katalog/pengaturan/arsip/pembatalan memakai komponen dan tokens existing, kontrol 44px, dirty/pending guard, focus trap/return/fallback, status lokal dan batas tinggi viewport. Tabel riwayat memakai scroll lokal; nama/catatan panjang wrapping; kartu siswa searchable dan pagination 10 siswa.
- Bulan laporan memakai month input dinormalisasi YYYY-MM-01. Filter khusus month/classId/studentId menormalkan blank dan menolak field/periode invalid sebelum write. Read/write terkunci, timeout/abort read, respons gagal mempertahankan snapshot sebelumnya.
- servicesData membentuk katalog recordingStudents dari data bulan yang sama. Bila laporan difilter kelas/siswa, membaca ulang cakupan tanpa filter kelas/siswa melalui principal/session dan RPC yang sama, dengan revision dan bulan identik. UI memakai katalog ini sehingga filter tidak mengurangi opsi, sekaligus memperbarui siswa saat berganti bulan. Tidak menambah/memperluas izin atau mengubah SQL. Perubahan periode kejadian ke luar bulan laporan diberi pemberitahuan; backend tetap memvalidasi enrollment sesuai tanggal.
- parseDiscipline menormalkan hanya baris siswa/kelas identik yang berulang akibat join role. Snapshot yang bertentangan ditolak. Schema memeriksa integer/rentang saldo, referensi siswa/bulan, event IDs unik, tanggal bulan dan before + delta = after. Tidak menghitung ulang rumus poin di frontend.
- POST discipline tetap result/message, ditambah code/data setelah acknowledgement dikenal dan snapshot readback valid. Unknown ack, malformed upstream, catalog revision mismatch atau readback gagal menjadi 503; hook confirmed mempertahankan draf dan memblokir retry buta. Stale/not_found/request_conflict/denied meminta reload. Domain service lain tetap memakai kontrak lama.
- Event form memuat tanggal/kode aktif/keterangan dan siswa periode; validasi tanggal tidak melewati hari ini. Deskripsi/konsekuensi event berasal dari katalog saat kejadian dicatat, bukan katalog terkini. Pembatalan modal meminta alasan minimal 3 karakter dan konfirmasi; tidak muncul untuk arsip, pembaca, atau penulis lain yang bukan admin.
- Katalog edit memulihkan seluruh field, angka negatif −100..100, status nonaktif, mempertahankan kode asal dan meminta konfirmasi overwrite. Pengaturan memulihkan threshold/kanal/mapel; mapel tersimpan yang nonaktif ditampilkan sebagai opsi tersimpan sehingga perubahan pengaturan lain tidak menghapus referensinya.
- Arsip hanya bulan yang telah berakhir; arsip/sinkronisasi meminta konfirmasi bulan/tindakan. Acknowledgement menampilkan jumlah added termasuk 0. Server tetap otoritas validasi dan idempotency. Command rebuild tetap tersedia pada API existing; tidak ada fitur/API yang dihapus.
- Ringkasan membedakan siswa, pelanggaran, apresiasi dan arsip. Riwayat menunjukkan saldo sebelum/sesudah, delta/pengali, R02/R03 dan konsekuensi. CSV/Excel/PDF/sertifikat tetap mengikuti scope/periode/kelas. Pencarian lokal tidak diam-diam mengubah cakupan ekspor. PDF discipline menambah header dan memecah token panjang; perubahan formatter domain lain dihindari. Sertifikat tanpa penerima menghasilkan pesan 404 yang jelas.

Tetap: SPK-1.0; saldo awal 50, clamp −50..100; A–E negatif kode sama pengali 1/2/3, kejadian keempat R03 saldo 0, poin positif sesudahnya tetap berlaku; urutan tanggal/ordinal; immutable catalog snapshot; role/parent/mentor/homeroom scope; notifikasi/dedup; ranking/tie deterministik; rumus nilai afektif; auth/session/RBAC/RLS. Tidak ada migrasi, perubahan database, API/RPC yang dihapus, atau email/WA produksi yang dikirim.

## C. File final

| File | Alasan |
| --- | --- |
| src/app/account/services/[module]/discipline-panel.tsx | Panel/modal, state, filter, konteks siswa, riwayat, katalog/pengaturan/arsip/cancel |
| src/app/account/services/[module]/panel.tsx | Dispatcher khusus dan hapus cabang generik discipline |
| src/app/account/services/[module]/page.tsx | Retry boundary discipline dan min-width responsive |
| src/lib/services/discipline.ts | Schema, normalisasi role duplicates, filter dan hak tombol pembatalan |
| src/lib/services/server.ts | Validasi upstream dan katalog siswa per bulan/cakupan/revision |
| src/app/api/services/[module]/route.ts | Filter sebelum mutation, confirmed ack/readback, added count dan 404 sertifikat kosong |
| src/lib/services/export.ts | Header PDF dan wrapping khusus discipline |
| src/app/globals.css | CSS scoped kontrol/wrapping/dialog |
| tests/points.test.mjs | Actual route/page/server/schema/export dengan Auth/SDK sintetis |
| tests/notifications-page.test.mjs | Fallback domain lain diuji pada jobs; discipline kini memakai retry boundary |
| tests/ui/points-fixture.tsx + points-navigation-shim.ts | Actual panel/shell dan data sintetis |
| scripts/verify-points.mjs | Browser/axe/geometry/keyboard/CRUD/error/timeout |
| package.json | Points test/browser dan integrasi check |
| docs/design-system/MASTER.md + docs/verification/points* | Pedoman, audit dan hasil QA |

## D. Validasi

`npm ci` dan final `npm run check` lulus **352/352 tes / 44 kelompok runner**. TypeScript, ESLint tanpa warning, unit/route/integrasi database, generated types 14 tabel dan production build lulus. **16 tes khusus Poin Siswa** memakai route/page/server/schema/CSV/XLSX/PDF/sertifikat aktual, dengan boundary Auth/SDK sintetis. Audit source graph tidak menemukan unreachable source; diff check lulus.

Browser lulus **66 pemeriksaan / 8 axe runs**, tanpa violation, uncaught JavaScript error atau horizontal page overflow dalam skenario teruji. Regresi Notifikasi lulus **55 pemeriksaan / 7 axe runs**. Hasil machine-readable: points/browser-results.json, points/check-results.json dan points/notifications-regression/browser-results.json. Screenshot desktop/mobile diperiksa visual, tidak dikomit.

Cakupan: 320/375/768/1440; normal/kosong/80 siswa/baca-saja/teacher/loading/error; expanded event table pada 320; modal kejadian; katalog 320×568 dan landscape 812×375 dengan footer terjangkau; cancel 768×375; keyboard/Tab/Escape/dirty dismissal/pending dismissal/fallback focus; satu write saat dua klik; kode aktif/nonaktif dan poin negatif; pengaturan/mapel nonaktif; arsip bulan berjalan ditolak dan bulan lalu tepat; sinkron afektif; class filter tidak menyempitkan input; month change memperbarui siswa historis; read failure mempertahankan snapshot; search/pagination/empty; cancel ownership/archive; known archived error; network-uncertain dan timeout 30 detik memblokir retry buta.

Integrasi DB existing memverifikasi seed 25 kode, replay 50→48→44→38→0 lalu +5→5, pembatalan/ownership dan replay stabil, snapshot katalog, scope parent/stranger, arsip immutable/reset idempotent, notifikasi dedup/verified email, ranking/sertifikat scoped, nilai afektif dari snapshot dan peran/RLS. Tidak mengganti rumus SPK di frontend.

Rangkaian awal menemukan ekspektasi lama bahwa discipline memakai fallback statis; tes tersebut kini memakai jobs untuk membuktikan domain lain tetap, sedangkan retry boundary discipline diuji pada suite baru. Import relatif library baru dibuat eksplisit .ts agar kompatibel dengan runner produksi Node dan Next. Setelah koreksi, suite produksi dan seluruh check dijalankan ulang hingga lulus. Tidak ada hasil gagal yang diklaim lulus.

Batas: browser dan route memakai fixture/Auth/SDK sintetis; belum authenticated production CRUD per role, perangkat fisik, manual screen reader atau pengiriman inbox/WA nyata. PGlite menjalankan migrasi/kontrak tanpa ekstensi native pg-safeupdate; predicate regression tetap diuji. Katalog siswa mengikuti enrollment bulan laporan dan hak baca existing; perubahan enrollment/role setelah read tetap diperiksa backend dan revision. Deduplikasi identik diterapkan di servicesData, tidak mengubah hasil mentah SQL untuk pemanggil di luar service ini. Kalender/arsip lama tidak dimodifikasi. Scroll vertikal halaman/modal dan scroll lokal tabel adalah perilaku yang dibutuhkan; tidak menyembunyikan konten lewat overflow hidden global. Tidak mengklaim semua kemungkinan bug di luar skenario teruji telah hilang.
