# Kelola tugas tambahan guru

25 Oktober 2026 WIB. Baseline main `18e4747`, branch `feat/teacher-assignments`.

## Alur admin

Direktori Pengguna → pilih Guru → Lihat detail → Kelola Tugas Tambahan. Pilih tugas, tanggal mulai, tanggal akhir opsional, lalu Simpan. Guru dapat memiliki beberapa tugas berbeda. Untuk mencabut, isi alasan minimal 5 karakter dan konfirmasi Cabut tugas. Penugasan lama tidak dihapus. Status mengikuti tanggal Asia/Jakarta dan `revoked_at`. Kepala Madrasah memerlukan konfirmasi tambahan karena akses luas.

Tugas yang dikelola: Kepala Madrasah, Bendahara Komite, Pengelola Tabungan, Guru Wali, Guru BK. Cakupan tingkat madrasah (`scope_class_id=null`), sesuai kontrak pemeriksaan tugas existing. Wali Kelas tetap melalui Kelas dan Siswa; Guru Piket tetap melalui roster modul Guru Piket. Penugasan Guru Wali tidak otomatis menghubungkan siswa; penempatan siswa bimbingan tetap melalui modul Bimbingan.

## Perubahan dan alasan

- `directory/[id]/page.tsx`, `manage-assignments.tsx`: tombol khusus admin pada detail guru, Dialog existing, formulir responsif, status, konfirmasi pencabutan, retry UUID/payload yang sama setelah hasil ambigu. Kontrol terkunci selama proses. Hak pengguna lain tidak bergantung pada tombol tersembunyi.
- `education/teacher-assignments.ts`, API `directory/[id]/assignments`: validasi ketat, date range, body bound 4096, same-origin pada mutasi, sesi/aktor dari server. Membatasi target ke guru aktif, tanpa mengubah role/flag pengguna.
- Migrasi `teacher_assignments`: RPC service-only SECURITY INVOKER dengan search_path kosong; memeriksa admin dan sesi lagi, serialisasi target, menolak periode tugas yang overlap, membatasi pencabutan ke tugas/target yang tepat. Catatan penugasan dan audit disimpan dalam transaksi yang sama.
- Tabel private receipt menyimpan UUID, fingerprint SHA256 dan referensi penugasan untuk retry, tidak menyimpan alasan bebas. RLS aktif, anon/authenticated tanpa akses, service_role hanya SELECT/INSERT. Indeks FK ditambahkan. Audit domain `user`, action mencantumkan tugas dan operasi; metadata menyimpan ID serta `reasonProvided`, sesuai kebijakan redaksi audit existing. Teks alasan tidak disimpan dalam audit.
- Runtime RPC types dan snapshot database diperbarui dari replay lokal. Tes fondasi menghitung migrasi dan tabel tambahan. Tes halaman menambahkan boundary mock client. Tidak mengganti matriks izin, database, framework atau aturan bisnis.

## Verifikasi

Empat tes database memakai PostgreSQL PGlite dengan seluruh migrasi: pembatas browser/admin/sesi, guru aktif, idempotensi, duplikasi periode, audit, serta grant dan pencabutan pada snapshot akses nyata. Dua tes API: origin, sesi/admin, actor spoofing, payload, konflik dan respons retry. Browser fixture menggunakan komponen asli, API terisolasi: empat viewport 320/390/768/1440, retry identik, konfirmasi pencabutan, tanpa overflow horizontal, empat scan axe tanpa pelanggaran, tanpa error JavaScript. Hasil di `docs/verification/teacher-assignments/results.json`.

TypeScript dan lint lulus; seluruh suite sebelum pemeriksaan backup lulus. Setelah menyesuaikan jumlah migrasi/tabel, tes operasional/restore 7/7, tes produksi 7/7, pemeriksaan tipe database dan production build lulus. Tes detail pengguna dijalankan ulang dengan kasus visibilitas admin (16/16); tes database penugasan 4/4 dan tes API 2/2 lulus. Pemeriksaan keyboard Escape mengembalikan fokus ke tombol pembuka pada keempat viewport. CI PR menjalankan ulang keseluruhan `npm run check`. Tidak membuat atau mencabut penugasan guru nyata saat pengujian. History pengelolaan menampilkan maksimal 500 catatan terbaru; riwayat audit tetap disimpan. Perubahan izin berlaku pada pemeriksaan server berikutnya; menu tab yang sudah terbuka perlu dimuat ulang. UAT dengan sesi guru produksi belum dilakukan.

## Verifikasi cloud

Migrasi `20261025091023_teacher_assignments` diterapkan pada proyek `sim-muridv2` (`qpzoukkhdxpmbtkcqemj`). Probe UUID sintetis ditolak (`denied`); fungsi tidak dapat dieksekusi anon/authenticated, hanya service_role; receipt RLS aktif dan authenticated tidak dapat membaca tabel. Tidak mengubah penugasan akun nyata. Advisor keamanan tetap menandai RLS tanpa policy pada tabel private (sengaja server-only), serta peringatan Leaked Password Protection Disabled yang sudah ada sebelum perubahan. Tidak mengubah konfigurasi Auth di luar lingkup tugas ini.
