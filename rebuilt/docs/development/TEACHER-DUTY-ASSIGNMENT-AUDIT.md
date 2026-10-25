# Audit Guru Piket dan tugas tambahan guru

25 Oktober 2026 WIB. Baseline main `eca856191747249e940cf99f802af82889bdde7a` (PR68). Branch `fix/teacher-duty-assignment-audit`.

## Alur dan batas akses

Principal dan sesi server → gate keamanan/survei → pemeriksaan halaman melalui snapshot akses → API dengan origin/DTO/ukuran body → RPC service-only yang memeriksa sesi/otorisasi lagi → domain write dalam transaksi, revision dan request receipt → audit → readback tervalidasi. Identitas aktor bukan input formulir. Tidak ada GAS pada alur ini.

| Tugas | Sumber dan pemeriksaan |
| --- | --- |
| Guru Piket | Tugas `duty_teacher` yang berlaku + roster hari sekolah + sesi piket terkonfirmasi pada tanggal WIB hari ini |
| Guru Piket Pengganti | Penunjukan harian berbeda dari guru utama; konfirmasi admin terpisah; guru yang digantikan harus tetap guru aktif dengan tugas/roster hari itu |
| Kepala Madrasah | Tugas `school_head` aktif; akses baca madrasah dan fungsi survei/rencana aksi existing; tidak otomatis menjadi admin, bendahara atau pengelola tabungan |
| Bendahara Komite | Tugas `committee_treasurer` aktif untuk pengelolaan keuangan; Kepala tanpa tugas ini hanya membaca |
| Pengelola Tabungan | Tugas `savings_manager` aktif; flag rekening pribadi tidak memberi pengelolaan ledger |
| Guru Wali | Tugas `student_mentor` aktif + relasi siswa bimbingan yang belum dicabut; laporan milik guru lain tidak bisa dikoreksi |
| Guru BK | Tugas `counselor`; notifikasi baru memeriksa peran guru aktif. Jalur Poin Siswa mengikuti `app_point_access` existing (guru aktif bisa membaca/mencatat kejadian, administrasi katalog/reset tetap admin) |
| Wali Kelas | Referensi kelas atau tugas scoped `homeroom_teacher`; peran guru aktif dan kelas sesuai cakupan; baca iuran tidak memberi hak transaksi |

Diperiksa: user_assignments/catalog, permission_rules/access_snapshot/access_allowed, app_education_task/admin, onboarding/session, page policy/navigation, dashboard plan/projections, Direktori dan Kelola Tugas Tambahan/API/receipt, Kelas dan Siswa/class_access, roster/sesi utama/pengganti, API operations dan reader/writer/enrichment wrappers, attendance_access, mentor_access/reports, finance managers/savings flags, laporan rapor/publish, point_access/point_notify, ekspor dan audit. Spesifikasi D05, matriks kesetaraan, keputusan bisnis, roadmap P01–P12 dan audit terdahulu menjadi acuan. Tidak mengubah D01/D02/D03/D10.

## Temuan dan perbaikan

1. **Penunjukan pengganti menerima tugas utama yang kedaluwarsa/dicabut/belum mulai**, asalkan roster lama masih ada. Predicate `duty_eligible` dipakai pada penunjukan, konfirmasi dan pemeriksaan izin absensi harian.
2. **Konfirmasi pengganti tidak memeriksa ulang sumber penugasan**. Akses terkonfirmasi kini tidak berlaku bila peran/tugas/roster guru utama tidak lagi sah; pembatalan sesi utama karena tidak hadir tetap memungkinkan pengganti, selama tugas dan roster sah.
3. **Transisi cancelled → unconfirm → pending bisa menghidupkan kembali penunjukan**. Unconfirm hanya untuk confirmed, confirm hanya pending substitute, cancel tidak untuk cancelled. Aktivasi ulang harus lewat penunjukan eksplisit; revision/receipt/audit wrapper tidak diganti.
4. **Cleanup roster/bimbingan kosong ditolak setelah tugas berakhir**. Admin dapat mengosongkan jadwal/relasi tanpa menyalakan kembali tugas, termasuk bila checkbox assignTask masih terpilih. Target tetap guru aktif sesuai kontrak existing.
5. **Pemberian tugas implisit tanpa batas menimpa periode tugas masa depan secara logis**. Pemberian dari roster/bimbingan diakhiri sebelum tanggal mulai tugas masa depan terdekat. Penguncian profil target menyelaraskan serialisasi dengan pengelolaan tugas tambahan; tidak menghapus riwayat.
6. **Wali Kelas memiliki grant baca iuran kelas, tetapi reader hanya mengizinkan diri/anak/pengelola/Kepala**. Predicate khusus Wali Kelas dipakai pada katalog siswa, pembayaran, ringkasan dan ekspor; kelas lain serta transaksi tetap ditolak. Relasi siswa menggunakan enrollment aktif pada tahun ajaran aktif.
7. **Referensi homeroom/jadwal lama bertahan setelah perubahan peran**, sehingga akses kelas/rapor bisa tetap diberikan kepada mantan guru. Peran guru aktif diperiksa pada absensi, iuran, pembacaan draft/arsip rapor serta penerbitan rapor. Kebijakan histori rapor, formula dan snapshot immutable dipertahankan.
8. **Notifikasi kedisiplinan menggunakan referensi Wali/BK tanpa memeriksa kembali peran guru**. Mantan/nonaktif guru tidak lagi dipilih sebagai penerima berdasarkan referensi tugas lama. Penerima siswa/orang tua sah, dedup dan mekanisme outbox dipertahankan; tidak ada pengiriman nyata saat tes.
9. **Halaman Poin Siswa tidak tampil bagi guru/Guru BK walaupun RPC existing mengizinkan baca guru**. `discipline.read` pada snapshot guru diselaraskan dengan predicate backend existing; tidak menambah hak administrasi katalog/reset atau mengubah aturan pencatatan poin.
10. **UI roster menampilkan guru bertugas tidak aktif sebagai kandidat konfirmasi**, dan label counselor masih berupa kode mentah. Metadata `active` additive dipakai untuk pilihan/tanda roster; jadwal lama tetap terlihat agar admin dapat membersihkannya. Label Guru Wali/Guru BK diseragamkan. Snapshot lama tetap dapat dibaca (default active true), sedangkan server tetap otoritas.

## Implementasi

Migrasi `20261025152242_teacher_duty_assignment_guards.sql` menambah tiga predicate private SECURITY INVOKER/search_path kosong, service-only; mengganti fungsi terkait dengan kontrak argumen/hasil yang sama. Tidak menambah tabel, role, auth architecture, dependency atau melakukan backfill/penghapusan data. Wrapper read operasi (slip/enrichment), request/revision/idempotensi, audit dan ledger existing dipertahankan. File migrasi memuat definisi lengkap fungsi efektif untuk review, bukan mengedit migrasi lama.

UI: `duty-panel.tsx`, `operations/duty.ts`, `education/directory.ts`.
QA: `tests/database/teacher-duty-guards.test.mjs`, fixture/script Duty; script menjalankan AlertDialog aplikasi yang aktual, bukan asumsi native confirm, dan menerima semantics feedback status/alert existing. `package.json` memasukkan regresi baru ke check; hitungan migrasi di tes fondasi/restore dan schema snapshot diperbarui (48 migrasi, tetap 82 tabel).

## Bukti verifikasi

- Replay baseline sebelum patch: 8 dari 9 tes reproduksi saat itu gagal; setelah patch regresi diperluas menjadi 11 tes dan seluruhnya lolos.
- Regresi memeriksa masa berlaku/revoke/future, konfirmasi ulang sumber, state transition, cleanup kosong, periode tugas masa depan, union tugas tanpa admin, sesi palsu, batas kelas Wali, perubahan peran dan rapor, penerima notifikasi serta ACL predicate private.
- Browser Duty: 155 pemeriksaan dan 9 scan axe lolos; readonly/empty/large/loading/error, viewport 320/375/390/768/1440, modal/landscape, keyboard/focus, draft, konfirmasi/penolakan/timeout, filter/pagination/ekspor serta roster inactive. Tidak ada uncaught JavaScript error dalam skenario tersebut.
- TypeScript/lint, suite operasi/keuangan/rapor/bimbingan/penugasan dan seluruh check diverifikasi; hasil final dicatat di verification.json.
- Pemeriksaan cloud hanya read-only: lima RPC domain yang diperiksa adalah invoker dan tidak bisa dieksekusi anon/authenticated. Advisor cloud memiliki 68 info RLS private tanpa policy (deny-by-default) dan satu warning konfigurasi leaked-password yang sudah ada; tidak mengubah konfigurasi Auth dalam pekerjaan ini.

## Status rilis dan keterbatasan

Kode dan migrasi disiapkan lokal pada branch pengembangan. **Belum dibuat PR, belum di-merge, dan migrasi belum diterapkan pada Supabase produksi.** Perbaikan SQL memerlukan deployment migrasi tersebut agar efektif pada aplikasi live. Tidak membuat/mencabut tugas guru atau transaksi nyata. Fixture SQL memakai PostgreSQL PGlite, fixture UI mengintersep API; UAT sesi pengguna produksi, perangkat fisik, dan concurrency pada PostgreSQL cloud belum dilakukan. Tidak mengklaim semua kemungkinan bug atau kesiapan produksi 100% sudah terbukti.

Advisor referensi: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy dan https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
