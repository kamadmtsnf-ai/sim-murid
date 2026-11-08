# WP-04 — Service worker dan UI izin

Tanggal: 8 November 2026 WIB. Baseline main: `e36769a90e8be79ada9039230d8f83e06ee89597` (PR #101). Status implementasi/QA lokal selesai; pengguna kemudian mengotorisasi push ke main dan migrasi. Migrasi cloud `20261108013820` (`web_push_click_resolver_wp04`) telah diterapkan sebelum rilis kode. Hak service-only, fingerprint RPC source/cloud, penolakan identitas tidak sah dan flag off terverifikasi. Tidak mengaktifkan flag. Tidak membangun APK/IPA atau integrasi OS khusus.

## Hasil implementasi

- Worker first-party `/sw.js`, scope `/`, updateViaCache none. Response JavaScript, nosniff, Service-Worker-Allowed `/`, no-store. Install skipWaiting dan activate clients.claim tanpa fetch handler, Cache API, controllerchange reload atau navigasi paksa halaman/draf.
- Push memakai schema v1, deliveryRef/eventRef UUID dan batas 2 KiB. Title/body selalu template generik lokal walaupun payload memasok teks lain. Payload rusak, versi salah, URL tambahan atau berlebih memakai fallback generik ke kotak masuk. Ikon/badge lokal dan tag event mengurangi duplikasi tampilan.
- Klik menutup banner, fokus hanya window same-origin dengan tujuan exact yang sama, atau membuka window baru. Window formulir lain tidak dinavigasi. URL bebas, protocol-relative, path sewenang-wenang, query dan fragment dari payload tidak dipakai.
- Pushsubscriptionchange hanya memberi hint reconcile kepada halaman terbuka, tidak membuat subscription atau otorisasi dari worker.
- PushProvider satu per layout akun; keyed berdasarkan userId. Panel ringkas/collapsible pada Notifikasi menyediakan status, Aktifkan, Nonaktifkan, Uji, kategori, jam tenang, zona waktu dan cabut perangkat sendiri. Izin ditolak/unsupported tidak menghambat inbox atau login.

## Izin dan lifecycle browser

Izin hanya diminta dalam call stack klik Aktifkan, sebelum await. Status mencakup loading, unsupported, perlu Home Screen, default, requesting, denied, unregistered, active, offline, error, expired, disabled dan account_changed. Panduan Apple menjelaskan Home Screen/iOS 16.4+, memakai deteksi kemampuan serta bantuan UA khusus iPad mode desktop; ini bukan klaim UAT perangkat Apple fisik.

Reconcile berjalan saat app/login dibuka, kembali online, focus (dibatasi 30 detik), hint worker dan perubahan antartab. Tidak meminta izin otomatis dan tidak membuat subscription baru dari efek background. Hanya marker opt-in akun sama dengan binding server masih active dan subscription browser masih ada yang direconcile. Binding revoked/invalid/expired tidak diaktifkan kembali otomatis; perubahan VAPID membutuhkan nonaktifkan dahulu, lalu aktivasi eksplisit.

Marker localStorage v1 hanya memuat owner UUID, subscription id, versi VAPID dan boolean optIn. Tidak menyimpan endpoint, keys, release credential, ciphertext, pesan atau token sesi. Storage error ditangani; marker memori membantu tab aktif. Kehilangan storage tidak menghasilkan opt-in baru otomatis. BroadcastChannel/storage merupakan bantuan UX saja. Provider lama berhenti saat mendeteksi akun berbeda.

API config menambahkan accountId caller. Seluruh request UI membawa `X-Sim-Push-Account`; server membandingkannya dengan sesi terverifikasi dan menolak tab akun usang sebelum RPC. Header bukan sumber identitas atau hak akses. Actor RPC tetap diambil dari sesi server.

Aktif hanya sesudah ack register saved; handshake 428 diulang maksimum sekali setelah cookie diterima. Error jaringan/timeout/409/503 tidak otomatis diulang. Nonaktifkan menunggu revoke server saved, baru unsubscribe browser; cleanup browser gagal tidak membatalkan pencabutan server. UI menampilkan kegagalan dan dapat memeriksa status kembali. Uji menampilkan antrean saja, bukan notifikasi telah diterima; tombol tetap off selama flag test off. Sender belum dibuat.

Preferensi menggunakan revision; draft dipertahankan ketika konflik atau simpan gagal. Jam dikirim HH:mm, zona waktu IANA; kategori yang belum dirilis tidak dapat diaktifkan. Perangkat lain masih dapat dikelola dari browser yang tidak mendukung aktivasi push. Daftar endpoint/keys tidak pernah disajikan ke UI.

## Resolver klik dan kelanjutan login

Route baru `/account/notifications/open/[ref]`, bukan pencarian pada snapshot 200 inbox terbaru. Referensi buram tidak memberikan izin. Proxy menerima hanya path resolver exact dengan UUID dan sesi sah; RPC invoker service-only `app_push_open` memverifikasi onboarding, recipient serta `push_eligible` terhadap sumber/relasi terbaru.

Sesi habis diarahkan ke `/login?expired=1&push=<UUID>`. Halaman/form/API login menerima hanya UUID dan membentuk tujuan tetap `/account/notifications/open/<UUID>`. Native link sukses/cek sesi mempertahankan hint tersebut; URL tujuan bebas tidak didukung. Login selesai tetap tidak menjamin isi dapat dilihat: resolver melakukan otorisasi ulang. Akun berbeda atau relasi sumber dicabut memperoleh pesan generik tanpa rincian akun lama. Gate keamanan akun tetap berlaku; route keamanan/perangkat tidak dikunci oleh kewajiban survei domain.

GET halaman tidak mengubah read_at. Detail berhasil dimuat dahulu, kemudian pengguna memilih Tandai dibaca melalui POST same-origin `/api/push/open/[ref]`. Resolver yang sama dijalankan ulang; update read_at hanya jika null, operations singleton dilock dan revision ditambah pada transisi pertama, dengan `where singleton=true` untuk kompatibilitas pg-safeupdate. Respons API tidak mengirim kembali judul/isi. Tidak menyamakan provider accepted, klik, baca dan pekerjaan selesai.

## Database dan rilis

Migrasi lokal `20261108011007_web_push_click_resolver.sql`: satu RPC baru, tidak menambah tabel, policy client, sender, jadwal atau aktivasi. Semua role browser ditolak; service_role saja dapat mengeksekusi. Total replay lokal: 52 migrasi, 88 tabel aplikasi (90 termasuk dua fixture Auth). Runtime RPC types dan snapshot schema diperbarui. Assertion singleton diubah dari tujuh ke delapan fungsi agar RPC baru juga diperiksa untuk predicate safeupdate.

Migrasi WP-02 dan WP-03 sudah tersedia di cloud. Migrasi WP-04 telah diterapkan sebagai `20261108013820` setelah otorisasi pengguna; jangan diterapkan ulang. Rilis halaman/resolver dilakukan sesudah verifikasi migrasi. Seluruh flag environment/database harus tetap off sampai sender, staging dan UAT siap. Jangan menerapkan ulang migrasi lama berdasarkan timestamp file lokal yang berbeda dari timestamp migration tool cloud.

## Bukti dan batas

Bukti browser: `docs/verification/web-push/wp04-ui/results.json`, dijalankan dengan Chromium 131.0.6778.204 dari Chrome for Testing, UI/API doubles terisolasi dan worker install/update nyata pada loopback. Tidak menghubungi provider push atau akun produksi.

Cakupan: React StrictMode initialization; tidak prompt otomatis; klik izin + bounded handshake; active sesudah saved; konflik revision mempertahankan draft; 320/390/768/1440 tanpa overflow horizontal; axe WCAG A/AA nol temuan; revoke gagal tidak unsubscribe; opt-out tidak autoreactivate; offline; pergantian akun antartab; denied tanpa prompt ulang; unsupported dan panduan Home Screen; worker scope `/`/update/no cache/no draft reload.

Uji unit worker memakai event/waitUntil doubles untuk payload valid/rusak/oversize, teks sensitif yang diabaikan, URL injection, fokus exact versus formulir lain dan hint subscription change. Uji database membuktikan recipient/session/role, lookup di luar 200 inbox, GET tidak read, mark idempoten dan pencabutan relasi sumber. Uji API/proxy/login mencakup continuation allowlist, origin asing, tab akun berbeda, sesi habis dan hasil resolver tanpa mengirim konten pada POST read.

Belum dibuktikan: push provider sampai OS/perangkat fisik, Safari/iOS/Android aktual, background delivery saat semua window tertutup, UAT role manusia, staging Supabase terisolasi dan lock multi-koneksi PostgreSQL managed. Browser API doubles bukan bukti support seluruh platform. Aktivasi produksi tetap ditunda.

## Berikutnya — WP-05

Bangun sender/worker terpisah mengikuti kontrak WP-01/WP-03. Pertahankan payload v1 UUID yang dikenali worker ini dan AAD enkripsi WP-03. Revalidasi/pin DNS publik pada transport TLS, tolak redirect, batas waktu/respons, fencing token/binding_version, Retry-After dan ambiguous. Jangan menaikkan concurrency worker email/WA atau menyalakan flag produksi sebelum staging dan UAT disepakati.

Acuan API browser: [WebKit — Web Push iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [MDN — service worker registration](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register), [MDN — notificationclick](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/notificationclick_event). Tidak menganggap panduan platform sebagai pengganti UAT perangkat fisik.

## Hasil akhir QA lokal

`npm ci` berhasil. `npm run check` exit 0: **832 test pada 86 proses**, typecheck, lint, drift types dan build produksi lulus. Pemeriksaan akhir 71 test terfokus juga lulus. Uji Chromium mencatat 12 kelompok pemeriksaan, termasuk keyboard Enter, blocked storage, 320/390/768/1440, axe nol temuan dan worker native install/update. HTTP server Next.js produksi lokal menyajikan `/sw.js` 200 dengan JavaScript, no-store, scope `/`, nosniff; POST baca dari origin asing 403. Bukti agregat: `docs/verification/web-push/wp04-checks.json`, detail UI dan HTTP pada direktori yang sama.

Cache generated Turbopack dibersihkan sebelum build akhir untuk menghindari masalah persistence cache scratch yang pernah ditemukan pada WP-03; tidak mengubah kode/library aplikasi untuk cache tersebut. Browser runtime bawaan tidak memiliki binary dan download headless default gagal; QA diselesaikan memakai binary Chrome for Testing 131 terisolasi di `/tmp`. Tidak mengganti dependency aplikasi atau lockfile.

Pemeriksaan rilis menemukan flake fixture VAPID di CI: `ECDH.getPrivateKey()` dapat menghasilkan kurang dari 32 byte ketika byte terdepan nol. Fixture kini memakai scalar sintetis tetap dengan padding 32 byte dan regression test eksplisit untuk penerimaan padded/rejection short encoding. Validasi konfigurasi produksi tetap ketat; tidak melonggarkan guard atau mengubah kunci environment. CI dijalankan ulang sesudah perbaikan fixture.
