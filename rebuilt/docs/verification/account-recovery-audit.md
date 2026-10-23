# Audit Pemulihan Akun — 23 Oktober 2026

Baseline main `0ad8834ecfaaade0a2a18a7fb143555a42f721de`; branch `fix/account-recovery-audit`.

## Analisis dan alur

Dibaca page/RecoveryPanel, API account/recovery, validasi, Auth principal/registry, securityState, confirmCurrentPassword, requireCapability, requestAuth/privateJson, error boundary, Card/Button/Status, CSS, RPC recovery list/begin/finish dan override email, tabel recovery_requests/auth_accounts/app_sessions, tes recovery/API/database, spesifikasi M01/D04/U01/U02 serta keputusan bisnis. Jalur publik pengajuan manual/pertanyaan dan email OTP diperiksa sebagai dependency; audit ini berfokus pada antrean Admin `/account/recovery`.

Alur dipertahankan: Admin dengan sesi valid dan onboarding lengkap → capability accounts.manage → verifikasi password Admin → RPC begin dengan bukti identitas/nonce. Penolakan dicatat tanpa reset; pemulihan sesi mencabut sesi aplikasi target; reset password mencabut sesi, mengubah password lewat Auth Admin, lalu RPC finish mengharuskan ganti password dan menonaktifkan OTP pemulihan lama. Target akun sendiri dilarang. Batas antrean 100 tertua/24 jam dan lease finalisasi dua menit dipertahankan. Pertanyaan keamanan hanya bukti tambahan.

## Temuan dan perbaikan

| Temuan / penyebab | Perbaikan |
| --- | --- |
| Catch page menelan redirect survei dan menyamarkan outage | Principal/redirect di luar catch; outage ke error boundary existing dengan retry |
| Capability denied menjadi 503 | AccessDenied dipetakan ke 403 |
| API tidak mengikuti gate survei wajib yang berlaku pada page | Periksa app_survey_required sebelum membaca/memproses antrean |
| HTTP 200 dianggap sukses tanpa kontrak hasil | Respons additive code/requestId/outcome; client memeriksa ID, jenis hasil, dan password hanya untuk outcome password |
| Auth acknowledgement target dan finish truthy belum diverifikasi | ID Auth harus sama target; finish harus boolean true; tidak menyerahkan secret pada hasil gagal |
| Double submit/state update race, fetch tanpa timeout/cleanup | Lock sinkron ref, timeout 30 detik, AbortController, mounted guard dan cleanup |
| Network/5xx/409 dapat dicoba lagi sebelum status diperiksa | Mutasi dikunci sampai GET antrean berhasil; tidak ada replay otomatis |
| Reload penuh menghilangkan konteks/password | Refresh GET in-place tervalidasi, konfirmasi pengosongan draft; refresh dinonaktifkan saat password masih ditampilkan |
| Form/reset menghapus semua isian walau password Admin salah | Bukti/konfirmasi dipertahankan pada penolakan input; password Admin selalu dikosongkan setelah percobaan |
| Persetujuan/penolakan tanpa konfirmasi target/dampak | Konfirmasi nama/username dan pencabutan sesi; konteks sesuai jenis permintaan |
| Antrean panjang sulit ditinjau; kedaluwarsa tidak diperlihatkan | Search/filter/pagination 10, tombol Tinjau fokus ke formulir, tanggal WIB dan expiry, akun sendiri/expired nonaktif |
| Payload queue duplikat/lifetime invalid bisa dirender | Validasi maksimal100, ID unik dan expiry setelah requested_at |
| Pembacaan body tidak dibatasi saat streaming | Reuse readBounded 4096 byte, error body terkontrol |
| Kontrol/nama panjang di mobile | Scoped CSS min-width/wrapping, target44px, feedback/focus, flex wrapping dan padding responsif |

## File dan alasan

- `src/app/account/recovery/page.tsx`: load/error/redirect dan layout.
- `src/app/account/recovery/recovery-panel.tsx`: lifecycle request, draft/secret dan UI antrean.
- `src/app/api/account/recovery/route.ts`: gates, ack dan body bounds.
- `src/lib/auth/recovery-validation.ts`: kontrak queue dan hasil; DTO pengajuan publik/profil tetap kompatibel.
- `src/app/globals.css`: selector hanya `.account-recovery-panel`.
- `tests/account-recovery.test.mjs`: handler/page asli dengan boundary Auth/SDK sintetis.
- `tests/ui/account-recovery-fixture.tsx`, `scripts/verify-account-recovery.mjs`: komponen asli dengan HTTP/data sintetis; responsivitas, keyboard, aksesibilitas, sukses/gagal/empty/expiry.
- `package.json`: test baru pada check dan perintah browser, tanpa dependency baru.
- `docs/design-system/MASTER.md` dan hasil verifikasi: dokumentasi.

## Keamanan dan kompatibilitas

Tidak ada migrasi, perubahan grant/RLS, schema, password default, formula bisnis, atau operasi reset terhadap akun produksi. Pemeriksaan read-only produksi: app_recovery_list/begin/finish semuanya SECURITY INVOKER; anon/authenticated tidak memiliki EXECUTE, service_role memiliki EXECUTE. Server tetap memverifikasi identitas caller, role/gate dan password Admin. Password sementara unik hanya dikembalikan setelah finalisasi; tidak disimpan pada localStorage/sessionStorage, log aplikasi, URL atau dokumentasi. Akses target tetap diperiksa dalam SQL.

Advisor baseline tetap INFO66 RLS tanpa policy pada schema private server-only dan WARN1 leaked-password protection disabled; tidak diubah dalam audit halaman ini. Referensi resmi: https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid dan https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Changelog diperiksa; tidak ada perubahan API relevan yang memerlukan migrasi stack.

## Batas bukti

Auth/SDK dan HTTP browser terisolasi, bukan reset akun produksi. Tes database menjalankan migrasi nyata di PGlite terisolasi. Perangkat fisik, screen reader manual dan reset Auth produksi tidak diuji. Scroll vertikal halaman adalah normal agar daftar dan form tetap dapat diakses; sasaran layout adalah tanpa overflow horizontal/konten terpotong. beforeunload melindungi proses pending dan password terlihat, bukan interceptor semua navigasi Next.js. Jika operasi selesai tetapi respons/password hilang, password tidak dapat ditampilkan ulang; pengguna perlu mengajukan pemulihan baru. Lease finalisasi existing dua menit tetap berlaku.

## Verifikasi

- `npm ci` berhasil.
- `npm run check`: 462 tes/53 kelompok runner, tanpa kegagalan; TypeScript, lint nol warning, tes database/Auth/domain, tipe database dan production build berhasil.
- Deadcode: 134 entry, 193 source, unreachable kosong.
- Browser final: 46 pemeriksaan/5 axe, tanpa pageerror, pada 320/768/1440 dan landscape. Mencakup sentuhan, keyboard/focus, search/filter/pagination, akun sendiri/expiry, konfirmasi batal, penolakan input, bukti per target, klik ganda, reset password/sesi/penolakan, penyerahan/hapus secret, ack tidak dikenal, network/503/409, kegagalan GET dan empty state. Tidak ditemukan horizontal overflow.
- Typecheck/lint/build serta enam tes route/page diulang setelah penyempurnaan pergantian target dan semuanya lulus.

Bukti identitas, checkbox konfirmasi dan password Admin dikosongkan saat memilih target lain atau meninjau ulang; tidak memakai ulang verifikasi target sebelumnya.
