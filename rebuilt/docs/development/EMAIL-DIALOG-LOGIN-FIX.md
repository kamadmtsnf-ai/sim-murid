# Perbaikan email, dialog dan Login

25 Oktober 2026 WIB. Baseline main 8c46be45c863a4d78d2e3077b82ec1564265a9b7. Branch fix/email-dialogs-login.

Status: implementasi dipulihkan setelah reset lingkungan; pengujian diulang, hasil lama tidak dianggap sebagai bukti untuk sumber pemulihan.

- Verifikasi email sebelumnya tidak memiliki input alamat. Tambah action address, validasi email kontak, expectedEmail dan existing profile read/update dengan version CAS. Nama/HP/bio dipertahankan, identity dari sesi, tidak mengirim OTP otomatis, readback wajib. RPC existing membatalkan kode/proof lama saat alamat berubah. Tidak ada migrasi DB atau perubahan Auth.
- Semua window.confirm pada aplikasi diganti konfirmasi async Radix AlertDialog. Fokus awal Batal, Escape/outside aman, restore fokus, satu dialog aktif, keputusan dibatalkan saat popstate/unmount ruang kerja. Nilai event/target form ditangkap sebelum await. Navigasi/logout dilanjutkan melalui event asli agar penutupan drawer dan pembersihan draft tetap berjalan. beforeunload saat tutup/reload tab tetap browser-managed.
- Login: hierarchy, spacing, card/brand, field52px, focus, remember-device dan Caps Lock. Session/username/password contracts tidak berubah.
- Perbaikan wrap tombol templat bantuan saat teks diperbesar untuk mencegah overflow yang ditemukan dalam QA terdahulu; harus diuji ulang.

Belum menguji pengiriman SMTP nyata, akun/data produksi, atau mengubah environment. Hasil terverifikasi ditambahkan setelah QA selesai.
