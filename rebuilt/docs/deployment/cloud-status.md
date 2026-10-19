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
