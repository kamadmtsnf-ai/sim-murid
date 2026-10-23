# Audit Profil pribadi — 23 Oktober 2026

## Lingkup dan alur yang dipertahankan

Acuan: spesifikasi profil/akun dan gate keamanan, kebijakan disepakati, AGENTS.md, halaman `/account/profile`, form, API `/api/account/profile`, schema recovery/profile, pembaca principal, security state, request/cookie helper, pembaca body terbatas, RPC `app_profile_read`/`app_profile_update`, trigger updated_at, invalidasi bukti email/OTP, shell/navigation/card/button dan tes recovery/database.

Halaman memverifikasi principal dan mengizinkan gate ready/email_pending. Gate password/biodata/pertanyaan tetap diarahkan ke keamanan akun; redirect survei tidak ditelan. Form menyunting full_name, phone, contact_email dan bio; username tidak dapat diubah. API memperoleh user/session dari principal server, memeriksa same-origin, membandingkan username dan mengirim updated_at **tanpa memangkas presisi mikrodetik** ke RPC.

RPC mengunci profil, menolak versi lama/gate tidak sah, menyimpan data dan mencatat aktivitas. Hanya perubahan email kontak yang membatalkan bukti email dan OTP pending. Nama/bio saja tidak membatalkannya. Profil pribadi tidak menyelesaikan biodata wajib siswa, tidak mengubah username/password/Auth identity, tidak mengirim email dan tidak mengubah role.

## Temuan dan perbaikan

| Temuan / penyebab | Perbaikan |
| --- | --- |
| useState busy belum mengunci dua submit dalam event yang sama | Ref lock sinkron untuk simpan, pemeriksaan status dan reload |
| Respons 200 tanpa profile valid tetap menampilkan pesan dan memicu refresh | Validasi snapshot, username dan seluruh field yang disimpan sebelum mengonfirmasi sukses/refresh |
| Respons hilang setelah commit membuat pengguna mengirim ulang dengan updated_at lama | Tandai hasil belum pasti, pertahankan isian, blok penulisan ulang; tombol Periksa status penyimpanan hanya melakukan GET. Hanya konten yang cocok persis mengonfirmasi hasil |
| Konflik/malformed/outage dapat menyebabkan penimpaan atau hilangnya draf saat reload halaman | Konflik memerlukan tinjauan ulang, refresh terkontrol dengan konfirmasi membuang isian, kegagalan reload mempertahankan draf; beforeunload hanya selama dirty |
| Catch seluruh proses halaman menangkap redirect survei dan menyamarkannya sebagai error | Principal/gate redirect dibiarkan mengalir; outage masuk error boundary lokal dengan retry; loading lokal |
| Validasi generik tanpa lokasi field, pesan email verifikasi selalu muncul meski email tetap sama | Error per field, fokus pertama, aria-invalid/describedby; pesan email berubah hanya jika benar berubah; username informatif read-only |
| request.text membaca seluruh body dan membatasi jumlah karakter, bukan byte UTF-8 | Reuse readBounded streaming 16 KiB setelah autentikasi; hentikan oversized body dan tangani JSON invalid |
| Karakter NUL yang diterima schema dapat gagal di PostgreSQL | Schema tulis turunan menolak kontrol di nama/HP dan NUL pada bio; schema baca legacy tetap kompatibel. Nomor internasional/nol awal, bio multiline dan field opsional dipertahankan |
| Header grid kartu dengan username panjang melebar pada mobile | Kolom minmax(0,1fr), min-width 0, wrapping nama; form 1/2 kolom, target 44 px, tombol bertumpuk/wrapping pada mobile |

Tidak menambahkan migrasi, tabel, dependency runtime atau fungsi bisnis baru. Tidak menambah modal/pagination/CRUD lain karena halaman ini adalah editor profil sendiri. Gulir vertikal halaman dan textarea merupakan perilaku normal; bukan disembunyikan dengan overflow global.

## Berkas berubah dan alasan

- `src/app/account/profile/page.tsx`: redirect/error dan layout.
- `src/app/account/profile/profile-form.tsx`: state, validasi, konfirmasi hasil, refresh aman dan UI.
- `src/app/account/profile/loading.tsx`, `error.tsx`: loading/retry aksesibel tanpa detail internal.
- `src/app/api/account/profile/route.ts`: pembatasan body byte, validasi tulis, konfirmasi boolean dan identitas snapshot.
- `src/lib/auth/profile.ts`: tipe, field/form mapping, pembanding hasil, schema tulis yang memakai schema existing.
- `tests/personal-profile.test.mjs`: handler/page/helper aktual; auth/SDK boundary terisolasi.
- `tests/database/recovery.test.mjs`: bukti verifikasi/OTP tetap saat email tidak berubah, akses RPC dan pencabutan sesi.
- `tests/ui/personal-profile-fixture.tsx`, navigation shim, `scripts/verify-personal-profile.mjs`: form dan shell aktual, API sintetis, geometri/interaksi/axe.
- `package.json`: tes regresi masuk check dan perintah browser khusus.
- Design system, audit dan results JSON: dokumentasi keputusan dan bukti.

## Validasi

- npm ci berhasil.
- Tes khusus profil: 10 tes API/page/schema/helper lulus.
- Suite database recovery mencakup tambahan 2 regresi profil; dijalankan lagi dalam check.
- npm run check: exit 0; 499 tes dalam 57 kelompok runner lulus, TypeScript, lint tanpa warning, kecocokan 14 tipe tabel publik dari replay migrasi, serta production build. TypeScript/lint/build diulang setelah penyempurnaan guard unmount dan lulus (exit 0); 10 tes khusus profil juga diulang dan lulus.
- Uji browser final: exit 0; 85 pemeriksaan dan 7 scan axe lulus, tanpa JavaScript pageerror, menggunakan CSS production dari build terbaru. Bukti di `personal-profile/results.json`.
- Viewport 320/768/1440 dan landscape 844×390; nama/username panjang, bio 2000 karakter/multiline, field opsional kosong, keyboard/touch, fokus error, dirty/cancel refresh, lock, network/JSON/malformed/401/403/409/503, respons hilang setelah commit, konfirmasi GET tanpa tulis ulang, loading/error/retry, penghapusan listener dirty dan respons 401 terlambat setelah unmount.
- Audit deadcode: 143 entry, 203 source, unreachable kosong menurut scanner.
- Query Supabase produksi read-only: kedua RPC SECURITY INVOKER, execute anon/authenticated false, service_role true. Advisor existing untuk RLS tanpa policy pada tabel privat server-only dan leaked-password protection tetap dicatat; tidak diubah dalam audit ini.

## Batas

Uji browser memakai API sintetis; aturan transaksi, sesi dan bukti email diuji pada database terisolasi dengan migrasi aktual. Tidak mengubah profil/email pengguna produksi atau mengirim OTP untuk QA. Tidak menguji browser produksi terautentikasi, perangkat fisik/iOS/Safari atau jaringan nyata semua kondisi. Inspector log pasca-rilis adalah pengamatan pada jendela waktu terbatas. Tidak mengklaim aplikasi bebas seluruh bug atau 100% produksi. Hasil merge, SHA dan smoke produksi dicatat pada PR setelah rilis.
