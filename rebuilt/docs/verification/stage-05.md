# Tahap 5 — Autentikasi username/password

Implementasi: login username/password via Supabase Auth; username exact text tanpa parseFloat/trim/case folding; identitas email Auth hanya server; tidak memakai spreadsheet, password plaintext, atau metadata yang dapat diubah pengguna untuk otorisasi.

- `/login`: validasi Zod server, tampil/sembunyikan password, status pending dan pesan error; password tidak disimpan di localStorage atau URL.
- `/api/auth/login`: same-origin POST, batas body, rate limiter PostgreSQL persisten, lookup profil via server-only secret, Supabase password check, registrasi sesi atomik.
- `/account`: getUser terverifikasi + registry/status akun; tidak mengirim email teknis atau token ke komponen client. Cookie HttpOnly, SameSite Lax, Secure di HTTPS. Proxy menyegarkan cookie dan meneruskannya ke render server.
- `/api/auth/session`: data minimal milik caller; cache private/no-store. `/api/auth/logout`: pencabutan registry lalu signout lokal, hanya POST same-origin.
- Durasi app 1 jam / remember 168 jam sejak login; refresh tidak memperpanjang expiry aplikasi. Satu sesi aktif; login kedua ditolak. Perangkat hilang/pencabutan admin dan UI manajemen sesi mengikuti Tahap 6.
- Akun tanpa email kontak memakai UUID@auth.sim-murid.invalid sebagai identitas teknis Supabase; kontak tetap null, tidak diverifikasi dan tidak digunakan mengirim email. Provisioning operator melalui `scripts/provision-account.mjs`, bukan endpoint publik. Password sementara acak unik ditulis sekali ke file privat di luar repositori (0600). Identitas Auth teknis dikonfirmasi hanya untuk password auth; itu bukan bukti email kontak pengguna terverifikasi.
- Flag wajib ganti password default true; belum ada akses ke modul domain. Alur ganti password/onboarding/recovery/OTP tetap tahap berikutnya. Tidak ada akun Admin atau password bawaan dibuat otomatis.

## Verifikasi

Typecheck, ESLint tanpa warning, 18 pengujian fondasi database, 2 pengujian validasi autentikasi, 3 pengujian PostgreSQL autentikasi, dan build produksi lulus. Pengujian DB mencakup fixed-window rate limit, TTL, slot sesi, account inactive, log login/logout, serta penolakan RPC untuk anon/authenticated. Ini bukan pengganti pengujian layanan Supabase Auth yang sesungguhnya.

Migrasi cloud `authentication_runtime` diterapkan, versi 20261019083745 disamakan dengan lokal. 26 tabel seluruhnya RLS; RPC SECURITY INVOKER, search_path kosong, hanya service_role dapat mengeksekusi. Advisor security: 26 INFO RLS tanpa policy, sesuai penutupan akses hingga Tahap 7.

Hasil integrasi produksi dicatat setelah deployment. Health hanya liveness.
