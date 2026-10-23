# Audit Verifikasi Email — 23 Oktober 2026

## Lingkup dan alur

Dibaca sebelum perubahan: kedua blok halaman/panel, API account/email, service reservasi/pengiriman, Gmail SMTP/config/template, generator/HMAC OTP, schema, security state/principal/cookie helpers, migrasi email/recovery/profile, tes unit/database/recovery routes, spesifikasi M01-F08/U03 dan keputusan bisnis. Komponen shell/navigation/button/card dipakai ulang.

Halaman ini tetap untuk akun Guru dengan gate ready/email_pending. Alur: principal server → app_email_state → reservasi server dengan hash OTP dan rate limit → Gmail SMTP → pencatatan delivery → kode dimasukkan → validasi ownership/purpose → consume atomik → status verifikasi terbaru. OTP plaintext hanya berada di memori server dan email pengiriman; tidak dikirim dalam respons API, log, URL atau browser storage.

Aturan tetap: OTP 6 digit (nol awal valid), TTL maksimal 600 detik, sekali pakai, 5 percobaan, jeda kirim 60 detik, 5 permintaan/hari WIB lintas verify/recovery, budget global existing 250/24 jam. Perubahan email membatalkan bukti verifikasi dan pending OTP; perubahan password membatalkan pending recovery; pencabutan sesi menolak akses. API POST verify tetap mengembalikan security state existing; GET menambah serverTime untuk perhitungan UI.

## Temuan dan perbaikan

| Penyebab / temuan | Perubahan |
| --- | --- |
| Kode direset sebelum permintaan selesai | Controlled input mempertahankan kode saat gagal; kosong hanya saat challenge/email berubah atau verifikasi terkonfirmasi |
| busy state belum mencegah dua aksi dalam event yang sama | Ref lock sinkron untuk kirim, verifikasi dan muat status |
| Respons 200 langsung mengarahkan ke dashboard, termasuk payload yang tidak membuktikan verifikasi | Periksa snapshot GET terotorisasi setelah respons; hanya verified=true yang mengizinkan navigasi verifikasi |
| Gagal jaringan/refresh membuat UI tetap memakai state lama | Blok kirim/verify sampai GET berhasil; refresh in-place mempertahankan input challenge yang sama; tidak mengirim ulang otomatis |
| Form tetap mengizinkan kode kedaluwarsa dan tidak menjelaskan queued/failed/locked | Timing/state helper, countdown expiry/cooldown, status pengiriman dan batas percobaan eksplisit; backend tetap otoritas final |
| Cooldown recovery terbaru tidak selalu tercermin pada challenge verify terbaru | Hormati retry_after dari respons server, bukan hanya retry_at challenge yang tampil |
| Clock lokal dapat berbeda dari server; render awal berisiko menampilkan countdown yang salah | Waktu awal SSR dan serverTime GET dipakai sebagai referensi clock UI; timer dibersihkan saat unmount |
| SMTP diterima tetapi acknowledgement DB hilang masuk catch yang juga mencatat SMTP gagal | Pisahkan kegagalan SMTP dari kegagalan pencatatan; setelah SMTP accepted tidak menulis p_accepted=false. Status queued/accepted tetap dapat diperiksa dan tidak mengaktifkan kode tanpa konfirmasi DB |
| request.text membaca seluruh body dan batas memakai karakter | Reuse streaming readBounded 2048 byte setelah autentikasi; JSON invalid dan oversize ditangani tanpa detail internal |
| Page catch luas menyamarkan redirect/outage | Redirect tetap mengalir; loading dan error/retry lokal; state invalid gagal tertutup |
| Nama email panjang serta tombol countdown berpotensi melebar | Header grid terbatas, min-width 0, wrapping, target sentuh 44–48 px, tombol responsif dan label/error/fokus aksesibel |

Tidak mengganti provider, auth, database, kontrak OTP, batas kuota atau aturan role. Tidak menambahkan migrasi/dependency. Permintaan kirim untuk email yang sudah verified menjadi no-op sehingga tidak menghabiskan kuota. Tidak menambahkan tabel/modal/pagination karena bukan bagian alur halaman ini.

## Berkas berubah

- `src/app/account/email/email-panel.tsx`: state, clock, lock, sinkronisasi, fokus, UI.
- `src/app/account/email/page.tsx`, `loading.tsx`, `error.tsx`: layout, redirect, loading/retry.
- `src/app/api/account/email/route.ts`: auth/body bound, validasi boolean consume, no-op verified, serverTime GET dan pesan aman.
- `src/lib/email/validation.ts`: bentuk state/timestamp/status/counter tervalidasi dan helper timing untuk UI/tes.
- `src/lib/email/service.ts`: membedakan SMTP failure dari pencatatan delivery yang belum pasti; shared recovery flow tetap diuji.
- `tests/email-verification.test.mjs`: handler/page/service aktual dengan boundary auth/SMTP/RPC sintetis; tidak mengirim email nyata.
- `tests/ui/email-verification-fixture.tsx`, navigation shim, `scripts/verify-email-verification.mjs`: panel dan shell aktual dengan endpoint sintetis.
- `package.json`, design system, audit dan results JSON: perintah regresi, keputusan desain dan bukti.

## Validasi

- npm ci berhasil.
- 12 tes khusus API/page/service/schema/timing lulus: CSRF/auth/gate, session/cookie, ownership/purpose, HMAC, nol awal, kuota, body UTF-8, SMTP versus DB failure dan recovery compatibility.
- Suite existing email/database menguji consume sekali pakai, expiry, 5 percobaan, cooldown, kuota WIB/global, resend supersede, perubahan email/password serta pencabutan sesi.
- Uji browser final: exit 0; 84 pemeriksaan dan 10 scan axe lulus, tanpa JavaScript pageerror; menggunakan CSS production dari build terbaru. Bukti di `email-verification/results.json`.
- Viewport 320/768/1440 dan landscape 844×390; keyboard/touch/paste, email kosong/panjang, verified/no challenge, accepted/queued/failed/locked/expired/superseded, timer cooldown/expiry, rate Retry-After, invalid JSON/network/401/403/503, lost verification response, refresh dan unmount.
- npm run check: exit 0; 511 tes dalam 58 kelompok runner lulus, TypeScript, lint tanpa warning, kecocokan 14 tipe tabel publik dari replay migrasi, serta production build. Tes khusus dan lint diulang setelah penyempurnaan pesan/paste dan lulus.
- Deadcode scanner: 147 entry, 205 source, unreachable kosong.
- Query Supabase produksi read-only: 5 RPC email terkait SECURITY INVOKER, execute anon/authenticated false dan service_role true. Advisor existing pada tabel privat server-only serta leaked-password protection dicatat; konfigurasi global tidak diubah.

## Batas verifikasi

SMTP/API browser disimulasikan. Tidak mengirim OTP nyata, membaca OTP pengguna, mengubah bukti email atau menghabiskan kuota produksi untuk QA. Provider acceptance bukan bukti masuk inbox; spam filter/kuota penyedia dan koneksi nyata belum diuji end-to-end. Database integration memakai migrasi aktual dalam database terisolasi. Tidak menguji sesi browser produksi terautentikasi, perangkat fisik/iOS/Safari. Gulir vertikal halaman panjang merupakan perilaku normal. Tidak mengklaim seluruh aplikasi bebas bug/100% produksi. SHA merge, deployment dan smoke tanpa sesi dicatat pada PR pasca-rilis.
