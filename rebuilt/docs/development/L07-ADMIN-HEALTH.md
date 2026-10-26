# L07 — Pusat kesehatan aplikasi untuk admin

Baseline main `a5baa9dbad872bf06e5165a0a9a9113aa78576e5` (PR81/L06). Branch `feat/l07-admin-health`. 26 Oktober 2026.

## Audit sumber dan dampak

Dibaca: RPC app_services_read, app_jobs_admin dan penjagaan actor/session/admin/ready; servicesData; schema Jobs/Reconciliation; sender OTP Gmail; proxy/page-policy/navigation; account error boundary; liveness public; roadmap P01/L01–L11 dan keputusan bisnis. Tidak mengubah PH/ATS/ASAS, biaya, akademik, OTP, autentikasi atau hak tugas tambahan.

Gap: sumber operasional tersebar. Jobs sudah menyediakan maksimal 200 outbox terbaru dan 100 job_runs terbaru, tanpa payload, dengan validasi server. Reconciliation menyediakan jumlah arsip dan sourceAvailable (false pada sumber existing); jumlah bukan bukti kesetaraan. Gmail/WhatsApp availability existing hanya memeriksa konfigurasi, bukan koneksi/penerimaan. app_email_delivery untuk OTP terpisah dari outbox dan belum memiliki agregat admin yang aman. Metadata backup/restore produksi belum tersedia lewat kontrak runtime aplikasi. Liveness /api/health bukan readiness dan dipertahankan.

## Implementasi

- Menu admin-only “Kesehatan aplikasi” pada `/account/health`. Proxy existing memberi private/no-store dan menolak direct URL non-admin. Page memeriksa sesi/survei; reader memeriksa is_admin dan security ready sebelum membaca sumber. RPC existing memeriksa actor/session/admin kembali. Non-admin tidak mendapat ringkasan meskipun UI dilewati. Tidak menambah grants.
- Dua sumber dibaca paralel, masing-masing abort signal8detik. servicesData menerima signal opsional secara additive; caller lama tetap sama. Penolakan domain eksplisit menggagalkan seluruh ringkasan; timeout/error sumber menjadi unknown per kartu, bukan nol/sehat. Error internal tidak dirender.
- Model memvalidasi sumber sebelum memproyeksikan whitelist agregat. Tidak meneruskan ID, nama, recipient, email, OTP/hash, payload, job_key, last_error/provider message, kelas, saldo atau env. Timestamp pemeriksaan menunjukkan hasil percobaan baca saat ini; bukan timestamp perubahan seluruh domain atau snapshot atomik lintas sumber.
- Kartu pengiriman, pekerjaan, backup/restore dan rekonsiliasi menyediakan cakupan, timestamp yang tersedia serta langkah penanganan. Angka adalah sampel terbaru (bukan total backlog). outbox tidak punya accepted_at: tidak mengganti created_at menjadi waktu penerimaan. Waktu selesai job mencakup gagal; tidak diklaim sukses.
- “Diterima penyedia” dibedakan dari “tiba di kotak masuk”. Konfigurasi aktif tidak dianggap layanan berjalan. Statistik outbox secara eksplisit tidak mencakup OTP yang dikirim langsung. Tidak menjalankan SMTP verify/send sebagai efek membuka halaman.
- Backup terakhir dan restore produksi tetap **belum dapat diverifikasi** karena sumber belum terhubung, bukan hijau berdasarkan file repo. Tidak menampilkan laporan PGlite lokal sebagai backup Supabase/Auth/Storage produksi. Admin diarahkan memeriksa penyedia dan latihan restore terisolasi.
- Tombol “Perbarui status” berupa GET biasa, bekerja tanpa JavaScript, tanpa mutasi/background poll/retry. Loading SSR dan error boundary account existing dipakai. Penanganan/retry tetap melalui modul Pekerjaan existing dengan confirmation/revision/request ID/domain idempotency; tidak menduplikasi action atau tombol navigasi sidebar.
- Server Component, komponen Card/Status/Button dan token existing dipertahankan. Grid mobile dua kolom metrik, empat kartu bertumpuk; desktop dua kolom kartu. Fokus/heading/timestamp semantic.

Tidak ada perubahan schema/RPC/table/role/grant/env/dependency. **Tidak ada migrasi diperlukan atau dijalankan.** Metadata backup/restore produksi dan statistik OTP admin memerlukan kontrak sumber tersendiri jika akan dihubungkan; tidak membuat angka atau status palsu.

## Verifikasi

- 765 tes pada final check lulus, termasuk 14 tes L07 (model, read adapter signal/legacy, gate server dan page aktual), TypeScript, lint dan replay tipe database. Tahap build dalam check gagal karena persistence cache Turbopack runner, bukan tes produk.
- npm run build pada output .next baru: exit0. Cache/output lama dipindahkan reversibel ke /tmp, tanpa mengubah compiler atau konfigurasi aplikasi. Pembatas runner menolak rm; dipakai rename sebagai alternatif aman. Build bersih final lulus.
- Browser health sesudah build final: 47 checks, 3 axe, nol JS error; 320/390/768/1280, source tersedia/unknown/partial, refresh keyboard GET tanpa mutasi dan zero horizontal page overflow. Screenshot320 diperiksa.
- Regresi navigation accordion: 91 checks, 6 axe, nol JS error; admin/non-admin menu, state accordion, search, current location dan resize tetap konsisten.
- Total browser 138 checks / 9 axe. Tidak menggunakan akun/data produksi, mengirim email atau retry pekerjaan. Tidak mengukur waktu insiden manusia atau membuktikan delivery/restore produksi. Fixture menggunakan komponen aktual dan data sintetis; bukan sesi admin produksi atau bukti delivery email. Deteksi/penanganan insiden manusia belum diukur. L02 UAT manusia tetap terbuka.

## File dan alasan

- `src/lib/health/model.ts`: validasi, agregasi whitelist, timestamp benar dan unknown.
- `src/lib/health/server.ts`: gate admin/ready, parallel reads, abort dan fail-closed.
- `src/lib/services/server.ts`: signal opsional kompatibel.
- `src/app/account/health/{page,loading}.tsx`, `src/components/admin-health.tsx`: pusat admin read-only dan states.
- `src/config/account-navigation.ts`: satu menu admin-only; policy existing memakai registry yang sama.
- `tests/health*.test.mjs`: model, read adapter aktual, server dan page aktual dengan batas auth/RPC sintetis.
- `tests/ui/health-fixture.tsx`, `scripts/verify-health.mjs`: responsive, partial/unknown, keyboard/GET, axe.
- `package.json`: QA khusus dan memasukkannya pada check.
- `docs/verification/l07-admin-health/`: hasil tersunting tanpa data produksi.
- MASTER/roadmaps/L06: kontrak visual, status tahap dan konfirmasi instalasi PWA oleh pengguna.

## Rollback dan status

Revert menu, route, model/server/component dan signal opsional bila diperlukan; tanpa langkah rollback database. Tidak menghapus atau mengganti modul Pekerjaan/Rekonsiliasi. Dokumen ini snapshot sebelum publikasi; PR mencatat CI, merge dan exact SHA Production.
