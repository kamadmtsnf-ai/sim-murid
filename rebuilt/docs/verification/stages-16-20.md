# Tahap 16–20 — piket, absensi, bimbingan, iuran dan tabungan

Tanggal: 21 Oktober 2026 WIB. Target: GitHub kamadmtsnf-ai/sim-murid main, folder rebuilt; Supabase sim-muridv2 (qpzoukkhdxpmbtkcqemj); Vercel sim-muridv2.

## Cakupan dan jejak penerimaan

| Tahap | Implementasi | Bukti utama |
|---|---|---|
| 16 | Jadwal mingguan Guru Piket, konfirmasi utama hari berjalan, penunjukan pengganti terpisah dari konfirmasi, batal konfirmasi/penunjukan; izin sementara tidak berlaku esok | OP16; app_duty_confirmed dan app_duty_mutate |
| 17 | Input batch absensi atomik, koreksi/pembatalan dengan alasan dan audit before-image, status Hadir/Sakit/Izin/Alpha, filter tahun kalender/rentang/kelas/siswa/status, kalender pribadi/anak, tren, persentase tercatat dan hari efektif berbeda | OP17; app_attendance_access/mutate |
| 18 | Penugasan Guru Wali terpisah dari Wali Kelas, daftar bimbingan, hafalan master/Lainnya/predikat/catatan, laporan perkembangan/aspek/deskripsi, koreksi/pembatalan, riwayat milik sendiri/anak | OP18; app_mentor_access dan app_mentoring_mutate |
| 19 | Iuran multibulan dengan alokasi per bulan kalender, tarif kelas/bulan eksplisit, pembayaran/koreksi/void, gratis saudara terpisah dari kas dan dengan sumber pendukung, seluruh siswa termasuk belum membayar, tunggakan tarif diketahui dan label tarif belum ditetapkan | OP19; app_fee_waiver_student dan app_fees_mutate |
| 20 | Rekening siswa/Guru/non-siswa terpisah dari peran, setoran/penarikan, satu setoran aktif per rekening/hari, nominal minimal dan kelipatan1000, saldo/riwayat/tren, ledger immutable dan reversal untuk koreksi/void, baca pribadi/anak, flag baca tidak memberi hak kelola | OP20; app_savings_access dan app_savings_mutate |

Halaman: `/account/operations/{duty,attendance,mentoring,fees,savings}`. API: `/api/operations/[module]`. Navigasi tersedia dari halaman akun.

Ekspor Excel (.xlsx) dan PDF memakai hasil query terotorisasi yang sama, filter yang sama, dan total sebelum paginasi. Ekspor Excel iuran menyertakan status bulanan dan ringkasan. Batas ekspor10.000 catatan; hasil parsial ditolak. PDF memakai font Latin standar; karakter di luar font diganti `?`, sedangkan Excel mempertahankan teks Unicode. PDF merupakan laporan data, bukan slip tarik Tahap21.

## Integritas dan otorisasi

- Identitas caller dari sesi server. Sesi, gate, peran/tugas terbaru, ownership dan relasi anak diperiksa ulang di server/database.
- Tabel private deny-by-default dan RLS; RPC invoker hanya service_role. Tidak memberikan client akses langsung atau menambah SECURITY DEFINER.
- Request ID mengikat actor+module+command, revision mencegah stale update, operasi diserialkan dalam transaksi dan penarikan mengunci rekening. Replay memeriksa izin terkini terlebih dahulu. Audit dan receipt berada dalam transaksi yang sama.
- Guru yang ditetapkan pada jadwal/bimbingan harus memiliki tugas sesuai. Admin dapat secara eksplisit mencentang penetapan tugas dalam formulir; kegagalan validasi tidak boleh menyisakan perubahan.
- Tidak mengarang tarif iuran. Waiver memakai keluarga eksplisit dan kelas terendah menurut urutan natural, legacy order sebagai tie-break. Source allocation menyimpan penerima waiver; void satu sumber tidak membatalkan sumber lainnya. Perubahan keluarga berikutnya tidak menghitung ulang snapshot sumber lama diam-diam.
- Tabungan: koreksi tidak menghapus transaksi lama. Final balance dinilai tanpa efek lama; pembalik dan transaksi pengganti disimpan atomik dengan snapshot saldo nonnegatif. Rekening tidak hilang saat peran berubah.
- Fee/bracket, nomor slip, PDF/email slip mengikuti Tahap21. Mutasi Tahap20 tanpa biaya. Pengingat piket otomatis mengikuti Tahap29. Tidak mengaktifkan pengiriman email, mengubah password Admin permanen, atau menggunakan tarif/akun produksi untuk fixture.

## Validasi yang dijalankan

- 114 pengujian lokal lulus: 96 regresi + 18 pengujian baru (3 DTO/ekspor,15 database). Typecheck, lint, build produksi dan5smoke HTTP lokal lulus.
- XLSX dibaca kembali untuk memeriksa nominal dan teks yang menyerupai formula tetap berupa string. PDF dibuka kembali; ekspor parsial ditolak.
-20assertion pada database Supabase cloud lulus dalam transaksi rollback, termasuk pengulangan dengan hak service_role yang dipakai server: seluruh lima domain, scope anak, penolakan lintas siswa, dukungan waiver, saldo setelah penarikan/koreksi, direct-RPC denial dan RLS. Script: scripts/database/verify-operations.sql. Fixture tersisa nol.
- Total20migrasi terkonfirmasi,52tabel aplikasi seluruhnya RLS. apply_migration gagal teknis dengan requestState; fallback execute_sql menerapkan tiap migrasi dengan history secara atomik.
- Advisor security: INFO38 tabel private RLS tanpa policy sesuai deny-by-default; WARN lama leaked-password protection belum aktif: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## Batas verifikasi

Fixture cloud memakai Auth session sementara dalam satu transaksi rollback, bukan login/browser produksi. Uji visual terautentikasi lintas peran dan uji concurrency dua koneksi database independen belum dilakukan. Uji paralel lokal membuktikan satu revision hanya menerima satu penarikan dan retry tidak overdraft; ini tidak diklaim sebagai pengujian beban produksi. Data historis belum diimpor. Pemeriksaan HTTP produksi dicatat pada bagian rilis setelah selesai.

## Rilis

- Commit implementasi: aeffb9adc863a680cc0d4d84f0e6a3e96a4d1dbe pada main.
- Deployment kode: dpl_FSzbQbirpAPTGiBEjMqDqRNNUU9g, READY, production/sin1, https://sim-muridv2.vercel.app .
- npm ci dari lockfile terbaru lulus (575 packages). Build Vercel dari GitHub juga lulus.
- Pemeriksaan log error/fatal deployment setelah rilis tidak menemukan log sesuai kriteria, pada jendela pengamatan singkat15menit; bukan jaminan semua alur telah diuji.

-21pemeriksaan HTTP produksi lulus: health stage20,5halaman memerlukan login,5API menolak anonim,5POST menolak origin asing,5ekspor menolak anonim. Bukti: stages-16-20-http.json.
