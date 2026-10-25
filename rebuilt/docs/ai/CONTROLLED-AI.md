# Operasi AI terkontrol (P12-1)

AI hanya membantu merangkum sampel esai survei dan menyediakan draf rekomendasi. Agregat/tren tetap dihitung oleh database. Output tidak mengubah nilai, KKM/arsip, ledger, sanksi atau hak akses. Rencana aksi tetap diisi dan disimpan oleh Kepala sesuai jendela existing H+30. Tidak ada tools/agent/autonomous write.

## Sebelum aktivasi

1. Pastikan gerbang staging dan evaluasi manusia P10/P11 terpenuhi; uji model yang dipilih pada data sintetis. Review kebijakan privasi dan retensi penyedia serta izin pengiriman data. Jangan memasukkan dokumen atau data pribadi produksi pada pengujian.
2. Terapkan migrasi `20261025031124_controlled_ai_p12.sql` setelah persetujuan mutasi target konkret. Periksa RPC invoker, search_path kosong, EXECUTE service_role saja, RLS tabel privat, serta penolakan sesi asing. Simpan bukti SHA dan hasil verifikasi; jangan mengambil API key ke browser/log/git.
3. Atur billing/limit pada akun provider sesuai persetujuan pemilik. Batas aplikasi adalah jumlah reservasi, ukuran input dan output, bukan estimasi atau plafon uang. Harga/tokenizer/retensi mengikuti provider; aplikasi tidak memverifikasi dashboard billing provider.
4. Di pengaturan environment server, tetapkan `AI_ANALYSIS_ENABLED=true`, `AI_DAILY_REQUEST_LIMIT` integer1–20 dan `AI_ALLOWED_MODELS` daftar pasangan `openai:model-yang-disetujui,anthropic:model-yang-disetujui,gemini:model-yang-disetujui`. Gunakan ID model aktual yang tersedia di akun; contoh bukan rekomendasi model. Jangan aktifkan semua provider tanpa kebutuhan. Kosong/invalid menolak analisis.
5. Admin menyimpan key terenkripsi dan model lewat konfigurasi existing. Menyimpan key tidak mengaktifkan panggilan. Jangan menyalin key pada laporan dukungan.

Tanpa environment lengkap atau RPC kuota, panggilan provider gagal tertutup. Hasil lama tetap dapat dibaca dan diberi label kontrol lama belum terverifikasi. Pengujian P12 tidak mengaktifkan environment atau memanggil provider berbayar.

## Alur

Pilih periode → lihat cakupan sampel seluruh periode (filter layar bukan filter AI) → review data/kebijakan biaya → centang persetujuan → kirim sekali → cache/prepare → cek model → reservasi kuota atomik → redaksi → satu panggilan provider → validasi/schema/redaksi output/kutipan → simpan draf dan metadata → tinjau manusia → salin rekomendasi bila perlu → isi rencana aksi manual.

Sampel deterministik maksimal150esai; setiap esai maksimal1500karakter pada sumberexisting, input redaksi JSON maksimal24.000karakter (terlalu besar ditolak, bukan diam-diam dipotong lagi), output maksimal2048token. Sampel esai bukan jumlah responden atau seluruh populasi. Hash sumber existing mengidentifikasi sampel/model, bukan sertifikat kebenaran hasil atau pengganti validasi sumber.

Batas harian berlaku global semua pengguna/provider/periode, reset kalender Asia/Jakarta. Jeda60detik juga global. Reservasi tidak direfund untuk kegagalan/timeout/oversize/persistensi gagal, dan cache deletion tidak meresetnya. UUID analisis hanya sekali reserve. Reservasi disimpan terpisah tanpa FK ke cache agar penghapusan cache tidak menghapus histori kuota. Tabel bertumbuh paling banyak20baris/hari; jangan hapus histori hari berjalan untuk mengakali batas.

Tidak ada retry/failover provider otomatis. Timeout/refusal/incomplete/schemainvalid/responseoversize mengembalikan kegagalan aman. Jika hasil provider ada namun persistensi gagal, status tidak diklaim sukses; periksa running lewat reload, jangan hapus atau mengulang membabi buta. Running tidak dihapus oleh invalidate existing. Tidak ada pemulihan otomatis hasil provider yang belum berhasil disimpan.

## Privasi dan tinjauan

Kamus redaksi berisi nama/username/email responden sampel saja; kamus tidak dikirim ke provider/browser. Pola email, tautan, nomor/UUID dan kredensial berlabel disunting sebelum request dan pada hasil. Tidak menjamin nama pihak ketiga, alamat/narasi sensitif atau kredensial tanpa pola dapat dideteksi. Model tidak boleh menerima data yang belum sesuai kebijakan pengiriman eksternal. Tidak menulis ulang jawaban sumber.

Prompt menganggap esai sebagai data dan melarang instruksi/keputusan individual. Ini mitigasi prompt injection, bukan bukti injection mustahil. Hasil ditampilkan sebagai teks React, bukan HTML. Kutipan yang tidak ditemukan persis pada sampel redaksi dibuang. Review sumber/periode/kualitas data, tema, rekomendasi serta identitas tersisa; checkbox review hanya acknowledgement lokal dan tidak disimpan sebagai approval resmi.

Usage disimpan hanya dari key numerik yang dikenal; respons provider mentah, key, kamus identitas atau prompt tidak disimpan ke telemetry. Metadata hasil mencatat policy P12-1, whole_period, sampleCount, redaction dan review required. `store:false` pada OpenAI bukan jaminan zero retention/anonimitas untuk semua provider. Lihat kebijakan masing-masing penyedia.

## Penghentian dan rollback

Set `AI_ANALYSIS_ENABLED=false` untuk menghentikan panggilan baru; request yang sudah dikirim dapat tetap dikenakan biaya. Baca hasil, survei dan alur manual tetap tersedia. Pertahankan migrasi/reservasi saat rollback; jangan menghapus kuota atau arsip. Rollback ke kode sebelum P12 menghilangkan kontrol route sehingga tidak boleh digunakan sambil key/provider tetap aktif tanpa mitigasi operator. Gunakan patch kompatibel dengan kontrol deaktivasi. P10/P11 dan D10 tidak dianggap selesai oleh aktivasi AI.
