# reCAPTCHA pada login

26 Oktober 2026 WIB. Branch `feat/login-recaptcha`, baseline main `22c18b3832682990d6ec62761acb4ff8d55900ea`.

## Hasil dan alur

Integrasi Google reCAPTCHA **v2 Checkbox**, ukuran compact dan bahasa Indonesia. Kode mengikuti render eksplisit dan API SiteVerify Google; bukan v3/Enterprise Assessments. Tidak mengganti username adapter, Supabase Auth, sesi tunggal, cookie, remember-me, cleanup atau database existing.

Server LoginPage membaca konfigurasi runtime dan hanya meneruskan mode serta Site Key ke LoginForm. Secret berada di modul server-only. Saat aktif, client memerlukan token; API memvalidasi origin/body/DTO, konfigurasi, keberadaan token, rate limit existing, lalu SiteVerify sebelum pencarian akun dan password check. Username/password/IP tidak ditambahkan ke request verifikasi Google; token/secret tidak dicatat di log. Respons Google harus success dan hostname tepat dalam allowlist; domain bukan dari header browser. Respons v3 yang membutuhkan kebijakan score/action tersendiri ditolak. Provider error/timeout/configuration error berhenti dengan 503; token ditolak dengan 403. Tidak ada fallback login tanpa verifikasi saat mode aktif.

Token kedaluwarsa/error mengosongkan state. Setiap respons login ditolak mereset widget/token tanpa menghapus username/password; token Google tidak dipakai ulang. Timeout login ambigu tetap mengunci retry dan menawarkan Periksa sesi existing. Loader script dideduplikasi, memiliki timeout 15 detik dan tombol retry; callback tidak mengubah komponen yang sudah dilepas. Batas SiteVerify 5 detik; request tidak mengikuti redirect. challenge_ts adalah waktu pemuatan challenge, sehingga TTL/replay token diserahkan kepada Google, bukan ditebak dari waktu pemuatan widget.

## Aktivasi yang masih diperlukan

**Kunci reCAPTCHA belum ada di Vercel; fitur belum aktif di produksi.** Tidak menambahkan kunci uji ke lingkungan produksi. Tidak melakukan merge/deploy atau mengubah konfigurasi Supabase pada pekerjaan ini.

1. Buat kunci **reCAPTCHA v2 “I'm not a robot” Checkbox** yang mendukung SiteVerify dan Secret Key (bukan kunci v3 atau Enterprise Assessments saja).
2. Daftarkan `sim-muridv2.vercel.app` pada domain reCAPTCHA; tambahkan domain resmi lain hanya bila dipakai. Daftar domain di konsol Google dan allowlist server harus sesuai.
3. Pada Vercel project `sim-muridv2`, isi variabel berikut untuk target Production. Secret Key disimpan sebagai Secret dan jangan dibagikan di percakapan, source atau screenshot. Preview memakai konfigurasi terpisah; jangan membuka wildcard seluruh `.vercel.app`.

| Variabel | Nilai |
| --- | --- |
| `RECAPTCHA_SITE_KEY` | Site Key milik madrasah; aman untuk ditampilkan pada widget |
| `RECAPTCHA_SECRET_KEY` | Secret Key yang berpasangan; server-only |
| `RECAPTCHA_ALLOWED_HOSTNAMES` | `sim-muridv2.vercel.app`; domain tambahan dipisahkan koma, tanpa skema/path/port/wildcard |
| `RECAPTCHA_ENABLED` | `true` setelah seluruh konfigurasi siap |

4. Deploy ulang sesudah variabel tersimpan; lakukan UAT login dengan kunci dan domain nyata. Periksa kegagalan jaringan, expired token, salah password, remember-me, serta login yang sukses.

Default tanpa flag/flag false adalah disabled untuk mempertahankan login existing sebelum operator menyediakan kunci. Flag true dengan konfigurasi parsial/salah tidak turun ke disabled: UI dan API memblokir login dengan pesan umum. Flag tidak dikenal juga unavailable. Kunci uji universal Google ditolak pada NODE_ENV production. `.env.example` hanya memuat placeholder.

## Perubahan dan bukti

- `lib/auth/recaptcha.ts`: konfigurasi server, proyeksi public, verifikasi domain/hasil Google.
- `lib/auth/validation.ts`: DTO request additive captchaToken opsional; menjadi wajib di route saat mode aktif. Schema kredensial existing tetap.
- `app/api/auth/login/route.ts`: gate reCAPTCHA sebelum lookup/password, tetap setelah rate limit.
- `app/login/page.tsx`, `login-form.tsx`, `recaptcha-widget.tsx`: konfigurasi SSR, widget compact, loading/error/expired/retry/reset dan lock submission.
- `tests/login-route.test.mjs`, `tests/login-page.test.mjs`, UI fixture dan verify-login: jalur server dan browser tanpa akun nyata.

npm ci sebelumnya sudah dijalankan pada checkout ini. npm run check, TypeScript, lint, production build dan 22 tes login lolos. Browser: 212 pemeriksaan dan 16 axe tanpa issue atau uncaught JavaScript error; viewport 320–1440, landscape, text scaling, timeout/unmount, baseline login dan skenario reCAPTCHA tiruan. Bukti di `docs/verification/login-recaptcha/`.

Batas: Google script/SiteVerify dimock pada kasus reCAPTCHA; belum membuktikan keberhasilan challenge nyata, domain terdaftar, pasangan kunci, kuota Google, UAT akun produksi atau perangkat fisik. Status aktivasi tidak disamakan dengan keberhasilan tes lokal.

## Referensi resmi

- https://developers.google.com/recaptcha/docs/display
- https://developers.google.com/recaptcha/docs/verify
