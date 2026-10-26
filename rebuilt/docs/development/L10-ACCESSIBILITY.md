# L10 — Aksesibilitas menyeluruh

Tanggal26 Oktober2026 Asia/Jakarta. Baseline main59ee00ca94191cf0d42e3406632242137a3bbc38 (PR84/L09). Branch feat/l10-accessibility.

Status checkpoint: implementasi; JANGAN merge sebelum pengujian akhir/CI. Sesi lokal sebelumnya terinisialisasi ulang sebelum perubahan tersimpan, sehingga bukti otomatis harus dihasilkan ulang. Riwayat sesi mencatat107 pemeriksaan khusus/17 axe dan54 pemeriksaan design system/9 axe lulus; angka tersebut bukan artefak verifikasi checkout ini. Suite Login menemukan overflow pada320px dan root text400%; penyebab masih diisolasi.

Temuan/perbaikan yang dipulihkan:
-15 landmark main-content pada11 berkas tanpa target fokus: tabIndex=-1 sehingga skip link benar-benar memindahkan fokus, tanpa memasukkan main ke urutan Tab normal.
-Button bergantung box-shadow/ring: outline solid ketika focus-visible memperkuat fokus khususnya forced-colors yang menghilangkan shadow.
-Ukuran kompak24/32px: target produk44×44px; ini bukan klaim batas minimum AA universal. Aturan ds-actions/dialog yang menimpa min-width diperbaiki.
-Judul/label panjang pada teks200%: wrapping, max-width dan tinggi minimum; fieldset dapat menyusut.

Pertahankan autentikasi, RBAC, payload, semua fungsi bisnis dan database. Tidak perlu migrasi. Jangan mematikan validasi atau mengendurkan tes untuk melewati kegagalan.

Rencana verifikasi: npm ci, npm run check, source inventory; browser keyboard/forced-colors/200%text/320px reflow/modal/table/tabs, regresi design system, navigasi, Login dan feedback modal. Tunggu CI/Preview berhasil sebelum merge, kemudian periksa primary Production alias dengan exact merge SHA.

Penerimaan manusia masih terbuka: NVDA/VoiceOver, keyboard dan zoom OS nyata, touch/standalone PWA, reCAPTCHA Google nyata, konten PDF. Axe nol bukan sertifikasi WCAG2.2AA. L02 manusia, L09 field/load dan restore staging tetap terbuka.

Referensi: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html ; https://www.w3.org/WAI/WCAG22/Understanding/reflow.html ; https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ .
