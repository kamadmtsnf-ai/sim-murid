# Konfigurasi cloud Rebuilt SiM-Murid

Diperiksa 19 Oktober 2026.

- GitHub: https://github.com/kamadmtsnf-ai/sim-murid ; branch main; aplikasi di rebuilt/.
- Vercel: sim-muridv2, ID prj_4UqcCPpKTdhHHD5693dgQtSaNFnK, team kamadmtsnf-8533. Produksi https://sim-muridv2.vercel.app . GitHub main terverifikasi pada commit 03323fc3c6b08d31fb85b935aad23ce022104114.
- Konfigurasi diterapkan: Root Directory rebuilt, Next.js, Node 24.x, npm ci, npm run build, region sin1. Deployment dpl_GsrqDDm36Jrm72NkhFy3LKo4iemL READY; log deployment completed.
- NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY produksi sudah tersedia melalui integrasi dan nilainya cocok dengan proyek khusus di bawah. Tidak ada nilai key dicatat di sini. Preview/development belum memiliki kedua variabel tersebut; gunakan proyek pengujian terpisah saat menyiapkan lingkungan nonproduksi.
- Supabase sim-muridv2: qpzoukkhdxpmbtkcqemj; organisasi kfiyszxxmalnabkfgcsm; ap-southeast-1. API https://qpzoukkhdxpmbtkcqemj.supabase.co .
- Tiga migrasi fondasi cloud diterapkan; versi lokal disamakan dengan riwayat cloud. 14 tabel public dan 10 private semuanya RLS; grant anon/authenticated = 0. Seed 7 peran, 7 penugasan, 16 mapel, 3 kebijakan.
- Advisor: INFO RLS tanpa policy dan indeks belum digunakan; tidak ada WARN/ERROR saat verifikasi fondasi. Policy akses operasional mengikuti tahap otorisasi.
- HTTP produksi terverifikasi: / 200, /foundation 200, /api/health 200 dengan stage 4 dan status ok, halaman tidak ditemukan 404. Health hanya liveness, bukan pemeriksaan koneksi DB. Deployment protection dipertahankan.

Tahap 5 autentikasi username/password, logout dan registry sesi sudah diterapkan. Total empat migrasi dan 26 tabel RLS. Lihat docs/verification/stage-05.md dan stage-05-live.json untuk hasil pengujian login produksi. Redirect URL auth berbasis email, storage, RLS operasional, onboarding dan fitur domain mengikuti tahap berikutnya.

## Tahap 6

Pengelolaan sesi/perangkat tersedia di /account/sessions. Lima migrasi diterapkan, 26 tabel tetap RLS. Pemeriksaan Auth session aktual, pencabutan dengan audit, serta peran Admin terkini ditambahkan. Lihat docs/verification/stage-06.md.

## Tahap 7

Enam migrasi; 27 tabel RLS dan 14 policy SELECT. /account/access dan /api/auth/access tersedia. Lima uji HTTP negatif dan 21 uji Auth/PostgREST produksi tambahan lulus setelah persetujuan pengguna. Akun validasi sudah dinonaktifkan dan seluruh sesi dicabut. Lihat docs/verification/stage-07.md.

## Tahap 8 — status terbaru

Tujuh migrasi cloud; tetap 27 tabel RLS dan 14 SELECT policy public. Keamanan akun dan gate terpadu aktif. Commit implementasi a42ad8d1f9a1225b31b74c528c5206aec363c674, deployment dpl_DxsMKqufPib9EA1sWrhYSnLcp9e4 READY; health stage 8. npm ci, 44 test lokal, build/lint/typecheck, 5 smoke HTTP dan 41 pemeriksaan produksi lulus. Kedua fixture validasi sudah dinonaktifkan dan seluruh sesinya diakhiri. OTP/pemulihan Tahap 9, formulir profil penuh Tahap 11, serta gate survei saat modulnya tersedia tetap belum diimplementasikan; lihat docs/verification/stage-08.md.

## Tahap 9 — parsial, status terbaru

Delapan migrasi; 27 tabel semuanya RLS. Pemulihan melalui Admin dan profil dasar aktif. Commit adbb42655466241759077b3e6a7b3c97e02ac8b5, deployment dpl_6dm31GLi5wBrvNPQvDUBYNqJjxz6 READY, health stage 9. 55 test lokal, build/lint/typecheck, 5 smoke HTTP dan 46 pemeriksaan integrasi produksi lulus. Fixture dinonaktifkan, sesi diakhiri dan kontak uji dipulihkan. Penyedia email aplikasi belum terhubung; OTP Guru/pemulihan mandiri email belum diimplementasikan dan tidak diklaim selesai. Lihat docs/verification/stage-09.md dan docs/deployment/email-setup.md.
