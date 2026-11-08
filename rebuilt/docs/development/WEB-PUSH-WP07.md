# WP-07 — Perluasan kategori Web Push

Tanggal: 8 November 2026 (WIB). Baseline main: `147e24a0b550a97c6a50c17c8b1111ab1dffec2f` (WP-06/PR #104), diverifikasi kembali melalui GitHub. Cabang: `feat/web-push-wp07`.

## Status dan batas

Implementasi lokal mencakup **empat kategori**: jadwal/piket siswa, publikasi snapshot rapor, pengingat survei wajib dan dokumen biodata terverifikasi. **Tindak lanjut ditahan**, karena sumber belum menghubungkan penanggung jawab ke akun yang berhak. Kategori yang ditahan tidak dilabeli siap.

Seluruh aktivasi tetap off. Tidak push/deploy, tidak migrasi cloud, tidak membuat cohort produksi, tidak memasang scheduler dan tidak mengirim provider. Pengiriman nyata masih menunggu gate WP-05/WP-06: staging terisolasi, scheduler managed, akun/perangkat penguji yang dipilih dan penerimaan provider → tampil → klik/read. APK/IPA dan integrasi OS khusus tetap di luar lingkup.

## Matriks perubahan per kategori

| Kategori | Pemicu dan sumber | Penerima | Dedup dan TTL | Status kode |
| --- | --- | --- | --- | --- |
| schedule | Perubahan bermakna `lesson_schedules` atau `student_duty_assignments` melalui domain jadwal; kelas/tahun aktif | Siswa enrollment aktif, wali dengan relasi anak di kelas itu, wali kelas yang sah, guru dengan jadwal mengajar kelas tersebut; semuanya harus anggota cohort dan opt-in | `schedule:kind:class_id:first_revision:recipient_id`; 1 jam dari perubahan terakhir; debounce 60 detik | Diimplementasikan dan diuji lokal |
| reports | INSERT snapshot rapor setelah publikasi berhasil; bukan draf/edit nilai | Siswa pemilik dan wali berelasi aktif, sesuai akses rapor existing; tidak broadcast Admin/Guru | `report:snapshot_id:recipient_id`; 24 jam sejak published_at | Diimplementasikan dan diuji lokal |
| surveys | Worker khusus mematerialisasi kandidat main survey yang masih terbuka, role target masih berlaku dan belum submitted | Hanya anggota cohort yang opt-in dan memiliki subscription aktif; tidak semua pemilik role | `survey:period_id:recipient_id:date_WIB`; sekali per hari/periode; min(24 jam, akhir hari penutupan WIB) | Diimplementasikan dan diuji lokal |
| documents | Transisi pending → ready pada dokumen biodata dengan hasil verifikasi byte/hash server | Pemilik siswa/applicant/alumni aktif dan wali yang berelasi; tidak seluruh petugas yang mempunyai akses administratif | `document:document_id:1:recipient_id`; 24 jam dari transisi ready | Diimplementasikan dan diuji lokal |
| follow_up | Belum ada event dengan owner akun dan state version yang sah | Belum dapat ditentukan tanpa menebak owner teks atau memperluas hak baca | Belum dihubungkan | **Ditahan** |

Dokumen pada tahap ini berarti berkas biodata yang lulus proses `app_document_finish`, bukan persetujuan dokumen sekolah, penerbitan ijazah, signed URL, atau seluruh layanan file. Publikasi rapor menggunakan alur immutable existing; D10 dan arsip/rumus D01 tidak diubah. Tidak mengubah aturan poin, threshold, survei, email atau WhatsApp.

## Database, cohort dan kontrak

Migrasi additive: `20261108044043_web_push_extended_categories.sql`.

- Tambah `push_settings.expanded_pilot_categories`, default kosong, hanya menerima empat kategori yang diimplementasikan; `follow_up` ditolak oleh constraint ini.
- Tambah tabel privat ber-RLS `push_category_members` dan `push_sources`. Browser anon/authenticated tidak mendapat akses tabel atau helper/RPC privileged. Semua fungsi invoker dengan search_path tetap.
- Anggota dipilih eksplisit per kategori, masa berlaku maksimal 30 hari, dapat dicabut, dan maksimal 200 anggota berlaku per kategori. Kuota dikunci secara transaksional agar insert serentak tidak melampaui batas. Ini cohort uji/rollout, bukan pendaftaran massal berdasarkan role.
- Source ledger menyimpan kind/entity, kelas/pemilik jika relevan, versi pertama/terakhir dan waktu/TTL. Tidak menyimpan nama, catatan pelanggaran, isi dokumen, endpoint atau credential. Indeks mendukung seluruh FK baru, lookup sumber dan child delivery yang masih pending.
- Untuk kategori baru, `push_events.source_id` menunjuk `push_sources.id`; `entity_id` ledger menunjuk resource sebenarnya. Poin/test mempertahankan kontrak lama. `eventRef` pada payload tetap UUID push event, bukan ID dokumen atau URL.
- Satu RPC baru service-only: `app_push_reminders(boolean,text[])`. Enqueue, source/dispatch eligibility, resolver klik, maintenance dan diagnostics diperluas. Claim/completion/token/binding yang sudah ada dipertahankan.

Aktivasi efektif memerlukan env global + dispatch + kategori, DB global/dispatch/categories, DB expanded pilot kategori, keanggotaan berlaku, preferensi opt-in, perangkat aktif dan akses sumber yang masih sah. Flag WP-06 points_pilot dan cohort poin tetap terpisah. Saat upgrade, seluruh gerbang baru tetap tertutup dan tidak ada backfill otomatis.

Parser konfigurasi menyembunyikan `follow_up` walaupun env flag-nya keliru diset true. Tabel push event/expanded cohort tidak menerima kategori itu. Jangan menganggap keberadaan nama kategori dalam kontrak preferensi lama sebagai kesiapan mengirimnya.

## Transaksi dan penggabungan jadwal

Source → inbox → parent outbox → child delivery → durable wake dibuat dalam transaksi domain yang sama. Rollback/kegagalan save tidak meninggalkan antrean. Tidak ada pengiriman HTTP dalam SQL, fetch browser untuk dispatch atau pekerjaan fire-and-forget setelah respons.

Revisi jadwal berasal dari `education_state` pada RPC domain. Edit beruntun untuk kind/kelas yang sama dapat memakai satu source dan satu inbox/event per penerima selama jendela 60 detik **hanya jika semuanya belum dibaca dan belum pernah dicoba dikirim**. Versi terakhir dan waktu/TTL/debounce diperbarui; dedup tetap mengacu versi pertama jendela. Audit/request domain tetap menyimpan perubahan-perubahan aslinya.

Setelah ada read/attempt, perubahan berikutnya memakai source baru; delivery lama yang belum selesai dibatalkan dan token lama tidak dapat complete. Tidak mengubah histori accepted atau mengklaim dapat menarik paket yang sudah diterima provider. Pengiriman dijadwalkan paling cepat 60 detik sesudah perubahan terakhir dan tetap menghormati jam tenang; jika TTL habis saat menunggu, tidak dikirim.

Penggabungan ini didukung melalui workflow/RPC aplikasi. Penulisan SQL manual yang tidak mengelola revision domain bukan jalur operasional untuk menerbitkan notifikasi.

## Survei dan scheduler

Worker memanggil materialisasi pengingat hanya bila env global/dispatch/surveys aktif. RPC memeriksa lagi gerbang DB, periode main, target role terkini, belum submitted, cohort, opt-in dan subscription. Maksimal **20 kandidat akun per invocation**; invocation berikut melanjutkan kandidat lain tanpa menggandakan inbox hari yang sama. Survei mikro dan peer-only tidak diubah; definisi wajib mengikuti `app_survey_required` existing.

Installer scheduler managed disesuaikan agar dapat membangunkan worker untuk kategori surveys meskipun antrean harian belum ada. Worker tetap memutuskan gerbang env; scheduler tidak memanggil cron email/WA, reset poin atau slip. Saat flags surveys DB tetap aktif, tick dapat memanggil worker per menit meskipun semua kandidat sudah selesai; kapasitas dan penyempurnaan cadence merupakan pekerjaan operasional WP-08. Tidak ada scheduler yang diaktifkan pada sesi ini.

Tanggal dedup memakai WIB. Penutupan, perubahan target/role, submission atau expiry membatalkan pending. Jika tanggal akhir survei dimajukan, TTL source/event ikut dipendekkan; memperpanjang periode tidak memperpanjang event lama. HTTP accepted bukan bukti tampil atau read.

## Pembatalan dan akses setelah klik

Trigger perubahan relasi, enrollment, kelas/tahun, role/penugasan, cohort, preferensi, pengaturan, survei/respons dan dokumen membatalkan child delivery yang sudah tidak layak. Source superseded dan sumber dokumen yang diganti/dihapus juga membatalkan pending. Maintenance, claim dan final preflight mengulang pemeriksaan, termasuk expiry berbasis waktu.

Transport eligibility terpisah dari source authorization. Keluar dari cohort/mematikan kanal menghentikan pengiriman tetapi tidak menghapus inbox atau hak baca yang masih sah. Relasi yang dicabut mencegah pembukaan sumber yang tidak lagi boleh dibaca. Histori accepted/read tidak direset.

Payload dan service worker v1 tetap generik. Setelah login dan validasi recipient/source, resolver boleh mengembalikan kategori serta konteks UUID terbatas untuk navigasi. Konteks hanya diambil dari ledger dengan kategori yang sama; UUID yang kebetulan sama pada source kind lain tidak membocorkan owner. Tidak ada raw URL, signed URL, path storage, hash file atau nama file pada payload/inbox notifikasi baru.

Tombol layanan memakai rute first-party yang ditetapkan kode. Dokumen membuka biodata owner yang telah diotorisasi. Rapor meneruskan UUID anak/kelas dan semester ke validasi server lalu menginisialisasi panel pada scope tersebut. Scope berbeda mereset panel; render awal tidak memperluasnya lewat reload otomatis. Jadwal membawa kelas/tahun; survei membuka layanan survei. Semua halaman layanan memeriksa hak aksesnya lagi.

## Tindak lanjut yang ditahan

Bukti sumber: `src/lib/dashboard/follow-up.ts` adalah proyeksi read-only; item harian memiliki status/urgensi turunan dan rencana aksi memakai `owner` string. `action_plans.items` serta validasi/mutasi plan existing tidak memiliki foreign key owner akun yang bisa dibuktikan. Refresh/read tidak boleh menjadi pemicu baru. Mencocokkan nama atau mengirim kepada seluruh role akan mengubah arti penerima dan berisiko salah akun.

Pekerjaan untuk membukanya:

1. Tetapkan owner akun berupa UUID yang diverifikasi server dan otorisasi membaca sumber; pertahankan owner teks sebagai tampilan historis bila diperlukan. Entri lama yang belum dipetakan tidak mengirim.
2. Tentukan source kind dan versi transisi yang stabil, kondisi status/urgensi bermakna serta kondisi selesai/pembatalan. Mutasi domain menjadi pemicu, bukan pembacaan dashboard.
3. Jika owner saat ini tidak memiliki izin membaca plan, putuskan scope baca yang memang dikehendaki sebelum menambah hak baru. Jangan otomatis memberikan akses insight/plan kepada semua guru.
4. Tambahkan dedup, cohort, TTL, pembatalan, uji lintas peran/akun dan aktivasi kategori terpisah. Flag tetap off sampai semua syarat tersebut terpenuhi.

## Bukti dan runbook

Bukti mesin: `docs/verification/web-push/wp07-checks.json`, `wp07-advisory.json`, `wp07-jobs-ui/results.json`, `wp07-reports-ui/browser-results.json`. Suite baru: `npm run test:push:categories`; regresi sender/API, poin, database, rapor dan seluruh aplikasi tetap dijalankan. Pengujian Auth/SDK/provider menggunakan batas terisolasi dan data sintetis; tidak mengklaim Supabase Auth managed, perangkat fisik atau penerimaan OS telah diuji.

Runbook sebelum pengiriman nyata:

1. Selesaikan gate WP-05/WP-06 pada staging terisolasi dan perangkat yang dipilih. Jangan memakai produksi sebagai pengganti staging.
2. Terapkan migrasi WP-07 sesudah WP-06; verifikasi RLS/grant, FK/index, 19 fingerprint fungsi serta RPC baru. Total lokal menjadi 55 migrasi/92 tabel aplikasi. Gerbang expanded harus kosong dan cohort belum dipilih saat rilis.
3. Rilis kode server/client sebelum memakai RPC baru; perbarui installer scheduler ke sumber WP-07 sambil mempertahankan job inactive dan scheduler false. Jangan membuka net/Vault atau memasukkan bearer ke log.
4. Pilih akun dan masa berlaku cohort secara eksplisit **per kategori**. Konfigurasikan opt-in, key/origin staging, env dan DB kategori satu per satu. Berangkat dari perubahan baru; jangan replay data historis untuk memaksa backfill.
5. Verifikasi pemicu nyata melalui UI/API: jadwal dan batch piket; draft/grade tidak mengirim tetapi publish rapor mengirim; main survey belum submit dan pergantian hari WIB; dokumen pending/failed tidak mengirim tetapi ready yang benar mengirim.
6. Cocokkan source → recipient → inbox → event → child binding → accepted, lalu buktikan tampil dan klik pada perangkat. Uji beberapa anak, relasi/role berubah, jam tenang, TTL, offline, duplicate request, rollback dan claim/completion lama. Lakukan uji lock multi-koneksi managed dan penggabungan jadwal di staging.
7. Periksa metrik/log tanpa endpoint, key atau isi privat. Catat batas batch 20, cohort 200 dan kebutuhan invocation sebelum memperbesar rollout. WP-08 mengurus operasi/cadence/retensi/kapasitas; tidak menambah layanan berbayar pada tahap ini.
8. Hentikan kategori dengan mengosongkan expanded pilot kategori atau mencabut anggota terkait, lalu matikan env/DB kategori dan scheduler bila perlu. Pending dibatalkan; jangan menghapus sumber bisnis/inbox, retry ambiguous atau mereset accepted/read. Jangan membersihkan ledger sumber yang masih diperlukan oleh inbox aktif tanpa kebijakan retensi yang jelas.

Kategori follow_up tetap ditahan. Keempat kategori lain **siap untuk validasi staging**, belum diterima untuk aktivasi produksi. Baca status terbaru dan laporan persisten ini sebelum rilis atau WP-08.

Validasi akhir: `npm ci` dan `npm run check` **lulus**, **888 test / 89 proses**, typecheck, lint, drift types dan clean build produksi. Suite kategori 21 skenario; browser Jobs 61 pemeriksaan/9 axe dan Rapor 67 pemeriksaan/8 axe, semuanya tanpa error atau temuan aksesibilitas. Katalog lokal 92 tabel aplikasi ber-RLS/55 migrasi tanpa issue. Build inkremental sempat berhenti pada cache persistence Turbopack; hanya hasil build `.next` dibersihkan, kemudian seluruh check final berhasil. Uji browser menggunakan compiler/bundler yang sudah terpasang di proyek, bukan dependensi esbuild yang tidak dideklarasikan.
