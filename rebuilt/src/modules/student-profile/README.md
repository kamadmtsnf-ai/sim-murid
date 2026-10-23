# M04 — Biodata dan dokumen

Implementasi aktif: `src/app/account/biodata`, API `student-profile/[id]` dan `student-documents/[id]`, schema/normalisasi pada `lib/student`, serta inspector/metadata/GC pada `lib/documents`.

87 field dan kelengkapan kondisional mengikuti spesifikasi M04 dan `rules.json`. Pemilik siswa/calon/alumni dan Admin sesuai izin dapat menulis; parent hanya membaca relasi yang diverifikasi. Principal/sesi diperiksa server dan RPC; bukan username request. Revision dan request ID mencegah penimpaan/dobel simpan.

Berkas privat di bucket student-documents, maksimal 50 MiB; metadata lewat API, byte lewat signed upload tanpa upsert. Server memverifikasi ukuran, MIME, isi PDF/gambar dan checksum sebelum status ready. Penggantian menjaga dokumen lama hingga pengganti valid; penghapusan/GC dapat dilanjutkan. Signed URL preview/unduh berlaku 60 detik.

Regresi: `npm run test:biodata`, `npm run test:education`; uji browser `npm run test:biodata:browser` membutuhkan Playwright/esbuild/axe/Chromium sebagai alat QA eksternal. Lihat `docs/verification/biodata-audit.md` untuk cakupan dan keterbatasan. Tidak menyatakan integrasi Storage produksi selesai hanya karena fixture berhasil.
