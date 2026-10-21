# Tahap 21–25 — biaya/slip, nilai/rapor, kenaikan/ijazah, buku digital

Target: GitHub kamadmtsnf-ai/sim-murid main (`rebuilt/`), Supabase sim-muridv2, Vercel sim-muridv2. Tanggal 21 Oktober 2026.

| Tahap | Hasil |
|---|---|
|21| Bracket inklusif dengan validasi overlap; toggle dan kalkulator biaya server FEE-1.0; debit nominal bruto, tunai dikurangi biaya; nomor slip kategori berurutan; snapshot immutable, terbilang, HTML/PDF; antrean Gmail penerima Admin/Pengelola beremail terverifikasi, claim eksklusif dan deduplikasi |
|22| Batch nilai berdasarkan kelas/mapel penugasan aktual, nilai 0 berbeda kosong; PH tidak memakai ulang nomor historis; ATS/ASAS/Praktik upsert dan kepemilikan; koreksi/void audit before-image; KKM per kelas/mapel/tahun/semester dan snapshot pada penilaian |
|23| Draft RAPOR-1.0 PH20%+ATS30%+ASAS50%, Praktik terpisah; predikat termasuk KKM100; publikasi Admin/wali kelas setelah lengkap; arsip immutable dengan identitas sekolah/siswa dan sumber nilai; guru mapel menerima hanya mapel berizin termasuk arsip terbit; PDF satu/pilihan/semua dan perjenis |
|24| Validasi pemetaan massal atomik7→8→9→Alumni/calon→7, histori dan perlindungan proses ganda; penempatan/pemulihan manual;13metadata ijazah;3slot IJAZAH/TRANSKRIP/SKL; global+override allow/deny/inherit terpisah lihat/unduh; alumni baru deny |
|25| Katalog metadata lengkap, pencarian/filter/paginasi50, premium server-side; private PDF dan URL HTTPS lama; PDF.js6.4.299, halaman/gulir20halaman/zoom dan fallback standar; unggah bertoken, validasi isi/checksum, penggantian tahan stale dan cleanup objek |

Navigasi tersedia dari `/account`. Akademik/ijazah/buku di `/account/learning/{grades,reports,promotions,books}`, biaya/slip pada `/account/operations/savings`. API terotorisasi server menggunakan sesi aktual; seluruh RPC baru hanya service_role, tanpa SECURITY DEFINER tambahan. Bucket learning-private privat,50MiB, tanpa policy client. URL eksternal hanya ditampilkan pada browser pembaca berizin; server tidak mengambil URL sembarang.

## Bukti validasi

- npm ci lockfile579packages berhasil. Typecheck, lint tanpa warning,129pengujian lokal, drift tipe dan build produksi lulus.15pengujian baru meliputiDTO,terbilang,PDF dan12skenario domain/database dengan banyak assertion.
-27assertion Supabase cloud lulus dengan hak service_role dalam transaksi rollback (`scripts/database/verify-learning.sql`). Memeriksa semua lima tahap, gross debit, nominal tunai, immutability snapshot, replay, izin, dan premium. Tidak mengirim email atau mengunggah file aktual. Fixture tersisa nol pada pemeriksaan akhir.
-25migrasi terpasang,66tabel aplikasi seluruhnyaRLS; lima migrasi baru melalui apply_migration berhasil. Bucket privat terkonfirmasi. Advisory katalog lokal tidak menemukan masalah grant/RLS/security-definer/FKindex. Supabase Advisor mencatat INFO52tabel private RLS tanpa policy sesuai deny-by-default, serta WARN lama [leaked-password protection belum aktif](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- HTTP dan deployment dicatat pada bukti rilis setelah deployment selesai.

## Batas dan keputusan terbuka

D10 tetap terbuka: KKM baru berlaku pada konfigurasi/draft dan penilaian baru; snapshot nilai lama serta rapor terbit tidak diubah. Penerbitan ulang rapor ditolak sampai ada kebijakan koreksi arsip yang disepakati.

Antrean email diproses satu penerima per klik “Kirim/lanjutkan”; status sending/ambiguous tidak diulang otomatis. Retry failed tidak mendebit ledger ulang. Penerimaan SMTP tidak membuktikan pesan masuk inbox. Scheduler massal mengikuti tahap job berikutnya. Tidak ada pengiriman aktual saat validasi.

PDF memakai font Latin standar dan karakter di luar font diganti `?`. Tanda tangan berupa ruang tanda tangan, bukan tanda tangan digital. Lihat/unduh ijazah diperiksa terpisah sebelum pengiriman bytes; pembatasan unduh tidak mencegah seseorang menyimpan bytes yang sudah diizinkan untuk dilihat. URL buku eksternal mengikuti ketersediaan/CORS/izin penyedia; fallback standar/buka terpisah tersedia.

Belum diuji dengan browser produksi terautentikasi lintas peran, unggah Storage aktual50MiB, atau dua koneksi database paralel independen. Uji PDF memuat kembali dokumen yang dihasilkan; belum merupakan pemeriksaan visual semua nama/rapor panjang. Tidak mengimpor data historis atau mengubah password Admin permanen.
