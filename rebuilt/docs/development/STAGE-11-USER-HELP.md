# P11 — Bantuan dan evaluasi pengguna

25 Oktober 2026 WIB. Baseline main `0fe007184b47cde38f774742e39a2b9814b9a2f2` (PR58). Branch `feat/user-help-p11`.

Status: implementasi bantuan dan protokol evaluasi; penerimaan manusia masih terbuka. P10 tetap parsial. Tidak menjalankan P12.

## Analisis dan perubahan

Shell sudah menerima menu berizin dan mengenali halaman; belum menyediakan bantuan kontekstual. Error HTTP/halaman sudah memiliki kode dari P10, tetapi belum ada templat pelaporan kendala. Baseline waktu tugas pada P01 belum tersedia sehingga tidak dapat mengklaim peningkatan keberhasilan pengguna.

- `src/config/contextual-help.ts`: panduan sesuai area akun, pengguna/keluarga, kelas/jadwal, kegiatan, transaksi, akademik dan layanan; menjaga periode, arsip dan retry ambigu.
- `src/components/help/contextual-help.tsx`: disclosure native, label/focus/feedback, kode opsional tervalidasi menggunakan validator P10, copy eksplisit dan fallback manual. Tidak mengumpulkan URL/query, identitas/data halaman, storage, telemetry atau mengirim tiket.
- `src/components/workspace-shell.tsx`: satu integrasi reusable setelah breadcrumb. Key pathname mereset kode/feedback saat navigasi; sidebar dan otorisasi tidak berubah.
- `docs/help/USER-EVALUATION.md`: protokol baseline/setelah, 14 tugas peran/penugasan, pengukuran, privasi dan triase. Ini instruksi pelaksanaan, bukan hasil UAT.
- `tests/contextual-help.test.ts`, `tests/ui/help-fixture.tsx`, `scripts/verify-help.mjs`: panduan/menu, semantik bisnis dan interaksi komponen aktual di browser lokal.
- `package.json`: unit test bantuan masuk check; dependensi/lockfile tidak berubah.
- Roadmap serta bukti verifikasi diperbarui sesuai hasil aktual.

## Batas

Tidak menambah database/API/RPC/role, kontak dukungan rekaan, pengiriman pesan atau layanan berbayar. Panduan hanya informasi, tidak mengizinkan fitur. Bagian bantuan tampil ringkas tertutup agar tugas halaman tetap utama. Clipboard hanya setelah klik; tidak ada persistence. UAT, data produksi, real Auth dan restore/load staging tidak dijalankan. Keberadaan panduan bukan bukti tugas manusia berhasil.

## Verifikasi

`npm run check`: typecheck, lint, 673 tes/73 kelompok, DB types dan production build lulus. Browser komponen aktual dengan CSS build terbaru: 41 checks/4 axe, tanpa pageerror; empat viewport dan landscape. `git diff --check` lulus. Tugas manusia dan perbandingan baseline tetap belum tersedia.
