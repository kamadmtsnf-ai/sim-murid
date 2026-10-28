# Pembaruan UI ringkas — 28 Oktober 2026 (WIB)

Baseline main: `038d99da60337d3684f53118b3ac4be409e5d089`. Branch: `ui/less-text-workspace`. Otorisasi: pengguna meminta pembaruan UI keseluruhan agar tidak terlalu banyak teks, kemudian langsung merge PR ke main.

## Analisis dan batas perubahan

Diperiksa pola shell/sidebar/topbar/breadcrumb/footer, seluruh route account, komponen bersama, login/beranda, pengantar dan paragraf statis modul, design system, kebijakan dan roadmap. Alur existing: SSR membaca principal dan data berizin → panel domain → kontrol/feedback bersama → API existing → readback. Perubahan hanya presentasi/copy/disclosure; tidak mengubah fungsi domain, state formulir, event mutasi, payload/API, auth/RBAC, penyimpanan, tarif, validasi server, ekspor, database atau dependency. Tidak perlu migrasi.

Temuan: penjelasan statis panjang bersaing dengan data; dashboard menduplikasi inventaris sidebar dan ringkasan akun di layar awal; paragraf pemasaran/login berulang; permukaan/gradasi/bayangan menambah kebisingan visual. Penggunaan rem pada padding/ikon disclosure baru sempat menyebabkan overflow pada 400% teks dan diperbaiki sebelum rilis.

## Perbaikan

- Komponen `Guidance`: disclosure HTML native, judul topik jelas, indikator ikon/chevron, target minimum44px, wrap penuh, keyboard Enter/Space dan sentuhan. Tidak ada truncation, fetch, hook/state baru atau persistensi.
- 20 paragraf statis pada16 file berpindah ke panduan opsional: hak akses, sesi, penugasan guru, jadwal, relasi keluarga, bimbingan, absensi, iuran, tabungan, rapor, kenaikan/ijazah, pekerjaan, rekonsiliasi, riwayat audit dan tindak lanjut.
- Dashboard: rincian akun dan satu inventaris layanan dapat dibuka; tidak memaksa dua lapis accordion untuk tiap kelompok layanan. Sumber error/empty/akses tidak ikut disembunyikan. Tidak menambah tautan modul yang menduplikasi sidebar.
- Pengantar Beranda, Login, Dashboard, Direktori dan Profil lebih singkat. Kesehatan Aplikasi memakai label konfigurasi singkat dengan pembatas koneksi/pengiriman tetap eksplisit, bukan klaim layanan sehat.
- Kartu bersama: padding16px mobile/24px desktop, jarak lebih konsisten. Latar konten opaque, bayangan ringan, judul halaman lebih jelas, sidebar aktif teal solid. Font dan identitas produk dipertahankan.
- Instruksi input, validasi, kredensial, risiko transaksi, finalisasi, hasil tidak pasti, peringatan AI dan status proses tetap langsung terlihat.

## Ukuran perubahan teks

Inventaris exact-match `copy-audit.json`: 379 kata pada20 paragraf terpilih diganti64 kata judul panduan di keadaan tertutup (315 kata lebih sedikit, sekitar83%). Seluruh379 kata tetap dapat dibaca saat dibuka. Angka ini **hanya petunjuk terpilih**, tidak mencakup seluruh UI, teks dinamis atau keberhasilan pengguna.

## Verifikasi dan batas bukti

`npm ci` dan `npm run check` lulus:786 tes, TypeScript, lint, replay tipe database dan production build. Browser:1934 pemeriksaan, 190 pemindaian axe tanpa pelanggaran, ditambah16 skenario modal; tidak ada JavaScript error pada skenario yang dijalankan.

Hasil final aktual dicatat pada `docs/verification/ui-readability/verification.json`. Browser memakai komponen aktual dan data sintetis dengan batas HTTP terisolasi; Beranda/Login juga diperiksa lewat server production lokal. Bukan sesi akun produksi, bukan UAT manusia, bukan uji perangkat fisik atau sertifikasi aksesibilitas.

Suite browser historis yang dipakai diperbarui agar mengikuti kontrak existing: sidebar accordion/pencarian, bantuan Login tanpa JavaScript pada shell streaming, modal konfirmasi HTML menggantikan dialog native, dan tab/accordion absensi. Penyelarasan locator/keputusan eksplisit tidak mengubah aplikasi atau menghilangkan pemeriksaan payload, pembatalan, draf dan fokus.

## Berkas dan alasan

Daftar berkas final mengikuti diff PR. Kelompok produksi: `globals.css`, `ui/card.tsx`, `ui/guidance.tsx` untuk desain bersama; `account-dashboard.tsx`, `admin-health.tsx`, halaman publik/login/direktori/profil untuk hierarki dan copy; panel16 file yang tercantum dalam copy audit untuk petunjuk opsional. Kelompok QA: fixture `reading-fixture.tsx`, verifier `verify-reading.mjs`, penyesuaian suite browser existing, script npm, MASTER dan laporan/evidence ini. Tidak ada file backend/SQL/migrasi yang berubah.

## Rilis

PR, CI exact-head, merge dan status deployment ditambahkan ke deskripsi PR setelah verifikasi. Keberhasilan deploy tidak menggantikan penerimaan visual pengguna.
