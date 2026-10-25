# Perbaikan email, dialog dan Login

25 Oktober 2026 WIB. Baseline main 8c46be45c863a4d78d2e3077b82ec1564265a9b7. Branch fix/email-dialogs-login.

Status: implementasi dan QA ulang selesai pada sumber pemulihan. PR [#61](https://github.com/kamadmtsnf-ai/sim-murid/pull/61); belum di-merge ke main. Hasil sebelum reset tidak dipakai untuk klaim rilis.

- Verifikasi email sebelumnya tidak memiliki input alamat. Tambah action address, validasi email kontak, expectedEmail dan existing profile read/update dengan version CAS. Nama/HP/bio dipertahankan, identity dari sesi, tidak mengirim OTP otomatis, readback wajib. RPC existing membatalkan kode/proof lama saat alamat berubah. Tidak ada migrasi DB atau perubahan Auth.
- Semua window.confirm pada aplikasi diganti konfirmasi async Radix AlertDialog. Fokus awal Batal, Escape/outside aman, restore fokus, satu dialog aktif, keputusan dibatalkan saat popstate/unmount ruang kerja. Nilai event/target form ditangkap sebelum await. Navigasi/logout dilanjutkan melalui event asli agar penutupan drawer dan pembersihan draft tetap berjalan. beforeunload saat tutup/reload tab tetap browser-managed.
- Login: hierarchy, spacing, card/brand, field52px, focus, remember-device dan Caps Lock. Session/username/password contracts tidak berubah.
- Perbaikan wrap tombol templat bantuan saat teks diperbesar untuk mencegah overflow yang ditemukan dalam QA terdahulu; harus diuji ulang.

Belum menguji pengiriman SMTP nyata, akun/data produksi, atau mengubah environment. Hasil terverifikasi ditambahkan setelah QA selesai.

## Verifikasi aktual

- npm ci lulus. npm run check lulus:687tes/75kelompok, typecheck, lint, DB types dan production build. Typecheck/lint serta build relevan diulang setelah perbaikan fokus/spacing. Tidak mengubah dependency/lockfile.
- Sepuluh suite browser:1357checks/98axe, tanpa pageerror pada hasil akhir. Login173/12, email87/10, popup45/4, forms50/4, classes411/17, committee92/6, schedules169/16, promotions104/13, insights53/4, bulk173/12. Detail pada ../verification/email-dialog-login/.
- Browser memakai komponen aktual dengan HTTP/Auth/clipboard sintetis dan CSS build. Login juga memeriksa halaman produksi lokal. Bukan UAT atau SMTP/live account test.
- Ditemukan dan ditangani dalam QA: race assertion/pemulihan fokus saat popup unmount, overflow bantuan saat teks400%, serta harness konfirmasi sinkron yang harus menunggu keputusan async. Driver test memutuskan AlertDialog nyata menggunakan pilihan accept/cancel existing, bukan mengganti window.confirm produksi.
- Uji popup meliputi initial focus aman, Escape, teks escaped, duplicate activation, cancellation on navigation, nested modal, draf tetap, logout cleanup lewat onSubmit asli tepat sekali, dan navigation handler asli. Dialog form dan jalur server/domain tetap mengikuti kontrak existing.
- beforeunload tetap native karena browser mengendalikannya. Tidak ada window.confirm/alert/prompt langsung pada source aplikasi.

Pengiriman OTP nyata belum diuji. Menyimpan alamat tidak mengirim OTP otomatis: klik Simpan email kontak, lalu Kirim kode verifikasi. Perubahan email menghapus proof lama lewat RPC existing; batas kirim/cooldown tidak direset. Tidak memigrasikan database atau mengubah konfigurasi provider.
