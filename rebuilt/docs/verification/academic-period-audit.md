# Sinkronisasi tahun ajaran dan semester — 22 Oktober 2026

Baseline: main `462ad2d9e2be622d615e57481e4a254a803178f1` (PR #15). Branch `fix/academic-year-semester`.

## Keputusan dan analisis dampak

Aturan pengguna: tahun ajaran `2026/2027` (input alternatif `2026-2027`), Ganjil Juli–Desember 2026, Genap Januari–Juni 2027. Semua pasangan harus berurutan.

Audit menelusuri seluruh referensi `start_year`, `year_start`, tahun ajaran dan semester pada source, RPC/migrasi, filter, penempatan, penilaian/KKM, rapor, kenaikan, jadwal, direktori, survei, ekspor dan kalender finansial. Database foundation sudah memiliki tanggal generated Juli–Juni serta semester yang tepat. Penilaian, kenaikan, iuran berbasis bulan dan poin juga sudah memakai batas tahun ajaran tersebut. Tidak diperlukan penggantian tipe kolom atau migrasi identitas/arsip.

Masalah yang diperbaiki:

1. Form Kelas hanya meminta tahun awal numerik; input baru kini pasangan tahun dengan validasi berurutan, kedua pemisah diterima. API menormalisasi ke kontrak RPC lama; request legacy `startYear` tetap kompatibel, field campuran/forged ditolak.
2. Beberapa label jadwal, penilaian, kenaikan dan survei menampilkan satu tahun; sekarang seluruh label akademik memakai formatter bersama. Direktori, PDF rapor, ekspor rapor CSV/XLSX serta survei memakai formatter yang sama.
3. Semester ditampilkan sebagai 1/2 di sejumlah titik; kini Ganjil/Genap, disertai tahun/bulan yang benar pada konteks input. Ordinal internal 1/2 tetap stabil.
4. Form penilaian dapat mempertahankan tanggal kotor dari semester sebelumnya; identitas form mengikuti kelas/mapel/semester, tanggal direset dan diberi min/max yang sesuai. Tanggal default untuk Genap memakai tahun kedua, termasuk Januari dan kelas historis.
5. Periode survei sebelumnya bisa memakai tahun/semester yang tidak sesuai tanggal (dibuktikan tes baseline menerima `saved` untuk tanggal salah). Validasi DTO, form dan fungsi SQL kini konsisten. Edit periode tidak boleh mengganti identitas tahun/semester diam-diam; survei/arsip lama tidak dimutasi secara massal.

## File dan alasan

| File di rebuilt/ | Perubahan |
|---|---|
| `src/lib/academic/period.ts` | Parser/normalizer pasangan tahun, label, batas semester, periode dari tanggal dan default tanggal penilaian. |
| `src/lib/education/validation.ts` | Adapter input pasangan tahun ke command RPC lama tanpa mengubah UUID/kontrak data. |
| `src/app/account/classes/class-panel.tsx` | Input pasangan tahun dan penjelasan kedua semester. |
| `src/app/account/{schedules/schedule-panel,directory/directory-panel,directory/directory-detail}.tsx` | Label tahun ajaran konsisten. |
| `src/app/account/learning/[module]/panel.tsx` | Penilaian/rapor/kenaikan, label dan rentang tanggal semester. |
| `src/app/account/services/[module]/{survey-form,insights}.tsx` | Pilihan tahun dan Ganjil/Genap, batas tanggal dan identitas periode. |
| `src/lib/learning/print.ts`, `src/app/api/services/exports/route.ts`, `src/lib/services/export.ts` | Label PDF/CSV/XLSX konsisten, tetap membaca snapshot lama. |
| `src/lib/services/validation.ts`, `supabase/migrations/*_survey_academic_period.sql` | Validasi semester survei pada DTO dan server database; invoker/grants tetap. |
| `tests/academic.test.ts`, `tests/classes.test.mjs`, `tests/database/{learning,services}.test.mjs` | Pair normalization, route aktual, batas kalender/leap day, KKM dan survei. |
| `tests/ui/academic-fixture.tsx`, `scripts/verify-academic.mjs`, `scripts/verify-classes.mjs`, `package.json` | Pemeriksaan browser lintas modul dan kompatibilitas suite Kelas. |
| `tests/database/foundation.test.mjs`, `docs/database/schema-snapshot.json` | Hitungan migrasi/snapshot yang diregenerasi. |
| `docs/decisions/approved-business-policy.md`, `docs/design-system/MASTER.md`, laporan ini dan `academic/*.json` | Aturan, hasil pengujian, dan batas verifikasi. |

## Validasi dan batas

Hasil final mesin tersedia pada `academic/automated-results.json` serta hasil browser di folder yang sama. Tes tanggal mencakup 30 Juni/1 Juli, 31 Desember/1 Januari, tahun kabisat, semester Genap tahun kedua, tahun historis, input tidak berurutan, request legacy, dan date draft yang harus direset saat semester berganti.

Pengujian browser memakai komponen aktual dengan fixture sintetis dan GET yang diintersep. Pengujian SQL memakai database terisolasi. Tidak ada CRUD siswa, akun, penilaian, atau survei produksi untuk pengujian. RBAC/autentikasi, rumus, kebijakan arsip dan kalender transaksi tidak diganti. Normalisasi hanya memengaruhi input/tampilan/ekspor serta validasi penulisan periode baru; tidak menulis ulang snapshot rapor lama.

## Hasil akhir dan rilis database

- `npm run check`: lulus, 266 tes/0 gagal, TypeScript, lint, replay tipe database dan production build.
- Browser periode akademik: 41 pemeriksaan/6 layar axe; Kelas: 360/16; regresi umum: 69/8. Seluruhnya lulus, tanpa error JavaScript pada skenario tersebut.
- Migrasi `20261022094510_survey_academic_period` terpasang di project yang sama. Body produksi cocok dengan SQL yang diuji, invoker dan grants service_role-only tetap sama, panggilan tanpa identitas ditolak. Tidak mengubah record periode/rapor lama.
- Advisor sebelum/sesudah identik; warning leaked password protection yang sudah ada tetap di luar lingkup. [Rujukan remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Tes survei baru gagal pada baseline karena tanggal di luar semester masih diterima, kemudian lulus setelah perbaikan. Kesalahan locator pada skrip browser baru diperbaiki sebelum hasil final; bukan hasil pengujian aplikasi yang disembunyikan.
