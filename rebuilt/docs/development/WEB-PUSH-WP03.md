# WP-03 — API perangkat dan lifecycle akun

Baseline main: `d5d4f832a9cc3c66b4558ad2550819a3c90eeb05`. Rilis melalui PR #101 setelah otorisasi eksplisit pengguna untuk push ke main dan migrasi database. Migrasi cloud `20261107175620` (`web_push_device_api_wp03`) telah diterapkan dan diverifikasi pada sim-muridv2. Semua flag tetap nonaktif; tidak mengirim push. Fingerprint empat RPC source/cloud cocok 4/4, tabel baru RLS/service-only dan identitas tidak sah ditolak. Security Advisors tidak menambah WARN/ERROR; INFO no-policy pada tabel privat baru merupakan default-deny yang disengaja.

## Kontrak API

Semua route memakai runtime Node.js, sesi terverifikasi melalui `verifiedPrincipal`, respons private/no-store dan actor/session server. Tidak menggunakan guard survei domain. Mutasi wajib same-origin. Client tidak boleh mengirim actor, recipient, hash, credential atau envelope terenkripsi.

| Route | Input / hasil | Pembatasan |
|---|---|---|
| GET `/api/push/config` | Public VAPID, versi, kategori dan status efektif env ∩ database | Tanpa secret; inisialisasi cookie instalasi hanya HTTPS |
| GET `/api/push/devices` | Projection perangkat milik caller | Tanpa endpoint, keys, hash atau ciphertext |
| POST `/api/push/subscriptions` | `{label?,subscription:{endpoint,expirationTime?,keys:{p256dh,auth}}}` → saved/id/binding_version | 12 KiB; 5 detik baca body; 10/min/akun; maksimum 5 binding aktif |
| DELETE `/api/push/subscriptions/[id]` | Revoke milik caller; pengulangan saved; bukan miliknya 404 | 20/min/akun; tetap tersedia ketika push off |
| GET/PATCH `/api/push/preferences` | Read atau `{revision,categories,quiet_start,quiet_end,timezone}` | PATCH 10/min/akun; revision usang 409; tetap tersedia ketika push off |
| POST `/api/push/test` | `{subscription_id,request_id}` → 202 antrean atau 200 duplicate | 10 request/min; maksimum 3 event baru/jam/akun dan perangkat; tanpa broadcast |

Kode kegagalan: 400 validasi, 401 tanpa sesi sah, 403 origin/izin, 404 perangkat tak tersedia, 408 body timeout, 409 konflik/batas/revision, 413 ukuran, 415 media type, 428 handshake, 429 rate, 503 konfigurasi/layanan belum tersedia. Respons 202 bukan bukti provider menerima, tampil atau dibaca. API test hanya membuat antrean; sender WP-05 belum dibuat.

## Cookie, retry dan pergantian akun

Cookie `__Host-sim-push`: Secure, HttpOnly, SameSite=Strict, Path=/, lifetime satu tahun. Instalasi UUID acak dan secret 256 bit dibuat server. Binding hash adalah HMAC-SHA256 dengan domain separation dan owner. Client tidak menetapkan ID instalasi melalui body.

1. WP-04 memanggil config dan menunggu cookie tersimpan sebelum register. Register tanpa cookie mengembalikan 428 dan cookie, tanpa menulis subscription.
2. Reconcile akun sama mempertahankan secret dan hash subscription; IV enkripsi selalu baru. RPC WP-02 mempertahankan binding_version untuk input subscription yang sama. Kegagalan/timeout tidak dianggap saved.
3. Login akun berbeda mencabut instalasi sebelum claim sesi login. Login ulang akun sama tidak mencabut opt-in yang dipertahankan setelah expiry.
4. Register ketika owner cookie berbeda melepaskan binding sebelumnya, memutar secret 256 bit, menyimpan bukti revoke lama dalam cookie dan mengembalikan 428. Kepemilikan DB baru berubah pada retry setelah cookie baru tersimpan.
5. Bukti hash sebelumnya dicoba hanya oleh server untuk handoff installation yang sudah revoked. Riwayat transisi belum terkonfirmasi dibatasi delapan; kasus di luar batas gagal konflik secara aman. Cookie berhasil disederhanakan sesudah saved. Credential lama tidak dapat menghitung binding baru karena secret telah diputar.
6. Jika respons register hilang, cookie yang sudah melalui handshake tetap memegang revoke capability owner baru. Logout dapat mencabut binding bahkan saat sesi registry sudah expired. Riwayat bukti juga dilepas untuk kondisi handoff belum selesai.
7. Logout menunggu release instalasi, revoke sesi dan hasil Auth signOut. Kegagalan menghasilkan 503, tanpa klaim logout berhasil. Pencabutan server membatalkan job pending/processing; tidak bergantung keberhasilan cleanup service worker/browser.

Revoke-all, reset/revoke sesi dan akun nonaktif memakai hook database WP-02 yang sudah ada. Expiry biasa tetap mempertahankan opt-in. Satu sesi aktif per akun tidak diubah.

## Enkripsi dan endpoint

AES-256-GCM dengan IV 12 byte acak dan tag 16 byte; key server-only 32 byte base64 canonical. AAD: `sim-push-v1:{installation_id}:{user_id}:{encryption_key_version}:endpoint` atau akhiran `:keys`. Envelope `{iv,ciphertext,tag}` memakai base64url canonical. Hash endpoint SHA256; hash subscription dari urutan `[endpoint,p256dh,auth]`. Key browser P-256 diperiksa sebagai curve point valid; auth tepat 16 byte.

Endpoint hanya HTTPS tanpa username/password, port nonstandar atau fragmen. Allowlist: `fcm.googleapis.com`, `web.push.apple.com`, `updates.push.services.mozilla.com`, satu label `*.notify.windows.com`. Tidak menerima suffix Google/Apple sembarang. DNS semua alamat wajib publik; mapped IPv6, loopback, privat/link-local, multicast, dokumentasi dan transition tertentu ditolak. Lookup timeout dua detik, maksimum 32 alamat. Tidak ada HTTP fetch ke endpoint dalam tahap ini.

**Kewajiban WP-05:** ulangi validasi DNS saat kirim dan pin alamat publik pada transport TLS dengan hostname/SNI asli; jangan cukup memanggil helper lalu membiarkan library resolve ulang. Redirect tidak diikuti; timeout request 10 detik dan batas respons diterapkan pada transport sender. Implementasi sender ini belum ada, sehingga tahap ini tidak mengklaim pengujian transport provider. Varian host browser yang belum terbukti akan ditolak sampai allowlist ditinjau.

Konfigurasi fail-closed bila origin HTTPS exact tidak cocok, environment/deployment tidak cocok, key/version tidak valid, flag bukan literal true/false, atau staging memakai proyek produksi. Origin dan staging terisolasi belum diprovisi; register/test tetap unavailable pada konfigurasi existing. Config off tidak menutup akses cabut perangkat/preferensi.

## Migrasi lokal

`20261107173727_web_push_device_api.sql`:

- Tabel privat `push_api_limits`: satu baris per akun/action, fixed bucket satu menit, RLS dan service-role-only. Tidak memakai counter memori instance. Baris dihapus cascade saat profil dihapus.
- RPC invoker service-only `app_push_rate`, `app_push_config`, `app_push_test`.
- Test RPC mengunci profil, memeriksa perangkat sendiri, dedup request_id, quota rolling satu jam dan membuat inbox/event/delivery dalam satu transaksi. Event yang sudah dibatalkan tetap dihitung untuk kuota.
- Claim projection server-only menambahkan installation_id dan user_id untuk AAD dekripsi. Signature, fencing, eligibility dan worker email/WA tetap sama.
- Total lokal menjadi 51 migrasi, 88 tabel aplikasi (90 termasuk dua fixture Auth). Runtime RPC types dan schema snapshot digenerasi ulang.

## Penerusan WP-04

Baca dokumen ini dan `WEB-PUSH-STATUS.md`. Implementasikan service worker/UI izin tanpa meminta izin otomatis. Panggil config untuk handshake; tangani 428 dengan retry terbatas setelah cookie diterima; 409/503 harus tampil jelas. Jangan mengganti/mencabut endpoint browser secara diam-diam ketika terjadi konflik. Cabut server dahulu sebelum unsubscribe lokal. Jangan mengaktifkan flag produksi sebelum sender, staging dan UAT selesai. Browser/PWA/UAT lintas perangkat dan lock multi-koneksi PostgreSQL managed belum dibuktikan pada WP-03.

## Bukti verifikasi lokal

Rangkaian `npm run check` lulus: 819 test dari 85 proses uji, typecheck, lint, drift types dan build produksi. Tambahan regresi handoff login/kontrak database yang dibuat sesudah rangkaian dimulai dijalankan kembali secara terpisah. Pemeriksaan katalog lokal: 88 tabel aplikasi ber-RLS, tanpa issue; bukti `docs/verification/web-push/wp03-advisory.json`. Ini bukan Supabase platform Advisors atau bukti deployment cloud.

Pemeriksaan akhir: `npm ci` berhasil; typecheck dan lint lulus; 47 test API/login/database push lulus; build bersih lulus. Build inkremental sempat mengalami korupsi cache persistence Turbopack (`invalid digit found in string`); hanya direktori generated `.next` dibersihkan, lalu build diulang hingga exit 0. Tidak ada perubahan dependency/lockfile atau pemanggilan provider push.
