# P09 — Finalisasi dan jejak perubahan

25 Oktober 2026. Baseline main `6bc6866574c9def35dba7c06493d8f90d7f4a37c`.

Implementasi dipulihkan setelah reset lingkungan sebelum PR dibuat. Verifikasi berkas pulihan telah diulang dan lulus: 655 tes/70 kelompok, TypeScript, lint, db types dan production build; browser 475 checks/52 axe. Hasil sebelum reset tidak dipakai sebagai bukti revisi pulihan.

Ruang lingkup: matriks state existing, promotion_history immutable, guard anti-truncate arsip, proyeksi allowlist audit baru/lama, reader Admin dengan pagination tuple waktu+UUID, viewer di Rekonsiliasi dan before/after aktual nilai/KKM. Tidak ada workflow approval/reopen universal baru; D10 tetap terbuka, rapor/ledger lama tidak ditimpa. Alasan bebas tetap pada transaksi sumber; audit hanya menyimpan reasonProvided. Nama pelaku dibaca dari profil saat ini, UUID pelaku/permintaan tetap stabil.

Migrasi kandidat pertama ditolak auto-review karena izin produksi konkret belum eksplisit. Setelah pemulihan dan merge PR #56, pengguna menjawab “ya boleh” atas permintaan konkret untuk `20261025013536_finalization_audit_p09.sql`. apply_migration berhasil pada sim-muridv2, cloud version `20261025014918`. Tidak memakai jalur alternatif untuk menghindari penolakan. UI memeriksa availability sesuai sesi saat halaman dimuat ulang; Rekonsiliasi/ekspor existing tetap tersedia.

Semua fungsi baru SECURITY INVOKER, search_path kosong, EXECUTE hanya service_role; Admin/onboarding/session dari database. Client/API memakai identity server, private/no-store, timeout dan DTO ketat; tidak memakai metadata user untuk otorisasi. Tidak ada tabel baru, backfill atau rewrite log historis.

Tes kalender: fixture operasional memakai hari sekolah tetap di database terisolasi; overview menghormati policy Minggu sebagai hari libur. Kalender produksi tidak diubah. Hasil aktual tersimpan pada [bukti P09](../verification/audit/README.md).


## Matriks status dan coverage

| Domain | State existing / kewenangan | Proteksi dan audit |
|---|---|---|
| Nilai/KKM | Input → periksa → simpan atau batalkan; Admin/guru kelas-mapel sesuai kepemilikan | Writer native tidak berubah hasil bisnisnya; before/after aktual KKM/penilaian/skor dan pembatalan ditambahkan. Zero/null/omitted score, replay/stale diuji. Nilai sumber tidak memperoleh final state baru. |
| Rapor | Draf belum lengkap → lengkap → terbit; Admin/wali kelas | Pemeriksaan UI bukan approval persisten baru. Snapshot immutable/duplicate lock existing, tambahan anti-truncate. Tidak ada reopen atau overwrite snapshot. |
| Tabungan | Transaksi → ledger/slip tetap → reversal baru; pengelola existing | Formula fee/saldo dan ledger tidak berubah; tambahan anti-truncate slip. Alasan pada transaksi sumber. |
| Survei | Draf → validasi → submit; responden sendiri, peer terpisah | Final answers/instrument/peer lock existing; tambahan anti-truncate termasuk draf untuk mencegah mass-delete melewati lock. |
| Kenaikan | Pemetaan → pemeriksaan → proses; Admin | promotion_history sekarang immutable/anti-truncate. Penempatan manual beralasan tetap command berikutnya, tidak mengedit sejarah. |
| Poin | Peristiwa dapat dikoreksi/batal → snapshot bulanan tetap | Immutable snapshot existing, tambahan anti-truncate; perhitungan SPK tidak berubah. |
| Absensi/piket/bimbingan/komite | Izin peran/kelas/penugasan/periode, koreksi/alasan existing | Audit native before/requested command diproyeksikan; tidak membuat final lock baru yang menghalangi koreksi sah. |
| Kelas/jadwal/keluarga/pengaturan/akun/buku | Domain native dan request/revision guard existing | Viewer memperlihatkan success audit yang memang ada, bukan seluruh read/attempt/worker/storage atau diff lengkap semua field. |

## Detail desain dan dampak

Allowlist rekursif dibatasi depth/ukuran/500 elemen: UUID, tanggal, angka/boolean, enum dan struktur aman. Notes/esai/jawaban/kontak/password/OTP/key/path/nama berkas/field tak dikenal tidak disalin. Description log baru dikosongkan. Log lama tetap immutable dan disaring saat dibaca; tidak mengklaim payload historis telah dihapus dari penyimpanan. Source/private idempotency receipts tetap utuh.

Viewer Admin menampilkan filter modul, waktu WIB, nama pelaku saat ini dan UUID/request stabil. Ini bukan snapshot nama historis. Maksimal 25 catatan dengan tuple cursor created_at/id, mengambil 26 untuk menentukan next, indeks global dan prefix domain; skor per siswa 10 per tampilan dalam shared TableRegion/Dialog. Missing before/after disebut eksplisit. Tidak mencetak JSON mentah atau menyimpan riwayat di browser.

API GET /api/audit memakai auth/survey gate existing, query ketat, timeout 10 detik dan DTO projection tambahan. Availability 1500 ms khusus Rekonsiliasi, fail closed; import bundle hanya pada cabang Rekonsiliasi. Tidak ada mutasi audit, role baru atau tombol pindah halaman duplikat sidebar. P08 tetap native writer; preview rollback masih mencakup audit.

Body writer cloud diperiksa read-only dan cocok dengan baseline sumber MD5 `1adfe9d6af38107a25aa5c6c47d394a6`. Cloud PostgreSQL 17.11. Changelog/docs Supabase diperiksa pada implementasi awal; tidak memakai ltree/legacy cipher/btree_gist/custom operator. Advisory baseline 66 private RLS INFO, 79 unused-index INFO, 1 leaked-password WARN existing; DDL P09 kemudian diterapkan setelah izin eksplisit. Sesudah DDL, private RLS INFO tetap66 dan leaked-password WARN tetap1; unused-index INFO menjadi81 karena dua indeks baru belum dipakai.

## Batas dan tindak lanjut

Kode/QA dan aktivasi skema P09 selesai setelah izin eksplisit. Reader/index/proteksi terverifikasi; UAT alur dengan akun produksi belum dilakukan. UAT akun nyata, load/concurrency multi-worker dan restore staging belum dilakukan (P10). D10/approval/reopen universal tidak diimplementasikan tanpa kebijakan. Jangan menyatakan merge sebagai bukti aktivasi.

Rollback: UI tetap tersembunyi jika RPC absen; fungsi lama berjalan. Jangan mematikan immutable triggers/menghapus log sebagai rollback. Bila perlu koreksi skema, gunakan forward migration ditinjau; jangan reset database atau linked db push tanpa rekonsiliasi cloud history.

PR implementasi P09: [#56](https://github.com/kamadmtsnf-ai/sim-murid/pull/56). Aktivasi database telah disetujui dan diterapkan; cloud version `20261025014918`.

Verifikasi aktivasi: reader SECURITY INVOKER/search_path kosong, EXECUTE hanya service_role; dua indeks dan tujuh trigger enabled. Pure projection menghapus notes/password/teks alasan, mempertahankan reasonProvided serta before0/after82; invalid-session read mengembalikan null. Body writer MD5 `2b154bdebcf9398226908c79ddeb660e` cocok dengan file migrasi. Tidak menguji proteksi dengan mengubah data produksi. Bukti pada schema-readiness.json.
