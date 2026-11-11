# WP-08 — Otomatisasi dan pemantauan Web Push

Tanggal 11 November 2026 WIB. Baseline main `bddff2c5af5d870f0a3fa369931279078b4ddc80` (PR #105, WP-07). Cabang kerja `feat/web-push-wp08`.

## Status operasional

Implementasi lokal menambahkan riwayat worker, alarm, pemicu yang dapat diperiksa, kebijakan retensi, dan rotasi bertahap. Penerimaan scheduler managed, kapasitas staging, serta penerimaan provider dan perangkat masih terbuka. Supabase produksi masih mempunyai 55 migrasi, `pg_cron` 1.6.4, Vault 0.3.1, tanpa `pg_net` atau job `sim-murid-web-push-sweep`. Flag global, dispatch, uji, scheduler dan daftar kategori tetap nonaktif atau kosong. Tidak ada delivery. Organisasi Supabase memakai paket Free dan tidak memiliki branch pengembangan SiM-Murid. Kedua koneksi Supabase belum menampilkan proyek staging SiM-Murid. Metadata tim Vercel yang tersedia tidak memuat paket aktual.

## Pemicu dan pemantauan

- Jalur operasional memakai Supabase Cron per menit, Vault dan `pg_net` untuk POST ke `/api/push/worker`. Installer SQL tetap berada di `supabase/operations/` dan mendaftarkan job dalam keadaan nonaktif. Keberadaan fungsi, setting atau job belum membuktikan tick berjalan.
- URL HTTPS Vercel harus cocok dengan pin operator di Vault sebelum bearer terpisah dibaca. Worker memeriksa bearer, origin dan konfigurasi lingkungan. Browser API tetap memakai sesi dan aturan same-origin yang sudah ada. Respons HTTP scheduler dicatat sebagai kode dan waktu. Body, header, URL serta secret tidak masuk ringkasan Admin.
- Tick memilih antrean siap, lease kedaluwarsa, wake yang tersimpan, pengingat survei yang aktif atau heartbeat idle setiap dua menit. Worker menangani maintenance, klaim dan dispatch. Klaim worker 70 detik. Maksimal 20 delivery per run dan 4 paralel, dengan anggaran kerja 42 detik dan pencatatan akhir maksimal 2 detik. Timeout request scheduler 50 detik, durasi fungsi 60 detik.
- Panel **Pekerjaan** dan **Kesehatan Aplikasi** menampilkan tick terakhir, heartbeat selesai, respons HTTP terakhir, umur antrean siap, dan p95 accepted beserta jumlah sampel 24 jam. Snapshot hanya tersedia untuk sesi Admin yang siap dan memakai RPC privat. Kondisi sumber tidak tersedia ditampilkan terpisah dari antrean kosong.
- Alarm in-app mencakup tick absen 3 menit, worker absen 5 menit, respons scheduler gagal, antrean siap tertua lebih dari 5 menit, lease kedaluwarsa, hasil ambigu, error kunci, serta minimal 5 endpoint invalid dalam satu jam. Riwayat run membedakan selesai, hasil belum tercatat, dan worker terputus. Alarm dilihat saat halaman diperbarui. Pengiriman alarm ke kanal lain belum dipasang.

## Kapasitas dan target penerimaan

Uji lokal menggunakan 120 penerima sintetis × 2 perangkat untuk satu lonjakan sebanyak 240 delivery. SQL claim, preflight, complete, rollup dan pengukuran snapshot berjalan pada PostgreSQL PGlite. Worker memproses 12 batch masing-masing 20. Provider diganti respons uji. Waktu eksekusi lokal mengukur kode dan database in-process tanpa durasi tunggu cron, cold start atau jaringan.

Batas teoretis adalah 20 delivery per menit saat tick tepat waktu, setiap batch penuh, worker tersedia dan provider sehat. Pada lonjakan 240, sekitar 12 tick diperlukan. Ukur kembali p95 end-to-end dengan beban normal dan burst yang disepakati di staging. `p95_accepted_seconds` mencakup penundaan terjadwal, jam tenang dan retry sejak delivery dibuat. Bandingkan juga umur antrean sejak `available_at` untuk memisahkan penundaan yang disengaja. Target 60 detik tetap hipotesis dan tidak dipakai sebagai janji layanan. Ambang backlog siap lebih dari 5 menit memicu pemeriksaan sebelum menambah penerima. Batas rollout ditentukan berdasarkan profil beban staging, bukan hanya maksimum cohort per kategori.

## Retensi dan rotasi

Migrasi `20261108090000_web_push_operations.sql` menambah dua tabel privat dan konfigurasi retensi nonaktif. Operator dapat menetapkan durasi serta batch di `sim_murid_private.push_operations_policy`. Nilai awal untuk ditinjau adalah 90 hari sejak status akhir delivery, 180 hari sejak perangkat nonaktif terakhir terlihat atau dicabut, 30 hari setelah riwayat worker selesai, dan 200 baris per kelompok per panggilan. Batas batch 500. Jalankan pembacaan kandidat dan tinjau dampak sebelum mengaktifkan. Link notifikasi lama yang delivery-nya sudah dibersihkan akan menuju fallback kotak masuk.

Pembersihan mempertahankan delivery pending, processing dan ambiguous, data inbox, sumber, dedup event dan bukti binding akun. Rahasia terenkripsi perangkat terminal yang memenuhi syarat ditimpa dengan nilai kosong yang tervalidasi skema. Perangkat aktif tidak dipilih. Artefak cadangan mengikuti kebijakan retensi cadangan sendiri.

`WEB_PUSH_PREVIOUS_KEYS` menerima maksimal dua pasangan generasi lama di environment server. Tiap entri berisi `encryptionVersion`, `vapidVersion`, `key` (base64), `publicKey` dan `privateKey` (base64url), serta `expiresAt` (ISO dengan zona). Versi yang sama harus menunjuk material yang sama. Sender memakai pasangan yang cocok dan masih berlaku. API registrasi hanya memakai generasi aktif.

1. Siapkan pasangan baru dan tanggal transisi pada staging. Simpan material di pengaturan secret server. Deploy generasi lama yang masih diizinkan bersama generasi aktif yang baru.
2. Buktikan delivery perangkat lama dan baru. Rotasi enkripsi saja diperbarui pada reconcile perangkat tanpa mengganti binding. Untuk VAPID, pengguna mengikuti alur nonaktifkan lalu aktifkan ulang agar browser berlangganan dengan public key baru. Perubahan binding membatalkan kiriman lama yang tertunda.
3. Hitung sisa perangkat aktif berdasarkan pasangan versi tanpa mengambil endpoint atau key. Periksa error versi kunci, keberhasilan reconcile dan delivery yang belum pasti. Setelah masa transisi serta penanganan perangkat lama, keluarkan entri lama dan uji kembali.

## Runbook staging dan pemulihan

1. Gunakan proyek Supabase staging terpisah dengan data sintetis dan origin Vercel staging stabil. Verifikasi URL, project ref, autentikasi akun Admin, anggaran fungsi dan kuota proyek. Terapkan migrasi inti sampai WP-08 sebelum kode worker baru memakai RPC cleanup. Pertahankan flag kategori dan retensi off.
2. Jalankan installer `supabase/operations/web-push-scheduler.sql` pada target staging yang mendukung Cron, Vault dan pg_net. Sebelum pemasangan, periksa konsumen pg_net existing karena installer membatasi grants pada skema itu. Pin URL lengkap `/api/push/worker` pada `push_worker_state.worker_url` dan Vault `sim_murid_push_worker_url`. Cocokkan secret server `WEB_PUSH_WORKER_SECRET` dengan Vault `sim_murid_push_worker_secret`. Gunakan bypass preview terbatas hanya jika protection memerlukannya.
3. Aktifkan job dan `push_worker_state.scheduler_enabled` di staging dengan dispatch off. Baca `cron.job.active` dan dua run sukses terakhir pada `cron.job_run_details`. Cocokkan waktu tick, HTTP 2xx dan heartbeat selesai pada Admin. Pastikan job uji bersifat isolated. Aktifkan test hanya untuk perangkat yang telah dipilih. Cocokkan enqueue → claim → accepted → tampil → klik. Putuskan respons satu tick lalu buktikan tick berikutnya memulihkan backlog tanpa mengulang delivery ambigu.
4. Periksa respons 401/403 untuk pasangan secret dan protection. Periksa 503 untuk environment, migration/RPC, worker dan lease. Saat backlog >5 menit, hentikan perluasan cohort, cek jadwal, oldest ready, retry dan limit provider. Gunakan batch yang sudah diukur. Jangan mengantre ulang hasil ambigu.
5. Saat provider memberi 429/5xx, biarkan batas retry/backoff bekerja dan amati jumlah serta umur antrean. Saat 404/410 meningkat, periksa apakah terbatas pada satu provider, perubahan browser atau rotasi. Perangkat invalid direkonsiliasi dari browser. Error VAPID/konfigurasi meminta pemeriksaan generasi dan secret.
6. Saat secret bocor atau worker harus dihentikan, matikan dispatch DB dan server, set scheduler false dan nonaktifkan job. Rotasi bearer dan bypass yang terpapar pada kedua sisi, validasi kembali dengan pengiriman off, lalu pulihkan staging bertahap. Lease lama dibiarkan selesai atau kedaluwarsa dengan hasil tidak pasti dipertahankan.
7. Uji kandidat retensi menggunakan data staging, tetapkan nilai yang disetujui, jalankan cleanup berbatch, dan cocokkan jumlah hasil. Matikan `retention_enabled` untuk menghentikan cleanup. Jika kode harus di-rollback, biarkan struktur additive di database dan gunakan rilis sebelumnya setelah dispatcher ditahan.

Referensi platform: [Supabase Cron](https://supabase.com/docs/guides/cron), [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net), [batas jadwal Vercel](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing).


### Pemeriksaan SQL operator

Jalankan pada proyek yang sudah dipilih, tanpa mengambil header atau secret.

```sql
select jobid, schedule, active
from cron.job
where jobname = 'sim-murid-web-push-sweep' and username = current_user;

select j.schedule, r.status, r.start_time, r.end_time
from cron.job j join cron.job_run_details r using (jobid)
where j.jobname = 'sim-murid-web-push-sweep' and j.username = current_user
order by r.start_time desc limit 5;

select sim_murid_private.push_operations_snapshot();

select encryption_key_version, vapid_key_version, count(*) as devices
from sim_murid_private.push_subscriptions
where status = 'active'
group by encryption_key_version, vapid_key_version;
```

Untuk meninjau jumlah kandidat retensi sebelum pengaktifan, baca usia status akhir dan perangkat terminal sesuai konfigurasi.

```sql
select count(*) as terminal_deliveries
from sim_murid_private.push_deliveries d, sim_murid_private.push_operations_policy p
where d.status in ('accepted','cancelled','expired','failed_permanent')
  and d.status_changed_at < now() - make_interval(days => p.delivery_days);

select count(*) as inactive_subscription_secrets
from sim_murid_private.push_subscriptions s, sim_murid_private.push_operations_policy p
where s.status in ('revoked','invalid','expired')
  and s.secrets_purged_at is null
  and greatest(s.last_seen_at,s.revoked_at) < now() - make_interval(days => p.subscription_days)
  and not exists (
    select 1 from sim_murid_private.push_deliveries d
    where d.subscription_id = s.id and d.status in ('queued','retry_wait','processing','ambiguous')
  );

select count(*) as finished_runs
from sim_murid_private.push_worker_runs r, sim_murid_private.push_operations_policy p
where r.status <> 'running'
  and r.finished_at < now() - make_interval(days => p.run_days);
```
