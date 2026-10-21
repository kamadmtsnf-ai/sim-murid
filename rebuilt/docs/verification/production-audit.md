# Audit kebersihan dan kesiapan produksi — 21 Oktober 2026

Baseline main: `93501125b4f95d5b4d4f17bad3fa6aaa4a844dba`. Branch: `fix/production-readiness-audit`.

Status: perbaikan kode dan pemeriksaan otomatis lulus; **belum dapat dinyatakan 100% siap produksi**. Tes otomatis tidak membuktikan ketiadaan seluruh bug atau menggantikan UAT akun nyata, rekonsiliasi data, restore, dan pengujian penyedia eksternal.

## Perubahan dan analisis dampak

| File | Alasan dan dampak |
|---|---|
| `src/app/page.tsx` | Hapus badge/status pengembangan, narasi pembangunan ulang dan judul fondasi; ganti dengan informasi layanan dan petunjuk akun. |
| `src/app/account/access/page.tsx`, `src/app/account/directory/[id]/page.tsx` | Hapus janji tahap pengembangan yang sudah usang. Hak akses dan isi data tetap. |
| `src/app/foundation/page.tsx` (hapus) | Route publik khusus laporan pengembangan tidak lagi diperlukan. Tidak ada tautan aplikasi menuju route ini; URL lama sekarang 404. Riwayat audit tetap berada dalam dokumentasi. |
| `src/config/modules.ts` (hapus) | Registry seluruh modul berstatus planned tidak memiliki pemanggil; menu nyata memakai kapabilitas dan navigasi bersama. |
| `src/lib/contracts/result.ts`, `src/lib/supabase/server.ts`, `src/components/ui/badge.tsx` (hapus) | Kontrak/factory/komponen tanpa pemanggil setelah pembersihan. Factory autentikasi yang digunakan tetap berada di auth/http dan auth/read-server. |
| `src/components/ui/card.tsx` | Hapus CardAction/CardFooter dan selector card-action yang tidak dipakai. Card lainnya dipertahankan. |
| `src/lib/auth/validation.ts`, `src/lib/validation/pagination.ts`, `src/lib/student/server.ts` | Hapus alias Principal/PaginationInput dan re-export StudentSnapshot tanpa pemanggil; tipe StudentSnapshot yang dipakai panel biodata tetap tersedia. |
| `src/lib/education/server.ts` | Kegagalan konfigurasi, verifikasi identitas atau RPC gate yang dilempar sebelumnya lolos sebelum try milik route. Sekarang menghasilkan JSON 503 aman, tanpa membocorkan detail konfigurasi. Sesi anonim tetap 401, survei wajib 403, dan cookie refresh tetap disalin. |
| `src/app/account/page.tsx` | Dashboard sebelumnya mengabaikan error RPC survei wajib. Sekarang gagal tertutup melalui error boundary; tidak menampilkan dashboard saat pemeriksaan gagal. |
| `src/app/api/services/ai/route.ts` | Periksa kode hasil complete, bukan hanya transport error. Denied/null/objek tidak valid tidak lagi mendapat pesan sukses. Pesan JSON teknis diganti informasi hasil disimpan. |
| `src/app/api/services/cron/route.ts` | Tangani exception pada pekerjaan/dispatch dengan respons 503 aman; autentikasi token tetap dilakukan lebih dahulu. |
| `package.json`, `package-lock.json` | Deskripsi produk, perintah tes regresi/audit, override uuid 11.1.1 khusus ExcelJS. Tidak downgrade ExcelJS. |
| `tsconfig.json` | Aktifkan noUnusedLocals/noUnusedParameters untuk mencegah variabel dan parameter mati baru. |
| `scripts/audit-deadcode.mjs` | Audit graph import statis/dinamis memakai resolusi TypeScript, entry Next dan tes. Kandidat perlu review; bukan pembuktian seluruh cabang kode terpakai. Metadata kebijakan dan tipe hasil generator bukan deadcode untuk dihapus otomatis. |
| `scripts/smoke.mjs`, `scripts/verify-ui.mjs`, `tests/production.test.mjs` | Regresi route pengembangan, konfigurasi hilang, beranda responsif/axe, gate akses, AI persistence, dan cron failure. Mock hanya dalam proses tes, tidak masuk route aplikasi. |
| `docs/verification/production-audit/*` | Bukti pemindaian dependensi, graph dan hasil browser. |

Tidak ada perubahan migrasi/schema, data produksi, RBAC, API bisnis, formula nilai/fee, atau autentikasi internal. Field stage pada endpoint health dipertahankan untuk kompatibilitas pemantauan, bukan label kesiapan produksi. Peringatan rekonsiliasi dan pesan pemulihan pengguna tidak dihapus. Dokumentasi historis tetap menyimpan konteks pengembangan.

## Verifikasi yang benar-benar dijalankan

- `npm ci`: lulus dengan lockfile final. Ada peringatan deprecation upstream, bukan error instalasi.
- `npm run check`: lulus (162 tes pada saat itu, termasuk 3 tes regresi awal), drift tipe database dan production build.
- Setelah tambahan penanganan cron: typecheck, lint, build dan 4 tes regresi lulus. Total cakupan tes yang dijalankan: 159 tes sebelumnya + 4 regresi = 163. Ini bukan klaim E2E autentikasi produksi.
- Setelah pengaktifan noUnused dan audit script: typecheck dan lint lulus kembali.
- `npm run audit:deadcode`: 142 file sumber, 75 entry; 0 file unreachable di luar metadata kebijakan yang dijelaskan. Generator database dan migrasi bukan kandidat penghapusan.
- `npm audit --omit=dev --json`: 0 info/low/moderate/high/critical setelah override. Sebelumnya ada advisory uuid melalui ExcelJS. Pemeriksaan ini hanya dependensi produksi yang diketahui registry saat dijalankan, bukan sertifikasi keamanan.
- Ekspor XLSX roundtrip dan PDF diuji oleh suite operations/services/learning. ExcelJS dapat memuat dan memakai dependency uuid baru.
- HTTP smoke: 6 pemeriksaan lulus, termasuk /foundation 404 dan API dengan konfigurasi hilang memberi JSON 503; health hanya liveness.
- Browser Chromium: 60 pemeriksaan lulus, 8 layar axe tanpa pelanggaran, viewport 360/375/768/1024/1440. Tidak ada uncaught browser error. Login/form kelas memakai intercept; panel akun memakai fixture sintetis. API anonim 401 dan foreign-origin 403 diuji terhadap server production lokal dengan konfigurasi publik Supabase.
- Beranda desktop ditinjau visual dari screenshot. Tidak ada sesi autentikasi produksi atau pengiriman email/WA/AI sungguhan dalam QA ini.

## Dependensi dan pemeriksaan cloud

[GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq): advisory uuid terkait bounds pada v3/v5/v6 dengan buffer eksternal. ExcelJS menggunakan v4, tetapi dependency tetap diperbarui ke rilis patched 11.1.1 yang mendukung require. Tidak memakai `npm audit fix --force` yang mengusulkan downgrade ExcelJS.

Supabase security advisors dibaca tanpa perubahan database: 65 INFO RLS enabled/no-policy pada tabel private yang sengaja menolak akses langsung; tetap dipertahankan. Satu WARN **leaked password protection disabled** masih ada. Fitur tersebut membutuhkan Pro atau lebih tinggi menurut [panduan Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); audit ini tidak mengubah paket berbayar atau kebijakan autentikasi. Performance advisor menunjukkan 81 indeks belum terpakai: statistik pada sistem sebelum cutover bukan bukti indeks mati; indeks FK/query tidak dihapus berdasarkan hitungan ini. [Penjelasan advisor indeks](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Syarat rilis yang masih terbuka

1. UAT login, recovery, formulir, alur bisnis dan pembatasan akses melalui akun nyata untuk seluruh peran.
2. Rekonsiliasi ekspor sumber, saldo/alokasi/username serta bukti restore data, sesuai runbook cutover yang sudah ada.
3. Verifikasi konfigurasi Preview/Production dan pengiriman nyata penyedia yang dipilih, tanpa mengaktifkan pengiriman otomatis hanya untuk tes.
4. Keputusan D10 mengenai KKM/arsip rapor tetap terbuka; tidak ada pengubahan arsip diam-diam.
5. Load/concurrency dan uji dengan teknologi bantu oleh pengguna belum dijalankan dalam audit ini.
6. Pengaturan perlindungan password bocor Supabase masih perlu dituntaskan sesuai paket dan kebijakan institusi.

PR ini disiapkan untuk ditinjau. Main dan produksi tidak dinyatakan sudah menerima perubahan sebelum merge/deployment yang diverifikasi.
