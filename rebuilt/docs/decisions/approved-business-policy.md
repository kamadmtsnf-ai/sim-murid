# Kebijakan disepakati — 19 Oktober 2026

- D01 / RAPOR-1.0: selalu PH20% + ATS30% + ASAS50%; Praktik ditampilkan terpisah, termasuk ketika bernilai0 atau100. PH80,ATS70,ASAS90 menghasilkan82 untuk seluruh kondisi Praktik.
- D02 / FEE-1.0: nearest thousand half-up untuk fee nonnegatif; raw1230→1000,1500→2000. Baseline slip: saldo dikurangi nominalTarik, uang diterima=nominalTarik−fee. Jangan mendebit fee lagi dari saldo.
- D03 / SURVEI-REQUIRED-1.0: esai wajib sesuai daftar backend, validator langkah/progres/final konsisten. PTS-7 peer tetap opsional. A7-1..3 dan B11/12 perrole wajib; Siswa juga esai5 tiap8mapel dan esai4 padaUPB,RHS,SNM,MSP. Survei mikro sesuai instrumennya.
- D10 / OPEN: pembaruan KKM dan rapor terbit belum diputus. D01 bukan persetujuan pengubahan arsip.

src/config/business-policy.ts menyimpan identitas dan pilihan kebijakan, bukan mesin kalkulasi. Implementasi dan tes domain dilakukan pada tahapan modul terkait.

## ACADEMIC-1.0 — penegasan pengguna, 22 Oktober 2026

- Nilai tahun ajaran yang diisi/dibaca pengguna adalah pasangan berurutan, misalnya `2026/2027`. Input `2026-2027` diterima dan dinormalisasi menjadi `2026/2027`; satu tahun `2026` bukan input tahun ajaran baru.
- Ganjil (ordinal internal 1): 1 Juli–31 Desember pada tahun pertama. Genap (ordinal internal 2): 1 Januari–30 Juni pada tahun kedua. Contoh 2026/2027: Ganjil Juli–Desember 2026 dan Genap Januari–Juni 2027.
- `start_year`/`year_start` adalah bagian tahun awal untuk penyimpanan, pengurutan dan foreign key; bukan label tahun ajaran yang ditampilkan. UUID, tanggal generated, semester ordinal dan arsip lama tetap kompatibel.
- Periode survei harus berada di dalam tahun ajaran dan semester yang dipilih. Periode yang sudah ada tidak boleh dipindahkan diam-diam ke identitas tahun/semester berbeda.
- Tahun kalender pembayaran/iuran, tanggal transaksi, tahun terbit buku dan tahun lulus tetap mengikuti maknanya; tidak diubah menjadi tahun ajaran. Penegasan ini tidak mengubah D10 atau arsip rapor terbit.
