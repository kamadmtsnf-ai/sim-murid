# Impor pengguna dan migrasi CSV ke Excel

25 Oktober 2026 UTC. Branch feat/excel-user-import; baseline a416555b0f2fa31fb1e71812418299afe4b5c080 dari PR61 (masih terbuka). Perubahan dibuat bertumpuk di atas perbaikan email/dialog/Login; tidak menggabungkan PR61 secara otomatis.

## Perubahan

- Direktori admin: tombol impor, unduh template .xlsx (sheet Data kosong + Panduan), validasi/pratinjau server, hasil per baris, unduh kredensial rahasia, konfirmasi dan proses berurutan. Username wajib Text, nol awal/minus/angka panjang dipertahankan. Peran memakai kode existing.
- Pembuatan akun menggunakan POST /api/directory/users existing: server principal, begin/finish provisioning, HMAC fingerprint, UUID/request dan password identik saat retry. Tidak mengubah Auth/RBAC/database. Impor pengguna dapat berhasil sebagian; baris berhasil tidak dikirim ulang. Error/perubahan izin/hasil ambigu/limit menghentikan batch, lanjut secara eksplisit.
- Batas existing20akun/15menit tidak dibypass. Maks100baris dan1MiB perberkas. Lanjut hanya pada halaman yang sama; jangan reload sebelum memeriksa hasil dan menyimpan kredensial. Tidak menjanjikan recovery batch otomatis lintas reload.
- Kredensial sementara dihasilkan crypto per akun; wajib diunduh sebelum mulai dan diakui pengguna. Disimpan dalam memori halaman saja, tidak localStorage/log/git. Berkas mengandung password sementara: simpan pribadi. Tidak ada default password lemah. Tidak ada kiriman email otomatis atau verifikasi email kontak otomatis.
- Impor penempatan siswa, jadwal KBM dan nilai memakai XLSX, template XLSX dan validasi server berulang untuk preview/commit. Kontrak RPC bisnis/revisi/idempotensi/final lock tetap. Batch akademik tetap atomik sesuai SQL existing, berbeda dari akun Auth yang diproses per baris.
- Ekspor Poin Siswa dan Hasil Survei hanya Excel/PDF/sertifikat existing; seluruh fitur CSV pada source runtime dihapus. Format API csv tidak lagi diterima; klien lama perlu xlsx. Data filter/rumus/scope ekspor tetap.

## Batas berkas

ExcelJS4.4.0 existing; tidak menambah dependency. ZIP .xlsx diperiksa sebelum parser: compressed1MiB, actual expanded8MiB, maksimal512entri, CRC/ukuran/nama/struktur, tanpa ZIP64/enkripsi/traversal/makro/external relationships/DTD. Sheet Data dengan header persis, maksimal100baris, tanpa formula/date/hyperlink/rich-text objects. Panduan bukan data yang diimpor. Bukan dukungan format .xls/.xlsm. Nilai yang tampak formula tetap diekspor sebagai string, bukan formula executable.

## Verifikasi

`npm run check` lulus: 691 tes, TypeScript, lint, pemeriksaan tipe database, dan production build. Setelah penambahan CRC, 8 tes Excel dan TypeScript dijalankan ulang dan lulus. Verifikasi browser fixture: 120 pemeriksaan, 16 pemeriksaan axe pada viewport 320/390/768/1440 px, tanpa error JavaScript yang terdeteksi. Hasil terstruktur tersedia di `docs/verification/excel-import/`. Tidak melakukan migrasi cloud, membuat akun nyata, mengirim SMTP atau mengubah provider/env. Pengujian akun menggunakan stub HTTP/Auth; ZIP/workbook diuji dengan berkas XLSX nyata. UAT manusia dan seluruh kombinasi Excel desktop/perangkat belum dijalankan.
