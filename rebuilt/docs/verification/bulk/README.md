# Bukti P08

Pipeline `npm run check` exit 0: 636 tes/68 kelompok, TypeScript, lint, pemeriksaan tipe database dan production build bersih. Setelah peninjauan terakhir urutan pemeriksaan izin, 15 tes RPC/SQL diulang dan lulus, termasuk satu kasus tambahan memakai role database service_role sebenarnya. Total 637 kasus unik terverifikasi; bukan klaim satu pipeline berisi 637 tes.

Browser: wizard 173 checks/12 axe; regresi Kelas 411/17, Jadwal 169/16, Nilai 62/7. Total 815 pemeriksaan dan 52 pemindaian axe. Chromium 145; 320/390/768/1440 serta landscape pada wizard. Tidak ada pageerror JavaScript yang teridentifikasi.

Fixture memakai komponen sebenarnya dan boundary HTTP terisolasi; SQL memakai seluruh 44 migrasi pada PGlite. Katalog/izin, rollback preview, commit atomik, request/content dedup, readback ack hilang, stale state, overlap, relasi/tanggal/semester, nol/null, cap, autentikasi dan service_role diuji. Tidak membuat user, mengimpor, atau mengirim provider di produksi.

`schema-readiness.json` mencatat hash, izin eksplisit pengguna, penerapan cloud version `20261024165437`, metadata RPC/indeks dan hak EXECUTE. Penolakan awal auto-review diselesaikan dengan izin pengguna sebelum mencoba ulang apply_migration. Probe tanpa sesi sah ditolak; advisory setelah DDL tetap baseline (66 private RLS INFO, 79 unused index INFO, 1 leaked-password protection WARN existing). Readiness gate tetap memeriksa sesi/izin saat halaman dimuat ulang. UAT impor serta concurrency/load multi-worker pada produksi belum dijalankan.
