# Konfirmasi logout

26 Oktober 2026 WIB. Branch `feat/logout-confirmation`.

FormNavigationGuard selalu meminta konfirmasi sebelum form POST `/api/auth/logout` diteruskan. AlertDialog existing menampilkan judul “Keluar dari aplikasi?”, tombol aman “Tetap di aplikasi” dan aksi “Ya, keluar”. Isian belum disimpan/hasil ambigu dijelaskan dalam modal yang sama, tanpa dialog bertumpuk. Selama penyimpanan berjalan, guard existing tetap memblokir logout dan menjelaskan alasannya. Banner pending yang sudah usang dibersihkan pada percobaan berikutnya setelah proses selesai.

Ref mengunci permintaan konfirmasi yang bersamaan. Pembatalan/Escape tidak meneruskan submit sehingga cleanup draft/preferensi di form logout tidak dijalankan. Konfirmasi yang disetujui meneruskan requestSubmit existing, termasuk native validation dan handler cleanup. Form yang sudah dilepas tidak dikirim. Tidak mengubah API autentikasi, sesi, cookie, database atau mekanisme logout.

Ditemukan dan diperbaiki konflik Escape ketika konfirmasi berada di atas drawer dalam React root berbeda: confirmAction menangani Escape pada capture selama konfirmasi aktif, menghentikan event agar drawer di bawahnya tidak ikut tertutup, dan membersihkan listener pada semua hasil keputusan. Fokus kembali ke pemicu yang masih terpasang.

## Verifikasi

- npm ci; TypeScript, lint, 2 tes formulir, 6 tes UI, production build dan git diff --check lolos.
- verify-forms.mjs: 80 pemeriksaan dan 7 axe; verify-confirm.mjs: 45 pemeriksaan dan 4 axe. Tidak ada JavaScript error pada hasil tersebut.
- Logout manual pada 320/768/1440: pending diblokir, dirty warning, pembatalan dan Escape mempertahankan draft, fokus kembali, dialog muat di viewport, clean form tetap meminta konfirmasi, submit ganda hanya satu modal, persetujuan mengirim tepat satu native POST. Suite formulir existing juga menguji 320/390/768/1440.
- `node scripts/verify-forms.mjs --logout-only` tersedia untuk regresi logout terfokus (31 pemeriksaan, 3 axe).
- Fixture sintetis dan intersepsi API; tidak mencabut sesi produksi atau melakukan UAT akun nyata/perangkat fisik.

Kode dan bukti disiapkan pada branch pengembangan; belum dipublikasikan atau di-merge.
