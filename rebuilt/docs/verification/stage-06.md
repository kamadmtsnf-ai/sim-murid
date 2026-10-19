# Tahap 6 — Sesi dan perangkat

## Implementasi

- Halaman `/account/sessions`: 20 riwayat sesi terbaru milik caller, klasifikasi browser/OS umum, waktu masuk/batas sesi/terakhir diperiksa dalam WIB, status aktif/berakhir/dicabut dan penanda sesi saat ini. Tidak menyimpan raw User-Agent atau IP pada riwayat perangkat; label bukan bukti identitas perangkat.
- Pengguna dapat mencabut satu atau seluruh sesi sendiri. Admin dapat mencari username persis lalu mencabut sesi akun tersebut. Tidak ada direktori akun massal. Tombol konfirmasi mendahului pencabutan.
- RPC mengecek caller dari sesi Auth terverifikasi, registry belum dicabut/belum lewat TTL, profil active, dan role Admin aktual di database. `user_metadata` dan role dari browser tidak digunakan. Input scope one harus membawa UUID sesi aplikasi; scope all eksplisit. Target tidak pernah menjadi identitas caller.
- Satu sesi aktif tetap dipertahankan. Login menggunakan lock profil; pencabutan mengunci caller/target menurut urutan UUID dan mengecek ulang hak akses. Log mencatat actor, target, jumlah dan scope. Pencabutan ulang sesi lama idempotent tanpa log sukses palsu.
- Pemeriksaan tambahan mencocokkan `session_id` pada `auth.sessions` dan `not_after`. `service_role` hanya diberi SELECT tiga kolom id/user_id/not_after di schema Auth. Tidak ada SECURITY DEFINER atau grant anon/authenticated baru.
- Pencabutan administratif mematikan registry aplikasi segera. Refresh token Supabase bukan otoritas akses aplikasi; semua endpoint terlindungi memeriksa registry. Tahap 7 harus mempertahankan predicate registry pada jalur RLS/RPC akses domain. JWT tidak dianggap otomatis terhapus saat registry dicabut.
- Cookie refresh diteruskan ke request render, cookie response dan header private/no-store. Gangguan verifikasi Auth diperlakukan sebagai layanan tidak tersedia, bukan dianggap logout. Observasi last_seen dibatasi satu update/menit; polling hanya saat halaman terlihat dan tidak memperpanjang TTL 1/168 jam.

## Validasi

Pemeriksaan lokal mencakup 18 test database fondasi, 4 validasi auth/aksi sesi, 3 test database auth dan 4 test database sesi, selain 2 test fondasi Zod. Test sesi memeriksa IDOR/ownership, stale role, audit, revoke-all, Auth session hilang/expired, TTL tetap serta grant tertutup. Build/lint/typecheck dan HTTP smoke dicatat setelah selesai. PGlite menggunakan stub Auth untuk test SQL; integrasi Supabase Auth aktual diuji terpisah.

Migrasi cloud `session_management` versi 20261019093647 diterapkan. Tidak menambah tabel publik/domain; total 26 tabel RLS. Snapshot tipe adapter server dihasilkan ulang dari cloud.

Advisor: 26 INFO RLS tanpa policy, sesuai akses default-deny sebelum Tahap 7. Satu WARN `auth_leaked_password_protection`: perlindungan password bocor belum aktif. Remediasi: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Fitur penyedia tersedia pada paket Pro ke atas menurut dokumentasi. Tidak mengubah paket atau biaya.

## Batas tahap

Tidak membuat akun Admin pengguna nyata. Akun validasi sementara tanpa data pribadi akan dinonaktifkan, password dan sesi dicabut setelah pengujian; identitas audit tetap dipertahankan. Manajemen pengguna umum/reset password/onboarding/OTP dan izin modul menyusul tahapnya. Kebijakan password sementara dan gate wajib ganti password masih mengikuti batas Tahap 5; akses modul domain belum dibuka.
