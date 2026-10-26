# P11 — Protokol evaluasi pengguna

25 Oktober 2026 WIB. Status: siap dipakai; **belum ada sesi manusia atau baseline waktu**. Tes browser otomatis bukan UAT atau ukuran kepuasan. Jangan mengisi hasil contoh sebagai hasil nyata.

## Sesi sebelum/sesudah

Fasilitator menggunakan staging terisolasi setelah gerbang P10 terpenuhi. Gunakan data sintetis, persetujuan peserta dan akun sesuai peran; jangan merekam password/OTP atau merekam layar data produksi. Peserta masuk sendiri. Simpan identitas peserta terpisah dari catatan evaluasi, gunakan kode anonim. Tidak ada undangan/pesan otomatis dari fitur ini.

Untuk setiap tugas lakukan minimal tiga pengulangan dengan dataset setara pada baseline dan versi dengan bantuan. Catat detik dari instruksi hingga hasil terkonfirmasi, sukses/gagal, bantuan fasilitator, salah pilih periode/anak, input ulang dan status simpan yang tidak dipahami. Keberhasilan berarti hasil domain cocok dan akses asing ditolak, bukan sekadar tombol diklik. Target ditetapkan setelah baseline, bukan angka buatan.

| Peran/penugasan | Tugas | Verifikasi hasil |
|---|---|---|
| Admin/TU | Cari lalu tambahkan pengguna dan penempatan kelas | Tidak duplikat, username teks, periode benar |
| Kepala | Temukan evaluasi dan tindak lanjut | Agregat sesuai izin, tanpa identitas peer |
| Guru mapel | Input batch nilai dan periksa hasil | Nilai cocok, kelas asing ditolak |
| Wali kelas | Periksa kelengkapan dan pratinjau rapor | Kelas binaan benar, arsip tidak berubah |
| Guru wali | Catat bimbingan | Siswa dalam cakupan, catatan terkonfirmasi |
| Guru piket | Catat kegiatan harian | Tanggal/penugasan benar, tidak duplikat |
| Konselor | Tinjau tindak lanjut | Hanya cakupan yang diizinkan |
| Bendahara komite | Catat pembayaran dan cocokkan riwayat | Alokasi/nominal cocok, status jelas |
| Pengelola tabungan | Setor/tarik dan periksa slip | Saldo, fee dan ledger cocok |
| Siswa | Temukan jadwal, isi survei dan lihat rapor sendiri | Data sendiri, finalisasi jelas |
| Orang tua multi-anak | Pindah anak lalu lihat informasi | Data tidak tercampur antar-anak |
| Alumni | Akses dokumen kelulusan | Dokumen sesuai izin |
| Nasabah | Periksa rekening dan transaksi | Rekening asing ditolak |
| Calon siswa | Lengkapi biodata sesuai akses | Tidak mendapat akses akademik aktif |

## Form catatan privat

Satu baris per percobaan: kode peserta anonim, peran/penugasan, ID tugas, versi/SHA, baseline atau setelah, viewport, pengulangan, durasi detik, sukses, jumlah error/input ulang, bantuan fasilitator, temuan tersunting. Jangan commit catatan mentah atau identitas peserta.

Ringkasan agregat: median durasi per tugas/peran, jumlah sukses/total, bantuan/total, jumlah input ulang dan temuan. Bandingkan tugas/data setara; jangan mencampur hasil simulasi dengan manusia. Baseline, hasil setelah dan perbandingan saat ini **belum tersedia**.

Triase: P0 kebocoran/integritas/hilang data menghentikan sesi dan rilis terkait; P1 tugas inti terblokir harus diperbaiki serta diuji ulang sebelum penerimaan; P2 kebingungan/minor masuk backlog berprioritas. Setiap temuan berisi langkah reproduksi tersunting, dampak, pemilik, perbaikan/PR dan hasil uji ulang. Jangan mengubah ledger/arsip untuk membuat tugas tampak sukses.

## Pelaporan kendala

Di setiap halaman ruang kerja tersedia disclosure “Bantuan untuk …”. Buka dengan sentuh atau Enter/Space. Salin kode laporan dari error, jika tersedia; kode bersifat opsional. Tombol menyalin templat saja, tidak mengirim tiket. Jika izin clipboard ditolak, salin textarea secara manual. Kirim melalui saluran resmi admin madrasah yang sudah dikenal. Jangan menebak alamat/email/nomor dukungan.

Admin meminta langkah, waktu WIB, perangkat dan kode laporan; tidak meminta password/OTP/cookie/kunci API. Sunting tangkapan layar sebelum dibagikan. Kode UUID HTTP berbeda dari digest error halaman; keduanya ditelusuri mengikuti runbook operasi. Tidak semua kegagalan mempunyai kode. Bantuan tidak memberikan hak akses baru.

## Penerimaan

Masih terbuka: baseline manusia, sesi setelah, perbandingan, triase/perbaikan temuan dan persetujuan pemilik. Rekam bukti agregat tersunting setelah benar-benar dijalankan. P10 staging/Auth/Storage/load tetap terbuka; fitur bantuan tidak menutup gerbang tersebut.

## L02 — ID tugas dan pemeriksaan bukti terstruktur

Protokol ini tetap kanonis. L02 menambahkan katalog `userTasks` pada `scripts/operations/user-evaluation.mjs` (A01–A21). Taksonomi role/penugasan menggunakan `uatScenarios` P10; ini bukan penambahan role database. Rincian skenario dan hasil otomatis ada di `docs/development/L02-ROLE-JOURNEYS.md`.

Gunakan `USER-EVALUATION-TEMPLATE.json` sebagai kerangka **kosong**, bukan bukti keberhasilan. SHA nol/satu adalah placeholder dan wajib diganti SHA versi yang benar. Catatan mentah disimpan privat di luar git; jangan menyalin akun, email, password, OTP, cookie, dokumen atau isi transaksi. Peserta memakai kode P1/P2; identitas/consent disimpan terpisah. Simulasi wajib berlabel `simulation`; tidak boleh diberi label manusia.

Jalankan setelah data benar-benar dicatat:

```sh
npm run uat:evaluate -- /absolute/private-observations.json /absolute/redacted-aggregate.json
```

Exit 0: bukti terstruktur lengkap menurut pemeriksa, **bukan verifikasi independen partisipasi manusia atau izin deploy**. Exit 2: bukti valid tetapi belum memenuhi penerimaan. Exit 1: input/akses file invalid. Pesan error tidak mencetak data input. Laporan hanya agregat per tugas, tanpa kode peserta/baris percobaan.

### Skema catatan

Envelope mengikuti template: versi 1, kind human/simulation, environment staging/isolated, consentRecorded, operatorAttested, evidenceSha256 (hash bukti privat), baselineCommit/afterCommit SHA40, targetSuccessRate usulan 0.95, observations dan findings. Bukti consent tidak dimasukkan ke git. Hash/attestation tetap pernyataan operator, bukan bukti kriptografis bahwa sesi dilakukan manusia.

Setiap observation berisi tepat field berikut:

| Field | Nilai |
|---|---|
| id, participant | O1…O999999 dan P1…P9999; tanpa nama |
| task | A01–A21 dari katalog |
| phase, commit | baseline/after dan SHA40 sesuai envelope |
| dataset | SHA256 skenario/dataset sintetis setara; tanpa data aslinya |
| repetition, viewport | Pengulangan 1–100; mobile/tablet/desktop |
| durationSeconds | Durasi nyata positif, maksimum 86400 |
| outcome | success/failure/aborted; aborted tetap masuk denominator |
| errors, reentries, assistance | Jumlah yang diamati, integer nonnegatif |
| domainMatched | Hasil domain sesuai skenario |
| unauthorizedAccessDenied | Pemeriksaan akses terlarang yang diwajibkan skenario ditolak |
| duplicateMutationPrevented | Pemeriksaan retry/duplikasi yang diwajibkan skenario lulus |

Akses/duplikasi pada tugas read-only dibuktikan melalui skenario penolakan yang relevan; jangan mengisi true tanpa pemeriksaan. Expected denial merupakan keberhasilan tugas bila sesuai kriteria domain. Minimal tiga percobaan baseline dan setelah per tugas. Pasangkan peserta, dataset, pengulangan, viewport; versi harus berbeda. Jangan membuang percobaan gagal/aborted demi menaikkan persentase. Median dan success rate kosong bernilai null, bukan nol. Rate dilaporkan per tugas, sehingga tugas bermasalah tidak tertutup rata-rata gabungan.

Finding berisi id F1…, task, severity P0/P1/P2, status open/retest_passed, fixCommit SHA40/null dan retestObservation O…/null. P0/P1 terbuka memblokir penerimaan. Retest harus observation setelah yang sukses pada tugas dan SHA target yang sama. Rekam langkah reproduksi, pemilik, perbaikan/PR secara privat; skema ini sengaja tidak menerima catatan bebas yang mungkin berisi data pribadi. P2 tetap masuk backlog dan tidak hilang dari agregat.

Perbaikan baru setelah baseline memerlukan versi target yang jelas dan retest. Jangan memakai hasil evaluator ini untuk otomatis meluluskan P10 restore/load/owner acceptance; gerbang tersebut tetap terpisah. Penurunan durasi hanya ditampilkan untuk pasangan sebanding, tidak otomatis berarti UX membaik atau peningkatan signifikan secara statistik.
