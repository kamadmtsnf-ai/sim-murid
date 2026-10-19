# Konfigurasi cloud Rebuilt SiM-Murid

Diperiksa 19 Oktober 2026.

- GitHub: https://github.com/kamadmtsnf-ai/sim-murid ; branch main; aplikasi Next.js di rebuilt/. Kode GAS root dipertahankan.
- Supabase: sim-muridv2; ref qpzoukkhdxpmbtkcqemj; organisasi kfiyszxxmalnabkfgcsm; Singapore ap-southeast-1.
- API URL: https://qpzoukkhdxpmbtkcqemj.supabase.co
- Tiga migrasi fondasi berhasil diterapkan. Versi lokal disamakan dengan versi yang dicatat MCP agar tidak diterapkan ulang oleh CLI.
- Verifikasi cloud: 14 tabel public + 10 sim_murid_private; seluruhnya RLS aktif; grant anon/authenticated = 0. Seed: 7 peran, 7 penugasan, 16 mapel, 3 kebijakan.
- Advisor: 24 INFO RLS tanpa policy (akses ditutup sampai tahap otorisasi), 22 INFO indeks belum digunakan pada database baru; tidak ada temuan WARN/ERROR dari kedua pemeriksaan.
- Vercel: pembuatan proyek sim-muridv2 pada team_L1PNdiXbJGCHeDliVTN2hirQ ditolak API 403 forbidden. Belum ada deployment atau environment Vercel. CLI terautentikasi tidak tersedia.

## Selesaikan Vercel setelah izin tersedia

Import repositori di atas ke team kamadmtsnf-8533, nama proyek sim-muridv2, Root Directory rebuilt, framework Next.js, Node 24.x, install npm ci, build npm run build, region sin1. Gunakan default deployment protection. Hubungkan branch produksi main.

Atur NEXT_PUBLIC_SUPABASE_URL ke URL proyek di atas dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY dari API Keys proyek yang sama pada development/preview/production. Jangan masukkan secret atau service_role ke variabel NEXT_PUBLIC. Redeploy setelah variabel tersedia, lalu verifikasi /, /foundation, /api/health dan 404. Tidak ada nilai key yang disimpan di dokumen ini.

Auth, redirect URL produksi, secret backend, RLS operasional, storage dan fitur domain mengikuti tahap implementasi selanjutnya; aplikasi saat ini masih fondasi Tahap 4.
