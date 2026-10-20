# Tahap 11–15: biodata, dokumen, direktori, kelas dan jadwal

Tanggal: 21 Oktober 2026 WIB. Implementasi sudah dideploy ke Vercel produksi; kode dan laporan disiapkan untuk sinkronisasi GitHub setelah izin eksplisit tujuan repositori.

## Cakupan

- 11: biodata 87 field, validasi kondisional, kemajuan profil, relasi orang tua terverifikasi dan kelompok keluarga.
- 12: dokumen privat, unggahan langsung bertanda tangan hingga 50 MB, pemeriksaan isi PDF/JPEG/PNG, unduhan bertanda tangan singkat, penggantian/penghapusan dan rekonsiliasi.
- 13: direktori berfilter dan berpaginasi; akses rincian mengikuti peran dan penugasan tanpa mengungkap biodata sensitif kepada guru yang tidak berhak.
- 14: tahun ajaran/semester, kelas, wali kelas, penempatan dan perpindahan siswa dengan riwayat.
- 15: jadwal pelajaran dan piket, waktu akhir termasuk istirahat, penolakan benturan kelas/guru, penggantian piket atomik dan penghapusan batch.

## Bukti

- npm ci, typecheck, lint, 96 pengujian lokal, pemeriksaan snapshot tipe, dan build produksi: lulus.
- Dua migrasi terakhir diterapkan dengan izin eksplisit pengguna. apply_migration mengalami error requestState dua kali; fallback execute_sql memakai transaksi yang sama dan pencatatan history secara atomik. Total 15 migrasi terkonfirmasi.
- 12 assertion cloud dalam transaksi rollback: baca Admin, pembuatan tahun/dua semester/kelas/jadwal, penolakan tulis Siswa, 07:00+2×40+15=08:35, penolakan benturan, batch delete tanpa mutasi sebagian, pencabutan sesi, RLS dan penolakan RPC langsung. Script: scripts/database/verify-education.sql. Transaksi sukses dan dibatalkan; fixture tersisa nol.
- 40 tabel aplikasi, seluruhnya RLS. Tabel private memakai deny-by-default dan akses server. Advisor menyebut tabel private tanpa policy sebagai INFO sesuai desain; peringatan lama perlindungan password bocor belum aktif: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .
- Kontrak RPC dihasilkan dari replay migrasi lokal, terpisah dari snapshot tipe cloud. Fixture tanggal izin memakai WIB.

## Batas pengujian

Transaksi cloud di atas memeriksa fungsi database dengan fixture sementara dalam rollback, bukan login Auth/browser nyata. Uji visual browser Admin dan unggah/unduh file positif melalui sesi pengguna produksi belum dilakukan. Tidak mengubah akun Admin permanen atau konfigurasi Gmail. Penerimaan OTP di inbox tetap belum dibuktikan oleh tahap ini. Data siswa lama belum dimigrasikan.

## Rilis produksi

- Proyek: sim-muridv2 / prj_4UqcCPpKTdhHHD5693dgQtSaNFnK, team_L1PNdiXbJGCHeDliVTN2hirQ.
- Deployment: dpl_4sngpPy1mzLjFgbEBJxJBcuiamyV, READY, https://sim-muridv2.vercel.app .
- Kode dideploy langsung dari 134 file sumber/config lokal yang sudah diuji; bukan commit GitHub baru. Health HTTP 200 menunjukkan stage 15 dan cache-control no-store.
- Pemeriksaan log deployment pada 15 menit setelah rilis tidak menemukan log error/fatal; ini pengamatan singkat, bukan jaminan seluruh alur sudah diuji.
- GitHub create_tree ditolak auto-review karena meminta izin eksplisit nama repositori kamadmtsnf-ai/sim-murid. Tidak mencoba jalur lain untuk mengunggah ke GitHub. Pengguna kemudian mengizinkan push secara eksplisit ke kamadmtsnf-ai/sim-murid cabang main; sinkronisasi dilanjutkan.

- 14 pemeriksaan HTTP produksi lulus: health stage 15, lima halaman mengarah ke login, empat API menolak anonim, tiga API tulis menolak origin asing, dan direktori menolak POST yang tidak didukung. Bukti: stages-11-15-http.json.
