# P07 — Pusat tindak lanjut dan notifikasi

24 Oktober 2026 WIB. Baseline main `a3df950a6d20cce7f49b9de1df03179669c38bed`, tree `870e269274d98c3c6c312932caa56b17b2d443d9`. Branch `feat/follow-up-p07`.

## Analisis dan batas keputusan

Dibaca roadmap/backlog P01, P06, AGENTS, kebijakan bisnis, halaman/API Notifikasi, snapshot layanan, komposisi RPC dashboard, rencana aksi survei, inbox/outbox, lease/retry worker dan pengujian SQL existing. Inbox adalah pesan, rencana aksi adalah pekerjaan manusia, sedangkan outbox/jobs adalah pekerjaan sistem. Menandai pesan dibaca tidak boleh menyelesaikan pekerjaan atau menyatakan kiriman telah diterima pengguna.

P07 menggunakan sumber existing, tanpa tabel tugas kedua, perubahan kontrak mutasi, migrasi database, jadwal otomatis atau pengiriman provider baru. D01/D02/D03/ACADEMIC-1.0 dan D10 tidak berubah. Sidebar tetap tempat membuka modul. Preferensi yang ditambahkan adalah **preferensi tampilan notifikasi/tindak lanjut per akun dan perangkat**, bukan opt-out email/WhatsApp lintas perangkat; pengaturan kanal existing dan pesan keamanan tidak diubah.

## Implementasi

- Halaman Notifikasi memiliki tab Kotak masuk dan Tindak lanjut memakai Radix. Kotak masuk existing tetap default. Kedua panel dipertahankan selama halaman aktif agar pindah tab tidak membatalkan penyimpanan read/unread atau kehilangan filter/state. Panel tidak aktif disembunyikan, keyboard/fokus mengikuti tab.
- Endpoint GET `/api/account/follow-up` memakai principal/session server, gate keamanan dan survei wajib existing, cookie refresh serta respons private/no-store. Semua parameter ditolak; tidak menerima actor, scope, role, tanggal atau ID pemilik dari browser. Tidak ada endpoint completion baru.
- P06 menjadi sumber prioritas harian: notifikasi, jadwal, piket, absensi, bimbingan, iuran, tabungan dan jobs sesuai role/assignment/relasi. RPC existing tetap otoritas izin, bukan pilihan query di frontend.
- Butir rencana aksi dari snapshot Survei hanya diproyeksikan untuk Admin/Kepala yang masih memiliki `isManager` pada pembacaan sumber. Pencabutan assignment di sela pembacaan, respondent milik orang lain, tanggal sumber berbeda saat pergantian hari, payload rusak dan pembacaan gagal tidak boleh tampil sebagai daftar selesai/kosong.
- Rencana aksi memakai owner, target dan status `belum/proses/selesai` existing. Ringkasan harian menampilkan pemilik sesuai cakupan atau Admin berwenang; tidak mengklaim identitas penanggung jawab tertentu yang tidak tersedia. Target harian ditandai tidak ditetapkan, tidak mengarang tenggat absensi/iuran. Terlambat hanya dihitung dari target rencana dibanding tanggal WIB snapshot; selesai tidak ditandai terlambat.
- Status pekerjaan: perlu tindak lanjut, dalam proses, selesai di sumber, tidak ada prioritas baru, atau belum dapat diperiksa. Tidak ada prioritas baru bukan bukti semua pekerjaan madrasah selesai. Kegagalan satu sumber tidak diubah menjadi nol/sukses.
- Filter modul/status/urgensi dan pencarian judul/penanggung jawab; pagination sepuluh butir; target dan tanggal ditampilkan WIB. Hingga delapan ringkasan sumber dan 200 butir rencana. Prioritas diurutkan sebelum pemotongan; batas 200 dijelaskan bila terlampaui.
- Pembacaan eksplisit dibatasi 20 detik di client, lock sinkron mencegah request ganda, abort saat unmount, late response diabaikan. Respons 401/403 atau subject berbeda menghapus snapshot. Gangguan jaringan/5xx/payload tidak sah menandai snapshot terakhir perlu diperiksa; tidak otomatis mengulang. Sumber terpisah, bukan transaksi atomik lintas modul.
- Preferensi versi 1 hanya menyimpan boolean `showInformation`, memakai namespace per akun. Tidak menyimpan tugas, identitas pemilik, target, OTP, kredensial, saldo atau payload notifikasi. Storage rusak/tidak tersedia memiliki fallback; storage event menyinkronkan dua tab. Sembunyikan informasi opsional tidak menghilangkan prioritas tindakan/sumber gagal; filter eksplisit tetap dapat membatasi hasil. Preferensi tidak dibaca oleh auth, gate survei, worker atau pengiriman keamanan.

## Deduplikasi dan otoritas status

Tidak membuat inbox/outbox dari GET atau projection. ID ringkasan unik per sumber/tanggal; ID rencana mengikuti period/index sumber, bukan identitas workflow baru (index dapat berubah ketika rencana diurut ulang). Unik dalam snapshot diperiksa Zod; tidak menyimpan completion/dismiss lokal. Refresh menggantikan snapshot, tidak menggabungkan salinan butir.

Inbox/outbox tetap memakai unique dedup_key/idempotency_key existing (`point:event:recipient[:channel]` dan pengingat piket per hari/penerima). Tes SQL mengulang pemanggilan produsen event dan memeriksa jumlah inbox/outbox tidak bertambah; tes readback P07 membuktikan membaca pusat ini tidak enqueue. Lease expired/ambiguous dan retry existing tetap diuji suite layanan; P07 tidak menambah retry atau menjanjikan exactly-once penerimaan provider.

## Verifikasi

Hasil akhir perintah dan bukti ada di [verification/follow-up](../verification/follow-up/README.md). Unit/API memeriksa proyeksi, status, tenggat, akses, gate, cap, preferensi dan timeout RPC. SQL memakai migrasi existing dalam PGlite; data dan provider sintetis. Browser menggunakan komponen nyata dan fixture dari projection yang sama, HTTP boundary terisolasi. Uji ini bukan UAT produksi, uji beban, verifikasi inbox email/perangkat, atau pembuktian waktu penyelesaian pengguna.

Daftar file dan alasan: `stage-07-files.json`. Tidak ada perubahan dependency runtime, database, autentikasi atau rumus bisnis. P08 belum dijalankan.

## Hasil perintah aktual

- `npm ci`: exit 0; lockfile dan dependency runtime tidak berubah.
- `npm run check`: 599 tes dalam 66 kelompok lulus; typecheck/lint lulus. Build incremental pada rangkaian ini berhenti karena database cache Turbopack lokal (`invalid digit found in string`), bukan diagnostic sumber. `.next` dipindahkan keluar repository, lalu `npm run build` bersih exit 0. Typecheck dan lint akhir dijalankan lagi terpisah setelah sumber stabil.
- Browser P07: 90 pemeriksaan, 8 axe, tanpa JavaScript error; regresi dashboard P06: 120 pemeriksaan/20 axe; regresi Kotak masuk: 59 pemeriksaan/7 axe. Total tiga suite: 269 pemeriksaan dan 35 axe.
- Skenario: tujuh peran, assignment dicabut di sela baca, sumber unavailable, deadline WIB dan pergantian hari, status selesai mengikuti sumber, prioritas sebelum cap, 320/390/768/1440 dan landscape, kata panjang, pagination/filter/search, lock request, offline/5xx/malformed, 401/403 non-JSON, akun berubah, timeout/unmount, preferensi tersimpan/dua tab/storage diblokir, keyboard tab, dan write inbox yang tetap berjalan saat pindah tab.
- Tidak menjalankan scheduler, provider email/WA, migrasi, produksi write, UAT pengguna atau load test. Tidak mengklaim angka waktu tugas/kapasitas layanan.
