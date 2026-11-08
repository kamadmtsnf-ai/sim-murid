# WP-06 — Pilot poin kedisiplinan

Tanggal: 8 November 2026 (WIB). Baseline main: `d3c82b3a8f4cf9204a3d03e96b1b938b34b7e7a4` (WP-05/PR #103). Cabang: `feat/web-push-wp06`.

## Status

Implementasi dan QA lokal selesai. **Pilot pengiriman nyata belum dijalankan**: staging terisolasi, scheduler managed yang diterima, dan perangkat penguji yang dipilih masih merupakan gate terbuka dari WP-05. Tidak push, deploy, migrasi cloud, memilih pengguna produksi, mengaktifkan flag atau mengirim provider pada tahap ini. APK/IPA/integrasi OS khusus tetap di luar lingkup.

## Desain dan perilaku

Migrasi additive `20261108030400_web_push_points_pilot.sql` menambahkan `push_settings.points_pilot_enabled=false` dan satu tabel privat `push_point_pilot_members` ber-RLS. Anggota harus dipilih eksplisit per akun, unik, memiliki masa berlaku maksimal 30 hari dan dapat dicabut. Tidak ada enrolment berdasarkan role, seluruh kelas atau seluruh orang tua. Daftar ini tidak dipublikasikan ke browser; pengelola hanya melihat flag dan jumlah anggota yang masih berlaku di Antrean dan pekerjaan.

Pemicu tetap `app_point_notify` versi final dari `20261025152242_teacher_duty_assignment_guards.sql`: poin negatif yang melewati threshold existing atau mempunyai penanda R02/R03. `app_point_replay`, pengali residivis, saldo, level, arsip bulanan, aturan tindak lanjut dan konfigurasi email/WhatsApp tidak diubah. Parameter notify dicocokkan dengan siswa/bulan/source yang sebenarnya dan event yang sudah dibatalkan ditolak.

| Penerima existing | Syarat yang dipertahankan | Syarat tambahan push pilot |
| --- | --- | --- |
| Siswa | Siswa pemilik event | Akun aktif, anggota pilot berlaku, opt-in points, perangkat aktif sebelum event |
| Orang tua/wali | Relasi siswa–wali belum dicabut; satu wali dapat beberapa anak, satu siswa dapat beberapa wali | Sama; tidak boleh menerima event anak lain hanya karena role parent |
| Wali kelas | Enrollment belum berakhir, homeroom teacher kelas tersebut, `homeroom_access` dan kelas belum diarsipkan | Sama; guru kelas lain tidak ikut |
| BK | Role teacher serta assignment counselor yang belum dicabut dan berlaku pada hari sekolah | Sama; role teacher saja atau label BK tanpa penugasan tidak cukup |
| Admin | Level replay existing minimal 3 | Sama; anggota pilot admin tidak menerima semua event otomatis |

Resolver UNION existing dipertahankan sehingga satu akun yang memenuhi beberapa jalur tetap satu penerima. Semua penerima tersebut tetap memperoleh inbox/email/WA sesuai perilaku existing meskipun push/pilot mati; daftar pilot hanya membatasi kanal push.

## Transaksi, dedup dan privasi

`app_services_write` existing tetap menjadi pintu mutasi, dengan actor/session server, revision, request ID dan audit. Sesudah pencatatan event, `app_point_notify` membuat inbox; **hanya bila inbox baru benar-benar diinsert**, fungsi memanggil `app_push_enqueue` di transaksi yang sama. Tidak ada trigger browser atau HTTP di SQL. Rollback menghapus perubahan event, inbox, outbox, delivery, request/audit dan wake bersama-sama.

Dedup `point:event_id:recipient_id`; outbox `push:` + dedup; delivery unik per event/subscription/binding. TTL dihitung dari `point_events.created_at + 24 jam`, bukan tanggal kejadian sekolah yang dapat dibackdate. Event harus dibuat setelah enrolment pilot penerimanya. Subscription juga harus sudah aktif sebelum waktu event. Retry request, pemanggilan ulang notify, aktivasi flag belakangan atau perangkat baru tidak membentuk backfill untuk inbox lama. Kejadian bisnis baru yang berbeda tetap event baru, bukan dianggap duplikat hanya karena kode pelanggaran sama.

Payload sender WP-05 tidak berubah: generik v1, UUID event/delivery, judul SiM-Murid dan ajakan membuka aplikasi. Tidak ada nama anak, saldo, kode pelanggaran, catatan atau URL bebas pada layar terkunci. Endpoint/key subscription tetap terenkripsi. Detail dibuka melalui resolver login/ownership/source existing, dan GET tidak menandai dibaca.

Otorisasi sumber `push_eligible` dipisahkan dari `push_dispatch_eligible`. Helper kedua menambahkan syarat anggota/flag pilot dan digunakan pada enqueue, claim, final preflight serta maintenance. Keluar dari pilot menghentikan pengiriman tertunda, tetapi tidak menghapus inbox atau akses klik yang masih sah. Sebaliknya pencabutan relasi/penugasan/sumber menghentikan dispatch dan membuat resolver sumber menolak akses yang sudah tidak sah. Riwayat inbox existing tidak dihapus atau diubah diam-diam.

## Pembatalan dan worker

Trigger statement pada relasi wali, enrollment, kelas, penugasan, role, preferensi, anggota pilot, pengaturan push dan event poin membatalkan delivery points queued/retry_wait/processing yang tidak lagi layak. Claim token/lease dikosongkan; completion worker lama tidak dapat menghidupkannya lagi. Error yang dicatat hanya `point_scope_changed`. Perubahan global/category/pilot dan opt-out juga membatalkan pending. Accepted tetap merupakan histori transport, bukan pesan yang bisa ditarik kembali atau tanda dibaca.

Kedaluwarsa berdasarkan waktu diperiksa lagi pada claim/preflight/maintenance meskipun tidak ada trigger edit. Satu akun masih dapat lolos lewat jalur penerima lain yang sah setelah satu penugasannya dicabut. Tidak ada perluasan penerima ke pemilik tugas baru untuk event lama.

Installer scheduler WP-05 disesuaikan agar maintenance yang mengunci delivery dijalankan sebelum penguncian singleton worker-state. Trigger pembatalan terlebih dahulu mengambil share lock pengaturan, mengikuti urutan enqueue/claim. Urutan settings → delivery → worker-state pada jalur domain dan delivery → worker-state pada scheduler (yang tidak mengunci settings) mencegah inversi urutan lock saat konfigurasi/pilot berubah. Job tetap dibuat inactive; installer tidak dijalankan. Pengujian deadlock/multi-koneksi managed masih wajib sebelum pilot nyata; replay PGlite bukan bukti konkurensi jaringan managed.

Batch 20, konkurensi 4, lease/backoff/timeout, klasifikasi provider, IP pinning dan penanganan ambiguous WP-05 tetap berlaku. Tidak menaikkan konkurensi email/WA dan tidak mengubah cron legacy.

## Validasi

`npm ci` dan `npm run check` lulus: **864 test / 88 proses**, typecheck, lint, drift types dan build produksi. Tambahan 15 skenario pilot menjalankan SQL domain sebenarnya di PGlite; satu skenario melewati NextRequest/route/validasi/server reader sebenarnya dan SQL sebagai `service_role`, dengan hanya batas Auth/SDK jaringan yang diganti. Ini tidak mengklaim Supabase Auth staging atau provider nyata telah diuji.

Bukti meliputi threshold/R02/R03/admin, poin positif, siswa sendiri, dua wali, wali beberapa anak, guru/BK/kelas di luar scope, pilot off, anggota di luar daftar, request/notify ganda, perangkat baru, rollback transaksi dan kegagalan audit, revoke processing/stale completion, cancellation source, penghentian enrollment/role, expiry sebelum preflight, opt-out, akun nonaktif, pilot kill switch, akses klik/read, penolakan role browser, parameter penerima palsu/origin asing/anonim, serta regresi email/WA dan rumus poin.

UI JobsPanel: **57 pemeriksaan browser**, lebar 320/390/768/1440, **9 audit axe tanpa temuan**, tanpa error JavaScript. Data HTTP/Auth uji sintetis; bukan perangkat fisik. Hasil JSON disertakan, screenshot tetap artefak QA lokal.

Bukti: `docs/verification/web-push/wp06-checks.json`, `wp06-advisory.json`, `wp06-jobs-ui/results.json`. Katalog lokal: 90 tabel aplikasi ber-RLS, 54 migrasi, tanpa issue advisory lokal; bukan Supabase Platform Advisors. Jalankan ulang suite pilot dengan `npm run test:push:pilot`.

## Runbook pilot — belum dijalankan

1. Siapkan staging SiM-Murid terisolasi dan selesaikan gate WP-05 (Auth/origin/keys independen, Vault/pg_net/cron, worker terautentikasi, bukti accepted → tampil → klik/read pada perangkat yang dipilih). Jangan memakai database LMS lain atau produksi sebagai pengganti staging.
2. Terapkan migrasi WP-06 setelah WP-05; verifikasi RLS/grants dan fingerprint enam RPC yang diganti (`app_push_enqueue`, `app_push_claim`, `app_push_preflight`, `app_point_notify`, `app_push_maintenance`, `app_push_status`) serta tiga helper privat. `points_pilot_enabled` harus false, tabel anggota kosong. Rilis kode dengan semua flag tetap off sebelum aktivasi terpisah.
3. Pilih akun penguji secara eksplisit sesuai skenario, menggunakan data sintetis: siswa, wali yang punya relasi sah, wali kelas, BK dan admin bila diperlukan. Catat persetujuan/perangkat target dalam catatan operator terlindungi. Jangan menuliskan endpoint, credential, isi poin atau identitas siswa ke laporan publik.
4. Operator privileged mengisi `push_point_pilot_members` hanya dengan UUID akun yang diverifikasi, waktu enrolment sekarang dan `expires_at` paling lama 30 hari; `revoked_at` null. Konfigurasi ini tidak menerima input bebas dari browser dan tidak memiliki endpoint publik baru. Jangan menyalin seluruh tabel pengguna atau membuat cohort dari role saja.
5. Set preferensi points dan daftarkan perangkat tester secara eksplisit. Gunakan flag kategori `WEB_PUSH_CATEGORY_POINTS_ENABLED` bersama global/dispatch; DB enabled/dispatch/categories points serta `points_pilot_enabled` juga diperlukan. Semua gerbang independen; kosongnya daftar atau tidak adanya opt-in menghasilkan nol penerima push. Aktivasi hanya di staging setelah izin operasional, bukan bagian implementasi ini.
6. Buat **event baru** melalui halaman Poin Siswa/API existing hingga pemicu bisnis benar-benar terpenuhi, tanpa mengubah threshold produksi agar cocok dengan tes. Jangan replay event lama untuk memaksa pengiriman. Verifikasi source ID → inbox penerima → push event → child delivery/binding → claim/accepted. Cocokkan receiver dengan matriks, bukan sekadar jumlah.
7. Pada perangkat terpilih, catat bukti tampil terpisah dari accepted; uji klik setelah sesi habis, akun berbeda, wali beberapa anak, pencabutan relasi/BK/wali kelas, opt-out dan pembatalan event. Lakukan uji konkurensi managed dan rollback enqueue/scheduler tanpa data pengguna produksi. Target p95 accepted ≤120 detik masih target untuk diukur, bukan hasil yang sudah tercapai.
8. Pantau Antrean dan pekerjaan: flag pilot, jumlah anggota berlaku, backlog, status child delivery dan alarm. Untuk penelusuran detail gunakan query privileged terbatas per source/event/recipient; jangan mengekspor endpoint/ciphertext/keys. Tidak ada broadcast dan tidak ada retry manual otomatis untuk ambiguous.
9. Hentikan pilot dengan `points_pilot_enabled=false` atau cabut anggota yang dipilih; trigger membatalkan pending. Matikan kategori/global/dispatch dan scheduler khusus push sesuai runbook WP-05 bila perlu. Jangan menghapus point event/inbox untuk rollback kanal, mengubah accepted/read, atau mengaktifkan kembali delivery cancelled/ambiguous.
10. Bila diterima, dokumentasikan bukti, ukuran cohort, waktu berlaku dan hasil sebelum memperluas kategori. WP-07 belum dijalankan; aktivasi produksi tetap keputusan terpisah.

## Acuan kelanjutan

Baca `WEB-PUSH-STATUS.md`, dokumen ini dan laporan WP-05 persisten sebelum rilis/aktivasi berikutnya. Kesiapan kode, migrasi cloud, deployment dan penerimaan pilot nyata adalah status yang berbeda. Pada sesi ini hanya kode/QA lokal yang selesai; semua gate operasional di atas tetap terbuka.
