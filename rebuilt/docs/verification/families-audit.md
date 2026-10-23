# Audit Relasi Keluarga — 23 Oktober 2026

Baseline main `b8580d79210304ad28286f7c7449aa66bd6167d1`; branch `fix/family-relations-audit`.

## Analisis sebelum perubahan

Dibaca seluruh page/FamilyPanel, API keluarga, education context/reader/validator/useDomainMutation, guardianRequest/familyRequest, fungsi SQL read/write beserta override singleton, tabel relasi/kelompok/legacy_order, spesifikasi M03/M17 serta D06/U05/U12, komponen domain-controls/Card/Button/Status dan style global. Regresi pendidikan dan iuran ikut diperiksa. Relasi orang tua tetap memberi akses baca anak sesuai endpoint domain; grup saudara tidak otomatis memberi akses akun.

## Temuan dan perbaikan

| Temuan / penyebab | Perbaikan |
| --- | --- |
| Referensi relasi/anggota nonaktif tidak tersedia pada katalog aktif | Reader menyediakan referensi nama/username hanya dari relasi/keanggotaan yang tersimpan; tetap khusus Admin |
| Edit grup dapat menghilangkan anggota di luar katalog aktif | Anggota tersimpan tetap tampil dan terpilih; penghapusan memerlukan pilihan eksplisit dan konfirmasi |
| SQL menolak pencabutan ketika siswa/orang tua sudah nonaktif | Persyaratan akun aktif tetap berlaku untuk penambahan; pencabutan diperbolehkan untuk mengakhiri akses, tetap melalui Admin/sesi valid |
| Grup beranggotakan akun nonaktif tidak dapat diperbarui tanpa mengeluarkan anggota | SQL mengizinkan mempertahankan anggota existing pada grup yang sama; penambahan/pemindahan akun nonaktif ke grup lain tetap ditolak |
| Urutan checkbox mengikuti katalog nama, bukan urutan anggota tersimpan | Selection mengirim anggota dipertahankan dalam urutan existing lebih dahulu, lalu anggota baru; legacy_order baris existing tetap tidak berubah |
| Pemindahan antargrup langsung mengakhiri keanggotaan lama tanpa konfirmasi konteks | Konfirmasi menyebut siswa yang dipindahkan/dikeluarkan dan dampak terhadap iuran |
| Save salah satu formulir mereset formulir lain lewat key revisi global | Key/reset per formulir; draft orang tua dan grup dipertahankan terpisah |
| Pencarian dapat menyembunyikan checkbox yang masih dibutuhkan | Selection terkontrol terpisah dari filter, ringkasan anggota terpilih, batas 1–30 dan feedback hasil pencarian kosong |
| HTTP 200/ack bebas belum memastikan hasil mutasi | Ack enum dikenal/ID, snapshot/revisi tervalidasi dan readback relasi/keanggotaan/nama yang cocok sebelum success |
| Query year tidak valid diperiksa setelah write | Validasi query dilakukan sebelum mutasi sehingga tidak terjadi write lalu error validasi |
| Error snapshot backend bisa dianggap kesalahan input | Parse snapshot gagal menjadi 503; penolakan akses tetap 403 dan page outage memakai error boundary existing |
| Hasil ambigu dapat diulang dengan UUID baru | Lock sinkron, timeout 30 detik, cleanup unmount; hasil ambigu/stale/akses ditolak memblokir mutasi sampai GET eksplisit |
| Daftar panjang/nama panjang dan kontrol mobile | Pencarian/pagination 20 untuk relasi/grup, label identitas+username, hubungan dalam bahasa Indonesia, wrapping dan target sentuh 44px, roster scroll lokal |

## Lingkup dan kompatibilitas

Perubahan ada pada UI/page/API keluarga, helper `src/lib/education/families.ts`, validasi/reader keluarga existing, CSS scoped `.families-panel`, migrasi `20261023110344_family_relations_consistency.sql`, tes dan dokumentasi. Tidak mengubah tarif/formula iuran, arsip pembayaran, struktur akun, autentikasi, RLS/grant atau status profil. Relasi orang tua dan grup saudara tetap terpisah. Perpindahan anggota tetap mencabut keanggotaan lama dengan riwayat; tidak mengarang relasi dari nama/KK. Source transaksi, request replay, audit, safeupdate predicate dan urutan legacy tetap dipertahankan.

Migrasi hanya mengganti fungsi read/write yang sama, SECURITY INVOKER dengan search_path kosong. Referensi hanya berisi id/nama/username akun terkait; tidak menambahkan biodata/dokumen pribadi pada snapshot keluarga.

## Batas bukti

Browser memakai komponen aplikasi asli dengan data/HTTP sintetis, tanpa akun produksi. API diuji dari handler/reader asli dengan boundary Auth/SDK sintetis. Migrasi dijalankan nyata di database terisolasi; PGlite tidak memuat ekstensi C pg-safeupdate, predicate singleton tetap diuji. Tidak melakukan perubahan relasi keluarga atau pembayaran produksi untuk QA. Perangkat fisik dan screen reader manual belum diuji. Gulir vertikal halaman dan roster lokal diperlukan agar seluruh konten dapat diakses. Guard meliputi edit/reload dan beforeunload, bukan interceptor navigasi Next.js global.

Advisor existing: INFO RLS tanpa policy pada tabel private server-only serta WARN leaked-password protection. Tidak mengubah arsitektur auth dalam audit ini. Referensi: https://supabase.com/docs/guides/database-linter?lint=0008_rls_enabled_no_policy dan https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## Hasil verifikasi

- `npm ci` dan `npm run check` lulus: 456 tes, 52 kelompok runner, TypeScript, lint nol warning, tipe database 14 tabel public dan production build.
- Pengujian pendidikan/database diulang setelah penyederhanaan migrasi; 18 tes lulus.
- Browser Relasi Keluarga: 32 pemeriksaan dan 7 audit axe lulus, viewport 320/768/1440 serta landscape, tanpa pageerror JavaScript. Mencakup anggota nonaktif, urutan selection, pencarian yang menyembunyikan checkbox, dua formulir independen, klik ganda, revoke, pagination, hasil ambigu/reload dan empty state.
- Deadcode: 133 entry, 193 source files, unreachable kosong.
- Migrasi produksi diterapkan melalui apply_migration; definisi read/write dan hak server-only diverifikasi kembali. Tidak mengubah relasi/data pembayaran produksi untuk QA.

Daftar relasi dan grup kini memakai disclosure native dengan jumlah data selalu terlihat; mengurangi panjang awal halaman ponsel tanpa menghilangkan pencarian, pagination atau aksi. Browser menguji kedua kondisi tertutup/terbuka pada setiap viewport. Typecheck, lint dan build diulang setelah penyesuaian ini dan lulus.
