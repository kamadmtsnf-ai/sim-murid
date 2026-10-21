# Cutover Tahap30 — gerbang penerimaan

Status: belum diizinkan dinyatakan selesai karena ekspor spreadsheet/Drive, backup pemulihan dan UAT pengguna belum tersedia. Aplikasi dan alat pemeriksaan dapat diterbitkan tanpa memindahkan sumber produksi atau menonaktifkan sistem lama.

1. Bekukan ekspor sumber: commit aplikasi, setiap sheet CSV/JSON, tipe/header, jumlah baris, timezone dan checksum SHA256; username tetap string, termasuk nol awal. Inventaris trigger lama dan dokumen Drive beserta pemilik/izin/checksum. Jangan menaruh ekspor pribadi pada git.
2. Cadangkan database target dan Storage ke media privat, catat waktu/retensi/akses operator. Restore ke proyek staging terpisah; buktikan Auth/profil/relasi/dokumen dapat dibaca dengan akun sanitasi. Backup tanpa percobaan restore belum memenuhi gerbang.
3. Review collision username, FK orphan dan pemetaan ID sumber→UUID. Import bertahap user/relasi/master→enrollment/jadwal→transaksi/nilai→SPK/survei→metadata dan berkas. D10 tidak mengizinkan kalkulasi ulang arsip rapor.
4. Bentuk manifest normalisasi source dan target: entities:{nama:{count,orphans,digest}}, usernames:string[], savingsBalances, feeCash, feeAllocations, gradesByPeriod, pointReplay, surveyProgress, documentChecksums, documentAccess. Nilai uang berupa string integer, bukan float. Digest berasal dari baris kanonis dengan ID sumber stabil. Jalankan `node scripts/release/reconcile.mjs source.json target.json report.json`. Hilangnya satu bukti membuat hasil blocked. Lakukan investigasi mismatch; jangan membuat transaksi atau nilai palsu untuk menyeimbangkan total.
5. Jalankan seluruh pengujian lokal dan cloud rollback. UAT akun sanitasi: Admin, Kepala, Guru mapel, Wali Kelas, Guru Wali, Piket, BK, Bendahara, Pengelola Tabungan, Siswa, Orangtua multi-anak, Alumni, Nasabah, Calon. Periksa UI→API→data→ekspor serta penolakan lintas pemilik, revoked session, offline/conflict, final lock, dokumen, SMTP, WA/AI terkonfigurasi.
6. Uji60 dan132pengguna terautentikasi dengan campuran baca/tulis yang disepakati pada staging; ukur p50/p95/error/retry/lock. `scripts/release/load-readonly.mjs` hanya baseline liveness tanpa autentikasi, bukan pengganti UAT atau benchmark bisnis. Jangan mengklaim kapasitas berdasarkan health endpoint.
7. Review scheduler baru/trigger lama dan status ambigu outbox. Pastikan satu pengingat sukses per guru/hari; matikan trigger lama hanya pada waktu cutover yang disepakati. Pastikan credentials SMTP/WA/AI tersedia tanpa disalin ke laporan.
8. GO hanya setelah bukti rekonsiliasi, restore, UAT dan beban diterima penanggung jawab sekolah. Jalankan delta final, verifikasi, baru alihkan trafik. Jika gagal, hentikan mutasi baru dan kembali ke snapshot/route lama sesuai runbook yang diuji; jangan menghapus ledger/arsip untuk rollback aplikasi.

## Riwayat migrasi

MCP apply_migration dapat memberi timestamp berbeda dari file sumber. Pertahankan file lama dan catat pemetaan versi/checksum. Jangan `db push --linked` mentah sebelum reconciliation history dan dry-run. Penolakan review atas penghapusan file lama pada tahap sebelumnya tetap dihormati.
