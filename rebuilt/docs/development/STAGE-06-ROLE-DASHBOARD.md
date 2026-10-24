# P06 — Beranda setelah login sesuai peran

Tanggal 24 Oktober 2026 WIB. Baseline main `1aa9b1d8b6915869dc5c9d4490491e64a0d372ee`; branch `feat/role-dashboard-p06`. Ruang lingkup `/account`, bukan halaman publik `/`.

## Analisis dan keputusan

Dashboard sebelumnya berisi identitas/sesi/privasi dan katalog layanan dari sidebar. Dibaca Page/layout/gate, context akses, RPC jadwal/operasional/layanan beserta kontrak snapshot dan SQL scoped, calendar/ledger/piket, dokumen P01–P05 serta keputusan D01–D03/ACADEMIC-1.0. Tidak mengganti komponen yang sudah baik atau mengarang angka, pekerjaan, deadline maupun persentase penyelesaian.

Dipilih komposisi **RPC baca existing**, tanpa migrasi/schema/RLS baru. Konteks izin dibaca memakai client pengguna yang telah diverifikasi; user_id harus sama dengan principal, role harus sah dan cocok dengan is_admin terverifikasi. Konteks gagal berarti ringkasan tidak tersedia dan tidak menjalankan pembacaan sumber dengan service-role. Setiap RPC sumber tetap memeriksa actor/session/onboarding dan scope sendiri; pemilihan query oleh role bukan pengganti otorisasi.

## Alur dan kontrak

Page mempertahankan gate login, onboarding dan survei wajib sebelum membaca ringkasan. Hasil survei nonboolean kini fail closed. `readDailyOverview` merencanakan maksimal delapan pembacaan paralel, hanya yang relevan dengan role/penugasan aktif/grants. Pembacaan context opsional memakai abort signal; pemanggil lama tidak berubah. Context dan tiap source request dibatasi 6 detik; tidak ada retry otomatis atau cache global lintas akun.

Output menggunakan schema ketat: pemilik snapshot, tanggal WIB, timestamp baca, role, kode penugasan, kartu/provenance, daftar prioritas dan maksimal lima agenda. Hanya count/status/saldo agregat serta mapel/kelas/waktu yang diizinkan dikirim ke client. Payload inbox, nama guru/siswa/nasabah, nomor akun, ledger, jawaban survei, secrets dan data referensi lengkap tidak diteruskan.

GET `/api/account/overview` tidak menerima parameter actor, role, tanggal atau classId. Identity/session berasal dari verifiedPrincipal; gate keamanan dan survei diperiksa kembali. Response memakai private/no-store dan cookies context existing. Tidak ada endpoint tulis baru.

Client mempunyai satu request aktif, timeout 12 detik, abort/ignore setelah unmount, pemeriksaan subject dan schema. Jaringan/5xx/malformed mempertahankan snapshot lama dengan timestamp serta pesan gagal; bukan nol/sukses palsu. 401/403 menghapus ringkasan operasional lama, termasuk body 403 non-JSON. Redirect dibatasi route gate internal. Subject berbeda ditolak; key subject/timestamp mereset state saat server mengirim konteks akun baru. Tidak menyimpan ringkasan di localStorage/draf umum.

## Matriks role dan tugas

| Konteks | Ringkasan relevan, jika mempunyai grant |
|---|---|
| Admin | Notifikasi akun, jadwal aktif, catatan piket pending, absensi hari ini dan masalah pengiriman pada daftar terbaru |
| Guru | Jadwal mengajar sendiri, status piket sendiri, absensi scoped; penugasan aktif menambah bimbingan, komite atau tabungan |
| Kepala madrasah (penugasan guru) | Jadwal sesuai cakupan sekolah, absensi dan bimbingan sesuai akses; bukan role baru |
| Wali kelas/Guru Wali/Bendahara/Pengelola tabungan | Mengikuti assignment aktif/grant serta RPC domain; scope kelas/all tetap otoritas database |
| Siswa/orang tua | Jadwal kelas yang diizinkan, absensi sendiri/anak terhubung, status iuran bulan kalender dan saldo rekening yang dapat diakses |
| Nasabah/alumni | Saldo rekening yang diizinkan dan notifikasi akun; tanpa jadwal akademik palsu |
| Calon siswa | Notifikasi akun dan informasi akun existing; tidak memaksakan kartu akademik/keuangan kosong |

Role dan penugasan dicabut berlaku pada pembacaan baru. Orang tua tidak memilih arbitrary studentId melalui ringkasan; relasi aktif ditentukan RPC. Tidak melakukan pembacaan direktori global untuk menghitung populasi dari jumlah baris yang dibatasi.

## Sumber angka, periode dan batas

| Kartu | Sumber dan parameter | Makna angka |
|---|---|---|
| Notifikasi | app_services_read notifications, actor/session | extra.unread seluruh inbox pemilik, bukan panjang daftar 200 baris |
| Jadwal rutin | app_schedules_read, weekday WIB, tahun aktif default; personal=true untuk guru biasa | Jumlah lesson scoped pada hari tersebut. Guru dengan tugas Kepala memakai scope yang diizinkan; bukan preferensi tahun historis browser |
| Piket | app_operations_read duty, start=end tanggal WIB | Admin: jumlah catatan status pending, bukan semua roster mingguan belum diproses. Guru: status konfirmasi aktual sendiri |
| Absensi/Bimbingan | app_operations_read attendance/mentoring, start=end tanggal WIB, page1 | total catatan tersimpan seluruh scope, bukan panjang halaman50, siswa belum dicatat atau tingkat penyelesaian |
| Komite | app_operations_read fees, tahun kalender/tanggal WIB | Bendahara: total pembayaran hari ini. Siswa/orang tua: jumlah status bulan ini yang belum lunas; tarif belum lengkap ditampilkan sebagai belum dapat dihitung, bukan nol/lunas |
| Tabungan | app_operations_read savings, periode baca | summary.balance resmi rekening yang dapat diakses; bukan hitung ulang saldo/fee di UI |
| Pengiriman | app_services_read jobs, Admin | failed/ambiguous dalam maksimal 200 entri terbaru. Label jendela selalu ditampilkan; tidak diklaim total semua riwayat |

Agenda disortir menurut waktu WIB, menampilkan maksimal lima pelajaran yang waktu akhirnya belum lewat. Jadwal rutin tidak menjadi bukti KBM terlaksana. Kalender menggunakan aturan libur Absensi existing (Minggu atau tanggal holidays); helper diekstrak tanpa mengubah kalender lama. Hari libur menonaktifkan agenda/prioritas pelajaran. Kalender belum terkonfirmasi tidak menghasilkan prioritas KBM, dan UI memberi keterangan untuk memeriksa perubahan/libur.

Tidak ada inferensi Alpha dari absensi kosong, jatuh tempo iuran, keterlambatan pembimbing, tugas belum selesai atau seluruh pekerjaan sekolah beres dari angka nol. Admin tetap satu-satunya pihak konfirmasi piket: guru diarahkan memeriksa status/petugas berwenang; cancelled/revoked tidak menciptakan pengingat baru. Konfirmasi tersimpan tetapi akses tidak aktif ditandai perlu pemeriksaan.

Prioritas hanya hint baca: pemeriksaan pengiriman → kegiatan hari ini → informasi inbox/iuran. Tidak membuat task workflow, notifikasi, retry pengiriman, transaksi, atau keputusan akademik. P07 tetap tahap terpisah.

## UI/UX dan kompatibilitas

Ringkasan pekerjaan berada sebelum ringkasan akun existing. Identitas/sesi/privasi dan daftar layanan tetap tersedia; tidak menambahkan tombol pembuka halaman yang menduplikasi sidebar. Tombol Perbarui ringkasan adalah pembacaan data. Field/token/Card/Status/fokus P02–P05 dipakai kembali; angka, sumber, periode, empty/loading/error/partial/denied dan waktu baca terlihat. Teks panjang membungkus; agenda/angka tidak memerlukan tabel lebar. Responsif 320/390/768/1440 dan landscape; gulir vertikal normal diperbolehkan.

DashboardOverview optional menjaga kompatibilitas fixture/consumer lama AccountDashboard. Tidak mengubah rumus PH20/ATS30/ASAS50/Praktik, fee, ledger, final lock, D10, instrumen survei, API domain maupun mekanisme autentikasi.

## File dan verifikasi

Manifest file dan alasan pada `stage-06-files.json`; bukti aktual pada `../verification/overview/`. Tes menggabungkan projection/loader/API/gate, SQL existing pada PGlite terisolasi, serta komponen asli dengan HTTP browser sintetis. Bukan login/UAT akun produksi, beban produksi, pengiriman email atau AI berbayar. Changelog dan dokumentasi RPC Supabase diperiksa; tidak ada perubahan SDK, dependency atau CLI/migrasi.

Sumber dibaca independen, bukan satu transaksi lintas modul. Angka dapat berubah setelah timestamp baca; pembaruan eksplisit memperbarui seluruh snapshot. Payload sumber existing (termasuk referensi yang diproses server) masih mengikuti ukuran query domain; kapasitas/latensi autentikasi nyata belum diukur, bukan diklaim dari fixture. Tidak ada service-role/secret yang dipindah ke browser. P07 berikutnya belum dikerjakan.

## Hasil verifikasi

`npm run check` exit 0: 576 tes/65 kelompok, typecheck, lint, production build. Browser: 529 pemeriksaan/71 axe dalam tujuh suite; rincian dan artefak JSON pada [bukti P06](../verification/overview/README.md). Tidak ada pengujian langsung akun produksi atau pengiriman provider.
