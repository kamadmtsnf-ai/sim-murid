# Audit Pengaturan Madrasah — 23 Oktober 2026

Baseline main `1ad63663766e731a9e53501106ea38c8077409c8`; branch `fix/school-settings-audit`.

## Analisis sebelum perubahan

Dibaca seluruh page/panel, API JSON dan multipart logo, server caller/reader/garbage collector/bounded reader, validasi profil/master/hari libur, normalisasi gambar Sharp, RPC settings read/write/GC dan migrasi override, capability settings.manage, komponen Card/Button/TableRegion, style global, spesifikasi lintas modul M17 dan keputusan bisnis. Tes settings/database/singleton, loader tes API, error boundary account dan pola verifikasi browser juga diperiksa.

Alur tetap: principal/sesi server → Admin + capability/onboarding → validasi Zod/bounded body → RPC UUID/revisi → transaksi data/revisi/audit → pembacaan balik → UI. Logo: multipart bounded → metadata dan bytes PNG/JPEG/WebP → decode/rotate/resize/re-encode PNG → staging GC → upload private-write/public-read bucket school-assets → commit metadata → konfirmasi path → pembersihan logo tak terpakai. Metadata ambigu tidak menjadi alasan menghapus objek yang mungkin sudah terpasang.

## Temuan dan perbaikan

| Temuan | Penyebab / perbaikan |
| --- | --- |
| Penyimpanan pengaturan dapat ditolak pengaman produksi | Fungsi aktif masih memiliki UPDATE settings_state dan school_profile/logo tanpa WHERE. Role authenticator produksi memuat safeupdate. Migrasi membatasi state ke singleton=true dan logo ke singleton_key=main; pengaman, grant, auth, replay, transaksi serta audit dipertahankan |
| HTTP sukses belum membuktikan perubahan yang dimaksud | Code acknowledgement kini enum dikenal dengan revisi aman, harus naik satu. Readback mengonfirmasi profil lengkap, master, status aktif, tanggal/rentang, penghapusan dan path logo |
| Koneksi putus/stale memungkinkan retry buta | Lock sinkron, abort 30 detik, cleanup saat unmount, blok mutasi pada hasil ambigu/stale/akses ditolak; GET eksplisit memulihkan tanpa mengulang POST |
| Penyimpanan logo mereset isian profil | Key formulir sebelumnya memakai revisi global. Kini reset hanya formulir yang tersimpan, draft lain tetap utuh |
| Pindah bagian/Edit/Reload membuang isian | Tracking draft per formulir; konfirmasi sebelum membuang; beforeunload untuk isian/perintah berjalan. Tidak menyimpan data sekolah pada localStorage |
| Revisi multipart kosong dikoersi menjadi nol | Parsing string digit ketat; field ganda/asing tetap ditolak; validasi file awal di klien dan validasi isi di server tetap berlaku |
| Daftar panjang sulit dipakai di ponsel | Pencarian lokal dan pagination 20 baris pada master/hari libur, status nonaktif tetap dapat diedit/diaktifkan; tabel scroll lokal dapat difokus keyboard |
| Form dan input file sempit | min-w-0, wrapping, input 44px dan layout file bertumpuk pada mobile; spacing Card mengikuti token existing, heading semantik |
| Pengisian satu hari perlu mengetik tanggal dua kali | Tanggal akhir otomatis diisi dari awal jika kosong, batas tanggal/rentang tetap diverifikasi server |
| Kegagalan initial load tidak memiliki pemulihan | Kegagalan layanan dilempar ke error boundary account existing; penolakan Admin tetap halaman akses ditolak |

## Dampak bisnis dan berkas

Tidak mengganti framework, auth internal, kontrak command, format profil, kode master, relasi historis, aturan libur inklusif/skip tanggal existing, slot logo, atau bucket. Master tetap soft-deactivate dan bisa diaktifkan kembali. NPSN/NIP/telepon tetap string sehingga nol awal dipertahankan. Identitas/kop yang dibaca rapor, tabungan dan keluaran lain tetap berasal dari school_profile yang sama.

- `src/app/account/settings/settings-panel.tsx`: controller/draft/feedback, form reset terarah, pencarian/pagination, responsive.
- `src/app/account/settings/page.tsx`: error boundary dan padding responsif.
- `src/lib/settings/confirmation.ts`: satu validator acknowledgement/readback yang dipakai API dan UI.
- `src/lib/settings/server.ts`: menggunakan validator acknowledgement terpusat; reader/GC tidak digandakan.
- `src/app/api/settings/route.ts`, `logo/route.ts`: validasi hasil simpan dan revisi, konfirmasi snapshot/path, multipart revision ketat.
- `supabase/migrations/20261023100705_school_settings_safe_updates.sql`: predicate per baris singleton; tidak memodifikasi data operasional atau mengurangi hak akses.
- Tes unit/API/database, fixture/script browser, package scripts dan MASTER: bukti serta panduan pemeliharaan.

## Batas bukti

Browser menggunakan komponen aplikasi asli dengan data/HTTP sintetis dan shim Next Image hanya pada fixture. API diuji dari handler asli dengan batas Auth/SDK sintetis; normalisasi Sharp dan migrasi database dijalankan nyata di lingkungan terisolasi. PGlite tidak memuat ekstensi C pg-safeupdate; predicate diuji dari fungsi aktual hasil migrasi dan konfigurasi produksi diperiksa read-only. Tidak mengubah profil, master, kalender atau logo produksi untuk QA. Perangkat fisik dan screen reader manual belum diuji. Gulir vertikal normal tetap diperlukan untuk formulir panjang; tidak menyembunyikan konten dengan overflow hidden global.

Konfirmasi browser mencakup perpindahan bagian di halaman, edit, reload dan beforeunload. Tidak menambahkan interceptor navigasi Next.js global. Advisor keamanan yang sudah ada memuat INFO RLS tanpa policy pada tabel private server-only dan WARN leaked-password protection; arsitektur autentikasi tidak diubah. Referensi: https://supabase.com/docs/guides/database-linter?lint=0008_rls_enabled_no_policy dan https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## Hasil verifikasi

- `npm ci`, `npm run check`: berhasil; 450 tes dalam 51 kelompok runner, TypeScript, lint nol warning, tipe database 14 tabel public, production build. Typecheck/lint/build dijalankan lagi setelah penyesuaian target sentuh terakhir.
- Browser Pengaturan: 39 pemeriksaan, 5 audit axe, tanpa pageerror JavaScript; viewport 320/768/1440 dan landscape, empty state, data banyak, guard discard, draft profil saat upload, klik ganda, leading zeros, pencarian/pagination, aktivasi master, hasil ambigu/reload tanpa POST ulang, hari libur dan keyboard.
- Regresi akademik: 41 pemeriksaan dan 6 audit axe lulus.
- Deadcode: 132 entry, 192 source files, unreachable kosong.
- Screenshot mobile/desktop diperiksa; input file disusun bertumpuk di mobile.

Perbaikan SQL diterapkan di produksi melalui execute_sql setelah apply_migration dua kali mengembalikan Invalid or expired requestState. Status diperiksa sebelum fallback; tidak mengulang perubahan data. Definisi fungsi sesudahnya memuat predicate yang dimaksud dan riwayat migrasi dicatat dengan versi lokal 20261023100705 beserta SQL yang sama, hanya setelah predicate terverifikasi. Hak EXECUTE server-only dan SECURITY INVOKER tetap dipertahankan. Tidak melakukan CRUD data madrasah atau upload logo produksi untuk pengujian.
