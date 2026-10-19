# Tahap 7 — Otorisasi dan RLS fondasi

## Hasil

Sumber izin berada pada database: role yang sah, assignment aktif menurut tanggal WIB, scope kelas dan flag fasilitas. API/halaman menggunakan user-scoped client dan RPC yang sama; tidak membaca role dari user_metadata, DTO, nama menu atau spreadsheet. Capability tidak dikenal ditolak, termasuk untuk Admin.

- `/account/access` dan `/api/auth/access`: konteks izin akun sendiri. `requireCapability` pada server memakai RPC kanonis; owner/class wajib berasal dari record database, bukan klaim payload. Pemeriksaan izin bukan pengganti validasi/gate/audit transaksi modul.
- Empat tabel identitas (`profiles`, `user_roles`, `user_access_flags`, `user_assignments`): pengguna membaca miliknya, Admin membaca sesuai administrasi.
- `classes`: Admin/Kepala membaca seluruh, wali membaca kelas penugasan aktif atau homeroom eksplisit yang tidak diarsipkan. Penugasan kosong tidak otomatis berarti semua kelas bagi wali.
- `school_profile`: hanya Admin/Kepala. Delapan katalog/reference: hanya pengguna dengan sesi dan role sah.
- Semua grant client bersifat SELECT. INSERT/UPDATE/DELETE tetap ditutup, termasuk untuk Admin, hingga RPC mutasi modul beserta audit/validasi tersedia. Tidak memberi admin akses tulis langsung tanpa audit.
- Tabel private tetap tanpa grant client. USAGE schema private dan EXECUTE dua helper diberikan khusus untuk evaluasi policy; schema private tidak dimasukkan Data API.

## Pengamanan helper

Satu helper SECURITY DEFINER `sim_murid_private.access_snapshot()` diperlukan untuk membaca registry private tanpa membuka tabel dan tanpa rekursi policy profiles/roles. Tidak menerima argumen caller; selalu membaca auth.uid + session_id JWT, memeriksa profil active, Auth session aktual, registry/TTL, dan role database. Search_path kosong, nama objek qualified, PUBLIC/anon EXECUTE dicabut. Helper terisolasi di schema non-API. Helper predicate/public RPC lain SECURITY INVOKER. RLS identitas/reference menggunakan initPlan untuk predicate yang tidak bergantung row.

## Cakupan modul lanjutan

Katalog aturan menguraikan hak global/own/class untuk fondasi dan tugas yang relasinya sudah ada. Kepala tanpa Bendahara tidak mengelola iuran; Admin tanpa tugas Kepala tidak menulis rencana aksi; aksesTabungan tidak memberi savings.manage. Flag premium memberi hak baca buku, bukan kelola katalog.

Relasi orangtua-anak, guru-mapel, siswa-kelas, mentor-siswa, piket/pengganti hari berjalan, periode target survei, dokumen/ijazah dengan override dan scope SPK yang belum terbukti tetap default-deny sampai model modul tersedia. Jangan mengklaim policy fondasi sudah menjadi policy tabel domain yang belum dibuat. Matriks D05 tetap menjadi acuan; penambahan domain nanti harus menambah predicate relasi dan pengujiannya, bukan menggunakan owner dari request atau scope global sebagai jalan pintas. Tidak ada bucket Storage atau Realtime channel baru dibuka.

## Validasi

31 test tahap sebelumnya + 7 test otorisasi = 38 test otomatis. Test AZ01–07: metadata admin palsu, IDOR own/foreign, direct UPDATE role ditolak, anon/private denial, Admin tidak menulis rencana aksi tanpa tugas, stale role, Kepala+Bendahara, task expired/future/revoked, class/null scope, flag tabungan/premium, parent-child default deny, sesi malformed/expired/revoked/inactive serta allowlist definer.

Enam migrasi, 27 tabel RLS; 14 policy SELECT pada tabel public. Advisor: 13 INFO RLS tanpa policy pada schema private (tetap tertutup), 21 INFO indeks belum digunakan, satu WARN perlindungan password bocor belum aktif. Remediasi WARN: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Tidak mengubah paket/biaya.

## Verifikasi cloud dan batas persetujuan

Commit implementasi 3dea1fc93a9345c201565640466a37d2a2e25d62, deployment dpl_DWsQsxSHBPFf6hbrZN4MYaUe8jRK berstatus READY. Hasil HTTP negatif di stage-07-live.json: API aplikasi anonim 401, REST profiles anonim 401, RPC otorisasi anonim 401, JWT Admin palsu 401, akses schema private 406. Transaksi cloud read-only dengan role authenticated, identitas nonaktif dan metadata Admin palsu menghasilkan nol baris profiles/subjects dan context null. Grant client INSERT/UPDATE/DELETE/TRUNCATE = 0.

Uji positif akun pengguna/Admin melalui Auth/PostgREST produksi belum dilakukan. Peninjauan persetujuan otomatis menolak pengaktifan akun validasi, penggantian password dan pemberian role Admin pada proyek live karena belum ada persetujuan eksplisit untuk perubahan kredensial/privilege tersebut. Tidak mencoba jalur lain untuk mengaktifkan akun. Pemeriksaan read-only memastikan kedua akun validasi lama tetap inactive dan tanpa password.

Uji positif SQL sudah lulus pada PostgreSQL terisolasi (38 test keseluruhan), tetapi stub Auth lokal bukan pengganti bukti Auth/PostgREST aktual. Status akhir: implementasi dan pemeriksaan negatif cloud tersedia; penerimaan integrasi positif produksi masih pending persetujuan untuk fixture sementara. Uji visual browser/hidrasi belum dilakukan.

