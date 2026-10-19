# Tahap 4 — Fondasi Database Supabase Rebuilt SiM-Murid

Versi proyek **0.4.0**, 19 Oktober 2026.

**Selesai:** paket schema/migrasi, konvensi, SDK dan verifikasi PostgreSQL terisolasi. **Belum dilakukan:** penerapan migrasi pada proyek Supabase daring dan verifikasi layanan Supabase aktual. Koneksi hanya menampilkan proyek `lms-nurul-falah`; proyek tersebut tidak dipilih dan tidak diubah. Target khusus Rebuilt SiM-Murid masih perlu ditentukan.

## 1. Hasil yang disertakan

- Tiga migrasi SQL dibuat dengan Supabase CLI yang dipin, berisi14 tabel public dan10 tabel schema privat.
- Dua domain rupiah untuk bilangan bulat eksak dan nonnegatif; UUID, textusername, date/timestamptz,FK,unique/check,index dan timestamptrigger.
- Data referensi wajib:7 role,7 tugas tambahan,16 mata pelajaran,3 versikebijakan. Tidak ada passworddefault,userAuth,datasiswa,tahunaktif,kelasaktif atau tarif yang dibuat-buat.
- RLS seluruh24 tabel; denydefault dan grantclient dicabut. Schema privat tidak diekspos lewatAPI. Duahelpertrigger security-invoker dengan search_path kosong; tidak ada SECURITY DEFINER/publicRPC bypass.
- Tabel internal untuk registry sesi,pemulihan,hashjawabankeamanan,verifikasiemail,audit,outbox,jobruns dan stagingimpor. Ini struktur pendukung, bukan alurAuth/email/worker yang telah berjalan.
- SDK Supabase browser dan request-scopedserver factories terpasang; seluruhkeyprivat tetap server-only. Cookieadapter server harus menyalurkan cookie dan cacheheaders, belum terhubung Proxy/sessionrefresh.
- Type snapshot14 tabel public dihasilkan dari introspeksi schema lokal. Bukan hasil generasi cloud. Script checkdrift dan prosedur regenerasitypes resmi dari target disertakan.
- Panduan local/fullSupabase, penerapan target, konvensi data, query verifikasi read-only, hasil tes, dan paket sumber kumulatif tahap3–4.

## 2. Daftar migrasi

| File | SHA-256 |
|---|---|
| 20261019061514_foundation_core.sql | `0dcad2f2c242fc5fffd4b428fd0e2dfa5d3eff8f5d5053fe6e5965815799cd61` |
| 20261019061517_foundation_operations.sql | `49be6d31973cfccd6dd8aa3112b6b2ba5ed31fc67f87f0cf1f4c1faa5e8e9475` |
| 20261019061520_foundation_reference_data.sql | `ad18254f9bcd428e9aed28c05e24c2ccef2c55aab5ab79419b73f73784b2ed1a` |

File diberi nama oleh `supabase migration new`, bukan timestamp yang dikarang. Setiapfile memakai transaksi. Master wajib berada dalam migrasi ketiga, bukan seedopsional produksi. seed.sql tidak membuatakun atau memasukkan data pribadi.

## 3. Tabel dan arah penggunaannya

| Schema | Kelompok tabel | Penggunaan |
|---|---|---|
| public | profiles | Identitas aplikasi yang mereferensikan auth.users; username tetaptext persis |
| public | role_catalog,assignment_catalog,user_roles,user_assignments,user_access_flags | Satu role dasar, banyak tugas, flag terpisah dari profil biasa |
| public | school_profile,academic_years,semesters,subjects,classes,holidays,memorization_catalog | Master administrasi; tahun/semester generated dan FKkonsisten |
| public | business_policies | RAPOR-1.0,FEE-1.0,SURVEI-REQUIRED-1.0; versi immutable |
| sim_murid_private | app_sessions,security_questions,recovery_requests,email_verifications | Struktur sesi/recovery/OTP; runtime pada Tahap 5–9 |
| sim_murid_private | activity_logs,outbox,job_runs | Audit append-only,idempotency dan fondasi operasi; workerbelumdibuat |
| sim_murid_private | import_batches,import_rows,legacy_id_map | Staging sumber asli,normalisasi,review dan pemetaanID tanpa menggabungkan akun numerik |

Tabel transaksi domain lengkap seperti ledgertabungan,absensisiswa,nilai,keluarga,enrollment,poin,survei dan dokumen ditambahkan pada tahap masing-masing. Tidak ada klaim semua modul database17domain sudah lengkap.

## 4. Kebijakan yang dikunci

- **Rapor:** PH20%+ATS30%+ASAS50%, Praktik terpisah. D10 perubahan KKM/arsip tetap OPEN.
- **Fee:** ribuan terdekat half-up; saldo dikurangi nominal Tarik, fee mengurangi uang diterima sesuai baseline slip.
- **Survei:** esai wajib sesuai daftar backend lama; esai peer opsional; validator langkah/final sama ketika alur dibuat.

Tabelkebijakan tidak menerapkan kalkulator atau validator survei dengan sendirinya. Implementasi dan tes domain tetap mengikuti tahap fitur.

## 5. Verifikasi yang benar-benar dijalankan

| Pemeriksaan | Hasil |
|---|---|
| Migrasi3 file dieksekusi pada enginePostgreSQL terisolasi | Lulus |
| Replay pada database kosong kedua | Lulus, jumlahmaster sama dan profileskosong |
| Pengujian SQL DB01–DB18 | **18 lulus, 0 gagal** |
| Customcatalog/advisory lokal | Lulus:24 RLS aktif,0 grant baca klien,0 SECURITY DEFINER,0 FK tanpa indeks |
| Type snapshot terhadap replayfresh | Lulus untuk14 tabel public |
| Validasi Zod/pagination/environment | **2 lulus, 0 gagal**; HTTPhanya tepatlocalhost/loopback |
| Typecheck | Lulus |
| ESLint --max-warnings0 | Lulus |
| Next.js production build | Lulus |
| Production HTTP smoke | **5 kelompok lulus**, /,/foundation,CSS,404,healthliveness |
| Pinningversi dan package-lock | Konsisten,versilangsungeksak |
| IntegritasZIP dan manifestSHA256 | Diverifikasi setelah pengemasan |

DB01–18 menguji: jumlahtable/master,RLS; rupiahpecahan/NaN/unsafeinteger; username00123vs123vs123abc; unique/FK/RESTRICT; rentangsemester; kelas/libur/penugasan; batasdurasi dan slotsesi; hash/TTL/attemptsOTP; auditimmutable termasukTRUNCATE; kebijakanimmutable; idempotensioutbox/job; stagingdedup; grant/schemaaccess; RLSdenybahkan saat SELECTterberi di transaksitest; hakservice; helperinvoker; updated_at; replaydatabasekedua.

Pengujian memakai **PGlite 0.5.10 / PostgreSQL 18.6 WebAssembly**, dengan stub auth.users dan role khusus dalam test harness. Bukan SQLparser/stringtest saja. Config Supabase CLI menarget PostgreSQL 17; verifikasi17 dan fullstackSupabase masih tertunda. Tidak tersedia Docker/Postgres native pada lingkungan ini. Tidak menjalankan Supabase platformAdvisors karena proyek Rebuilt belum tersedia; customcatalogcheck tidak diklaim sebagai Advisors platform.

**Tidak diuji/dilakukan:** Supabase Auth login/refresh,PostgRESTgrants/API,Storage,cloudSDKnetworkcall,concurrencyHTTPsesungguhnya,restorecloud,ujibeban atauvisualbrowser. Testidempotensidatabase membuktikan constraintunik, bukan exactly-once pengiriman provider.

## 6. Dependensi baru dan runtime

| Paket | Versi |
|---|---|
| @supabase/supabase-js | 2.118.0 |
| @supabase/ssr | 0.12.7 |
| server-only | 0.0.1 |
| supabase | 2.121.0 |
| @electric-sql/pglite | 0.5.10 |

Node verifikasi 24.19.0, npm 11.9.0. Versi langsung dipin dan package-lockdisertakan. Membaca dokumentasi Supabase migrations,SSR danRLS melalui sumber resmi. Endpointchangelog.md tidak dapatdibaca oleh penelusur karena MIMEtext/markdown; tidak ada klaim seluruhbreakingchangechangelog telahterverifikasi. InterfaceSDK aktual juga diperiksa dari package yang terpasang, termasuk cookie setAll(cookies,headers).

## 7. Cara melanjutkan

Ekstrak paket,masuk folder sim-murid,kemudian:

```bash
npm ci
npm run test:database
npm run db:advisory
npm run db:types:check
npm run check
npm run test:smoke
npm run dev
```

Tidak perlu kredensial atau project Supabase untuk testterisolasi. Baca docs/database/README.md sebelum menjalankan stacklokalDocker atau menerapkan migrasi daring. Jangan reset --linked proyekLMS/produksi. Tidak ada targetlink atau credential dalam paket.

Untukpenerapandaring,diperlukan nama/refproyekSupabase khususRebuiltSiM-Murid. Setelahtargetdipilih: baca schema/history,reviewdry-run3migrasi,terapkan sesuai lingkup,mintaAdvisorsaktual,generateTypesresmi dan ujiAPI/RLS. Tidak mengganti target keLMS tanpa instruksi.

Tahap 5autentikasi dapat dikembangkan di atas schema ini. Login yang benar-benar terhubung tetap memerlukan target Supabase yang sudahmenerima migrasi atau stackSupabaselokal penuh. Policyakses peran tetapTahap 7, bukan membuka semua tabel untuk menghindari queryditolak.

## 8. Acuan dan batas status

Dokumen dasar,matrixTahap 1 dan keputusanTahap 2 disertakan. Semua fitur operasional dalam registry tetapplanned/BELUM; kemampuanUI belum dinyatakan selesai hanya karena tabel sudahada. D10KKM tidakdiputusdiam-diam. Tidak ada pushGitHub,deploymentVercel,pengirimanemail/WA/AI atau modifikasiLMS pada tahap ini.

Rujukan: https://supabase.com/docs/guides/local-development/database-migrations ; https://supabase.com/docs/guides/auth/server-side/creating-a-client ; https://supabase.com/docs/guides/database/postgres/row-level-security .
