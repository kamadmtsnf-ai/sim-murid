# Kebijakan disepakati — 19 Oktober 2026

- D01 / RAPOR-1.0: selalu PH20% + ATS30% + ASAS50%; Praktik ditampilkan terpisah, termasuk ketika bernilai0 atau100. PH80,ATS70,ASAS90 menghasilkan82 untuk seluruh kondisi Praktik.
- D02 / FEE-1.0: nearest thousand half-up untuk fee nonnegatif; raw1230→1000,1500→2000. Baseline slip: saldo dikurangi nominalTarik, uang diterima=nominalTarik−fee. Jangan mendebit fee lagi dari saldo.
- D03 / SURVEI-REQUIRED-1.0: esai wajib sesuai daftar backend, validator langkah/progres/final konsisten. PTS-7 peer tetap opsional. A7-1..3 dan B11/12 perrole wajib; Siswa juga esai5 tiap8mapel dan esai4 padaUPB,RHS,SNM,MSP. Survei mikro sesuai instrumennya.
- D10 / RAPOR-REVISION-1.0: disepakati pengguna 21 Oktober 2026. Arsip rapor terbit tetap immutable. Koreksi nilai/KKM menghasilkan versi baru dengan alasan wajib, penerbit, waktu, pemeriksaan versi dan audit. Versi lama tetap dapat dibaca/diunduh sesuai hak akses; tidak ada penghitungan ulang arsip diam-diam.

src/config/business-policy.ts menyimpan identitas dan pilihan kebijakan, bukan mesin kalkulasi. Implementasi dan tes domain dilakukan pada tahapan modul terkait.
