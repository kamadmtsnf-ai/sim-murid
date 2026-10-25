# P09 — Finalisasi dan jejak perubahan

25 Oktober 2026. Baseline main `6bc6866574c9def35dba7c06493d8f90d7f4a37c`.

Implementasi dipulihkan setelah reset lingkungan sebelum PR dibuat. Verifikasi terhadap berkas yang dipulihkan sedang dijalankan ulang; hasil sebelum reset bukan bukti untuk revisi ini.

Ruang lingkup: matriks state existing, promotion_history immutable, guard anti-truncate arsip, proyeksi allowlist audit baru/lama, reader Admin dengan pagination tuple waktu+UUID, viewer di Rekonsiliasi dan before/after aktual nilai/KKM. Tidak ada workflow approval/reopen universal baru; D10 tetap terbuka, rapor/ledger lama tidak ditimpa. Alasan bebas tetap pada transaksi sumber; audit hanya menyimpan reasonProvided. Nama pelaku dibaca dari profil saat ini, UUID pelaku/permintaan tetap stabil.

Migrasi kandidat pertama `20261024172006_finalization_audit_p09.sql` (SHA256 39e6b336cef34c7c8da8ceb3b0a629d3ecec04b9f3f0dac86085b9bfc77ca499) ditolak auto-review karena izin Tahap 9 umum tidak dianggap izin eksplisit untuk DDL/RPC produksi konkret. Tidak menghindari penolakan lewat execute_sql/CLI atau jalur lain. Database belum diubah. Setelah reset, CLI membuat ulang berkas `20261025013536_finalization_audit_p09.sql`, dengan koreksi prefix domain dan allowlist; berkas ini belum diterapkan dan tetap memerlukan persetujuan eksplisit. UI hanya aktif setelah read-only availability probe 1500 ms berhasil; Rekonsiliasi/ekspor existing tetap tersedia.

Semua fungsi baru SECURITY INVOKER, search_path kosong, EXECUTE hanya service_role; Admin/onboarding/session dari database. Client/API memakai identity server, private/no-store, timeout dan DTO ketat; tidak memakai metadata user untuk otorisasi. Tidak ada tabel baru, backfill atau rewrite log historis.

Tes kalender: fixture operasional memakai hari sekolah tetap di database terisolasi; overview menghormati policy Minggu sebagai hari libur. Kalender produksi tidak diubah. Hasil verifikasi akhir, cakupan per domain, batas bukti dan PR akan dicatat sebelum merge.
