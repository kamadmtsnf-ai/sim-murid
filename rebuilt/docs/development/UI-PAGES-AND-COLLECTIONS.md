# Peninjauan halaman dan daftar SiM-Murid

Baseline main: `1c9258cbb0ee5cf8c1d17d08425d89485ae69d8c`.

Aplikasi Next.js di `rebuilt/` memiliki 22 berkas halaman, termasuk tiga route dinamis untuk modul. Halaman ruang kerja berbagi navigasi, bantuan kontekstual, konteks akademik dan akses PWA. Halaman server menyelesaikan sesi, izin dan pemuatan data sebelum panel menerima data. Panel interaktif mengirim perubahan melalui API yang sudah ada. Tab dan paginasi diterapkan pada lapisan tampilan setelah data berizin diterima.

| Halaman atau kelompok | Keputusan tampilan |
|---|---|
| Beranda, Masuk, Bantuan akun, Pemulihan email | Satu alur utama per halaman. Ringkas pengantar Beranda dan Masuk, pertahankan petunjuk pemulihan. |
| Dashboard dan seluruh ruang kerja | Ringkas salinan di header dan footer bersama. Navigasi, identitas, konteks akademik dan bantuan tetap tersedia. |
| Profil, Email, Keamanan | Formulir dan langkah verifikasi tetap mengikuti urutan yang sudah ada. |
| Hak akses dan Pemulihan akun internal | Gunakan filter dan paginasi yang tersedia. |
| Direktori dan Detail pengguna | Gunakan paginasi Direktori. Detail berfokus pada satu pengguna dan penugasannya. |
| Biodata sendiri dan Detail biodata | Gunakan pembagian bagian formulir yang tersedia. Dokumen merupakan bagian dari satu biodata. |
| Relasi keluarga | Pisahkan formulir Orang tua dan siswa serta Saudara kandung ke dalam tab. Kedua formulir tetap terpasang agar isian bertahan saat pengguna berpindah. Masing-masing riwayat sudah memiliki pencarian dan paginasi. |
| Kelas dan siswa | Tampilkan 12 kelas atau siswa per halaman. Daftar siswa menjadi aksi utama. Edit dan arsip kelas dikelompokkan pada Kelola kelas. |
| Jadwal dan piket siswa | Gunakan tab KBM dan Piket yang tersedia. Tampilkan 15 entri per halaman. Pilihan untuk tindakan massal mencakup semua halaman daftar aktif. |
| Sesi akun | Tampilkan delapan sesi per halaman. Perpindahan akun memulai tampilan dari halaman pertama. |
| Pengaturan dan Kesehatan aplikasi | Gunakan pembagian pengaturan dan paginasi katalog/libur yang tersedia. Kesehatan menampilkan status komponen dalam ringkasan. |
| Operasional | Piket dan absensi memiliki pembagian tampilan. Absensi, bimbingan, iuran, dan tabungan sudah memiliki kontrol daftar. Pertahankan cakupan seleksi, riwayat transaksi dan ekspor. |
| Pembelajaran | Nilai, rapor, kenaikan dan katalog buku sudah menggunakan kontrol daftar. Pertahankan pembaca dokumen dan penyimpanan nilai. |
| Layanan | Notifikasi, poin, pekerjaan, analitik, audit dan tindak lanjut sudah memiliki kontrol daftar. Survei dan rekonsiliasi mengikuti langkah kerja domain. |

Paginasi baru membatasi jumlah item yang dirender dan menyembunyikan kontrol ketika cukup satu halaman. Data tetap bersumber dari respons yang sama. Tidak ada migrasi database. Skenario akun produksi dan perangkat fisik berada di luar verifikasi lokal.
