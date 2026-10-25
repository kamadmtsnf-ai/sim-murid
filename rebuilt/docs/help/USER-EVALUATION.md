# P11 — Protokol evaluasi pengguna

25 Oktober 2026 WIB. Status: siap dipakai; **belum ada sesi manusia atau baseline waktu**. Tes browser otomatis bukan UAT atau ukuran kepuasan. Jangan mengisi hasil contoh sebagai hasil nyata.

## Sesi sebelum/sesudah

Fasilitator menggunakan staging terisolasi setelah gerbang P10 terpenuhi. Gunakan data sintetis, persetujuan peserta dan akun sesuai peran; jangan merekam password/OTP atau merekam layar data produksi. Peserta masuk sendiri. Simpan identitas peserta terpisah dari catatan evaluasi, gunakan kode anonim. Tidak ada undangan/pesan otomatis dari fitur ini.

Untuk setiap tugas lakukan minimal tiga pengulangan dengan dataset setara pada baseline dan versi dengan bantuan. Catat detik dari instruksi hingga hasil terkonfirmasi, sukses/gagal, bantuan fasilitator, salah pilih periode/anak, input ulang dan status simpan yang tidak dipahami. Keberhasilan berarti hasil domain cocok dan akses asing ditolak, bukan sekadar tombol diklik. Target ditetapkan setelah baseline, bukan angka buatan.

| Peran/penugasan | Tugas | Verifikasi hasil |
|---|---|---|
| Admin/TU | Cari lalu tambahkan pengguna dan penempatan kelas | Tidak duplikat, username teks, periode benar |
| Kepala | Temukan evaluasi dan tindak lanjut | Agregat sesuai izin, tanpa identitas peer |
| Guru mapel | Input batch nilai dan periksa hasil | Nilai cocok, kelas asing ditolak |
| Wali kelas | Periksa kelengkapan dan pratinjau rapor | Kelas binaan benar, arsip tidak berubah |
| Guru wali | Catat bimbingan | Siswa dalam cakupan, catatan terkonfirmasi |
| Guru piket | Catat kegiatan harian | Tanggal/penugasan benar, tidak duplikat |
| Konselor | Tinjau tindak lanjut | Hanya cakupan yang diizinkan |
| Bendahara komite | Catat pembayaran dan cocokkan riwayat | Alokasi/nominal cocok, status jelas |
| Pengelola tabungan | Setor/tarik dan periksa slip | Saldo, fee dan ledger cocok |
| Siswa | Temukan jadwal, isi survei dan lihat rapor sendiri | Data sendiri, finalisasi jelas |
| Orang tua multi-anak | Pindah anak lalu lihat informasi | Data tidak tercampur antar-anak |
| Alumni | Akses dokumen kelulusan | Dokumen sesuai izin |
| Nasabah | Periksa rekening dan transaksi | Rekening asing ditolak |
| Calon siswa | Lengkapi biodata sesuai akses | Tidak mendapat akses akademik aktif |

## Form catatan privat

Satu baris per percobaan: kode peserta anonim, peran/penugasan, ID tugas, versi/SHA, baseline atau setelah, viewport, pengulangan, durasi detik, sukses, jumlah error/input ulang, bantuan fasilitator, temuan tersunting. Jangan commit catatan mentah atau identitas peserta.

Ringkasan agregat: median durasi per tugas/peran, jumlah sukses/total, bantuan/total, jumlah input ulang dan temuan. Bandingkan tugas/data setara; jangan mencampur hasil simulasi dengan manusia. Baseline, hasil setelah dan perbandingan saat ini **belum tersedia**.

Triase: P0 kebocoran/integritas/hilang data menghentikan sesi dan rilis terkait; P1 tugas inti terblokir harus diperbaiki serta diuji ulang sebelum penerimaan; P2 kebingungan/minor masuk backlog berprioritas. Setiap temuan berisi langkah reproduksi tersunting, dampak, pemilik, perbaikan/PR dan hasil uji ulang. Jangan mengubah ledger/arsip untuk membuat tugas tampak sukses.

## Pelaporan kendala

Di setiap halaman ruang kerja tersedia disclosure “Bantuan untuk …”. Buka dengan sentuh atau Enter/Space. Salin kode laporan dari error, jika tersedia; kode bersifat opsional. Tombol menyalin templat saja, tidak mengirim tiket. Jika izin clipboard ditolak, salin textarea secara manual. Kirim melalui saluran resmi admin madrasah yang sudah dikenal. Jangan menebak alamat/email/nomor dukungan.

Admin meminta langkah, waktu WIB, perangkat dan kode laporan; tidak meminta password/OTP/cookie/kunci API. Sunting tangkapan layar sebelum dibagikan. Kode UUID HTTP berbeda dari digest error halaman; keduanya ditelusuri mengikuti runbook operasi. Tidak semua kegagalan mempunyai kode. Bantuan tidak memberikan hak akses baru.

## Penerimaan

Masih terbuka: baseline manusia, sesi setelah, perbandingan, triase/perbaikan temuan dan persetujuan pemilik. Rekam bukti agregat tersunting setelah benar-benar dijalankan. P10 staging/Auth/Storage/load tetap terbuka; fitur bantuan tidak menutup gerbang tersebut.
