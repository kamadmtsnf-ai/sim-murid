# Konvensi data — Tahap 4

## Identitas dan relasi

UUID adalah identitas relasi. profiles.id mereferensikan auth.users.id dengan ON DELETE RESTRICT; tidak ada password di profiles. Username adalah text unik persis, tanpa parseFloat, tanpa menghilangkan nol awal, tanpa penggabungan case yang belum diputus. `00123`, `123`, `123abc` berbeda. Input spasi tepi dan karakter kontrol ditolak. Normalisasi apostrof spreadsheet dilakukan eksplisit saat staging dengan nilai asli tetap disimpan.

Satu role dasar per user_roles; tugas tambahan dapat banyak melalui user_assignments. Role, tugas, flag premium/tabungan dan verifikasi email dipisahkan dari biodata yang kelak bisa diedit pemilik. Tabel penugasan belum menjadi mesin izin; pemeriksaan kelayakan Guru, bentang tanggal dan scope aksi diterapkan pada Tahap 7. Scope kelas harus merujuk classes; NULL berarti scope umum yang tetap memerlukan pemeriksaan capability, bukan akses otomatis ke seluruh aplikasi.

## Tanggal dan tahun ajaran

Timestamp memakai timestamptz. Tanggal bisnis memakai date dan ditafsir Asia/Jakarta oleh service. Jangan menyimpan string tanggal lokal campuran. Academic_years Y menyimpan rentang 1 Juli Y–30 Juni Y+1 sebagai kolom generated; semesters dengan number1/2 menghasilkan Juli–Desember dan Januari–Juni. Composite FK memastikan year_start semester sesuai tahun ajaran. Hanya satu tahun aktif; tidak ada tahun aktif/tarif/kelas fiktif dalam master migration.

Classes terkait tahun ajaran dan menyimpan snapshot nama/tingkat yang nantinya dipakai enrollment. Enrollment siswa dan promosi baru ditambahkan pada tahap domainnya. Mengubah role Siswa menjadi Alumni tidak boleh mengubah histori tahun/kelas/transaksi; hubungan histori akan diperkuat saat schema domain dibuat.

## Rupiah, numerik dan pembulatan

Domain rupiah_amount menerima numeric bulat, maksimal nilai absolut9.007.199.254.740.991 agar aman direpresentasikan angka integer JavaScript. Domain nonnegative_rupiah menambah batas>=0. Domain menggunakan numeric tanpa typmod agar1,5 tidak dibulatkan diam-diam sebelum CHECK. Kolom yang wajib tetap harus NOT NULL; domain sendiri membolehkan NULL.

Perhitungan fee berbasis persentase dilakukan dengan numeric eksak atau integer numerator pada domain service berikutnya. Fee dibulatkan ribuan terdekat half-up sesuai FEE-1.0; domain rupiah tidak otomatis membulatkan. Ledger dan fee/slip belum diimplementasikan pada Tahap4.

## Kebijakan dan histori

Business_policies berisi RAPOR-1.0 (20/30/50, Praktik terpisah), FEE-1.0 (ribuan terdekat, debit nominal tarik), SURVEI-REQUIRED-1.0 (esai wajib backend, peer opsional). Perubahan membuat versi baru; UPDATE/DELETE/TRUNCATE diblokir trigger. Pengurutan tanggal efektif atau penerbitan rapor belum dibuat. D10 KKM/arsip tetap OPEN.

Activity_logs append-only lewat hak akses dan trigger. actor_kind=user wajib actor_id; system/migration tidak menyamar menjadi pengguna. Ini perlindungan aplikasi; pemilik database tetap memiliki wewenang administratif termasuk mengubah trigger. Jangan menaruh password/OTP/key atau payload PII lengkap pada log.

Staging import_rows menyimpan raw_data, normalized_data dan review_status. Legacy_id_map mempertahankan source_key text dan batch; target_id bersifat polymorphic, sehingga rekonsiliasi per entitas wajib dilakukan sebelum impor dinyatakan sah. Belum ada data produksi yang diimpor.

## Keamanan awal

Semua24tabel mengaktifkan RLS. Tidak ada SELECT/INSERT/UPDATE/DELETE untuk anon/authenticated pada tabel fondasi. Bahkan bila SELECT tidak sengaja diberi, default-deny RLS tetap mengembalikan nol baris. Schema sim_murid_private tidak masuk daftar API dan tidak memberi USAGE untuk anon/authenticated. Tidak ada fungsi SECURITY DEFINER, tidak ada public RPC bypass.

Service_role diberi akses provisioning internal eksplisit, bukan dipakai browser; audit hanya SELECT/INSERT. Dua trigger helper security-invoker menggunakan search_path kosong dan EXECUTE dicabut dari client. Akses server/role sensitif nanti wajib memeriksa identitas/capability, bukan menjadikan service key sebagai jalan pintas endpoint umum.

Config local memakai api.auto_expose_new_tables=false. Cloud project harus diverifikasi tersendiri; migrasi juga mencabut grant setiap tabel yang dibuat agar tidak bergantung default grant project. Tidak mengubah grant tabel aplikasi lain secara massal. Migrations hanya untuk proyek khusus yang telah dipilih, bukan LMS yang terdeteksi.

## Sesi, OTP, antrean

App_sessions unique satu slot non-revoked per user. Slot kedaluwarsa harus direvoke dalam transaksi login sebelum slotbaru dibuat; constraint tidak memakai now() dalam partial index. Durasi maksimal1jam/168jam mengikuti remember_me. Tidak menyimpan token mentah; auth_session_id nantinya dicocokkan dengan token terverifikasi. Tabel ini belum berarti login/session runtime berfungsi.

Email_verifications memiliki batas percobaan0..5 dan TTL<=600detik, hashminimal, satu pending/user. Algoritme hash, rate-limit harian/cooldown, pengiriman dan verifikasi atomik masih Tahap9. Pertanyaan keamanan disimpan sebagai hash pada schema privat, bukan jawaban plaintext.

Outbox dan job_runs memiliki idempotency key unik; status ambiguity tersedia untuk timeout provider. Worker,retry,claim lock dan scheduler belum berjalan. Tidak ada email/WA/AI dikirim oleh seed atau test.
