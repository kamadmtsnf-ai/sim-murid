# Tahap 2 — Spesifikasi Aturan Bisnis Rebuilt SiM-Murid

Versi 1.0 — D01–D03 disepakati pengguna • 19 Oktober 2026 • Zona bisnis Asia/Jakarta.

**Status: keputusan utama D01–D03 telah disepakati pengguna pada 19 Oktober 2026 pukul 12.51 WIB. D10 (KKM dan arsip) masih berupa rekomendasi tersendiri; keputusan D01 tidak dianggap menyetujui D10.** Tidak ada implementasi, perubahan database, deployment, atau pengubahan aturan pada sistem lama.

## 1. Acuan dan cara menerapkan

Acuan utama: Dasar_Pembangunan_Ulang_SiM-Murid_Nextjs_Supabase.md versi 1.0, commit sumber `bf1e0e0dcb8bec9c23319fba8eda6331889ebba1`. Acuan pelacakan: Tahap_01_Matriks_Kesetaraan_Fungsional_SiM-Murid.md,125 unit fitur,17 modul. Dokumen ini memperinci D01–D09, menambahkan temuan D10 tentang pembaruan KKM, dan memberi contoh hasil yang dapat diperiksa.

Urutan otoritas: instruksi eksplisit pengguna terbaru → keputusan bisnis berstatus disepakati → persyaratan dokumen dasar → rekomendasi desain → kode lama sebagai bukti perilaku. Label TARGET atau USULAN tidak berarti telah disetujui. Arsip tidak dihitung ulang berdasarkan rekomendasi yang belum menjadi kebijakan.

Label: **BASELINE**=perilaku lama teridentifikasi; **KONTRAK TEKNIS**=rincian implementasi yang mengikuti persyaratan keamanan/integritas; **USULAN BISNIS**=memerlukan keputusan; **VERIFIKASI IMPLEMENTASI**=perlu dibuktikan ketika integrasi/tes dibuat. Status TERUJI hanya boleh diberikan setelah menjalankan aplikasi/tes yang relevan, bukan setelah menghitung contoh di dokumen.

## 2. Ringkasan keputusan dan dependensi

| ID | Hasil analisis | Status saat dokumen dibuat | Pekerjaan terkait |
|---|---|---|---|
| D01 | Selalu PH 20%, ATS 30%, ASAS 50%; Praktik ditampilkan terpisah | DISEPAKATI PENGGUNA | Tahap 22–23; M11-F05..07 |
| D02 | Fee dibulatkan ke ribuan terdekat: Rp1.230→Rp1.000; tidak menambah debit fee ke saldo | PEMBULATAN DISEPAKATI; pembebanan mengikuti baseline slip yang dijelaskan saat pilihan | Tahap 20–21; M10-F02,F06..09 |
| D03 | Esai wajib sesuai daftar backend lama; esai peer opsional; validasi langkah dan submit sama | DISEPAKATI PENGGUNA | Tahap 28–29; M16-F03..06,F09 |
| D04 | Kontrak username/password, sesi, gate dan pemulihan dirumuskan | KONTRAK TEKNIS; jalur akun tanpa email wajib dibuktikan pada implementasi Auth | Tahap 5–9,11 |
| D05 | Matriks izin minimum dirumuskan; scope/aksi yang tidak terbukti tidak diberi otomatis | KONTRAK TEKNIS + REVIEW ownership saat implementasi | Tahap7 dan seluruh modul |
| D06 | Pembayaran/waiver saudara dinormalisasi tanpa mengarang tarif | BASELINE + KONTRAK TEKNIS; keluarga ambigu ditandai review | Tahap 11,19 |
| D07 | Outbox/job/provider adapters; tidak memilih layanan berbayar atau mengaktifkan kirim | KONTRAK TEKNIS; penyedia/konfigurasi aktual belum dipilih | Tahap 21,27–30 |
| D08 | Rekening tidak tergantung role; koreksi ledger via reversal; satu setoran aktif/hari | KONTRAK TEKNIS; perlu bukti concurrency | Tahap 20–21 |
| D09 | SoTM mempertahankan urutan saldo/pelanggaran; tie sisa stabil | Rekomendasi teknis: legacy order yang disnapshot, lalu ID; tidak menambah kriteria prestasi | Tahap 27 |
| D10 | saveKKM lama memperbarui KKM pada nilai periode sama | Konflik tambahan yang perlu dicatat; arsip baru dibedakan draft/terbit | Tahap 22–23 |

D01–D03 dibekukan sebagai kebijakan versi 1.0 sesuai jawaban pengguna; opsi lain dalam tabel merupakan catatan alternatif yang tidak dipilih. Fondasi proyek dan pekerjaan yang tidak bergantung keputusan tersebut tetap dapat berjalan. Penyedia eksternal, data keluarga nyata dan metadata historis yang belum tersedia tidak dipalsukan atau dianggap sudah siap.

## 3. D01 — Nilai, KKM dan rapor

### 3.1 Bukti sumber

`getRekapNilai` Code.gs7200: nilai rapor=(2×rataPH+3×ATS+5×ASAS)/10; Praktik terpisah. Index.html sekitar48610: bila Praktik bukan null,20%PH+25%ATS+40%ASAS+15%Praktik; bila null,20%PH+30%ATS+50%ASAS. `getRaportSiswa` Code.gs7491 menyediakan rapor per jenis, bukan gabungan. Nilai Praktik 0 tetap dianggap ada pada frontend.

### 3.2 Pilihan yang dapat ditetapkan

| Pilihan | Rumus resmi | Konsekuensi |
|---|---|---|
| A — Tidak dipilih | Tanpa Praktik:20/30/50; dengan Praktik:20/25/40/15 | Praktik memengaruhi nilai akhir; sama pada rekap, layar pribadi/orangtua dan PDF |
| B — DIPILIH | Selalu20/30/50; Praktik informasi terpisah | Mempertahankan hasil rekap backend lama dan tidak memasukkan Praktik ke nilai akhir |
| C | Tetapkan bobot sendiri | Bobot harus tertulis,total100%; aturan komponen belum diisi harus ditentukan |

**Keputusan final D01: pilihan B. Nilai rapor = 0,20 × rataPH + 0,30 × ATS + 0,50 × ASAS, baik Praktik kosong, nol, maupun terisi. Praktik tampil sebagai informasi terpisah dan tidak memengaruhi nilai gabungan.** Berlaku sama pada rekap, layar siswa/orang tua, serta PDF. Setiap hasil gabungan menyimpan report_policy_version,komponen sumber,KKM yang digunakan dan waktu penerbitan. Tidak menimpa nilai/hasil rapor historis diam-diam.

### 3.3 Kontrak perhitungan

- Tahun ajaranY/Y+1: semester1 1Juli–31DesemberY; semester2 1Januari–30JuniY+1. Tanggal bisnis WIB, tanpa geser karena UTC.
- Nilai numerik0..100; nol sah. null berarti belum diisi. RataPH dari PH yang ada, bukan jumlah slot kosong. Jenis Praktik null dibedakan dari Praktik 0.
- Baseline lama mengubah komponen kosong menjadi0 saat menghitung. Usulan UI baru memberi label **sementara/belum lengkap** bila komponen wajib belum ada; angka simulasi boleh memakai baseline0 tetapi tidak diklaim nilai final. Ini pemisahan status, bukan mengganti bobot otomatis.
- Pembulatan nilai rapor dilakukan sekali ke2desimal sebelum menentukan predikat, sebagaimana rekap lama; rataPH tidak dibulatkan dahulu untuk kalkulasi akhir. Tampilan boleh2desimal.
- Predikat menggunakan interval=(100−KKM)/3. Jika nilai<KKM:D; >=KKM+2interval:A; >=KKM+interval:B; selainnya:C. KKM 100: nilai 100=A dan<100=D; tidak ada pembagian interval untuk pencarian yang berisiko divide-by-zero.
- KKM default75 bila belum ada konfigurasi sah. Jangan memakai KKM periode lain sebagai fallback tersembunyi. Rekam bahwa fallback dipakai.
- Pengubahan bobot menjadi kebijakan berversi; draft boleh dihitung dengan versi dipilih. Rapor terbit memakai snapshot hingga ada koreksi berizin dan versi keluaran baru.

### 3.4 Contoh penerimaan

| ID | Input | A: Praktik berbobot | B: Praktik terpisah |
|---|---|---:|---:|
| BR-N01 | rataPH80,ATS70,ASAS90,Praktik null |82|82|
| BR-N02 | rataPH80,ATS70,ASAS90,Praktik 100 |84,50|82|
| BR-N03 | rataPH80,ATS70,ASAS90,Praktik 0 |69,50|82|
| BR-N04 | nilai 75,KKM 75 |C|C|
| BR-N05 | nilai 91,67,KKM 75 |A|A|
| BR-N06 | nilai 100,KKM 100 |A|A|

Kolom A pada contoh hanyalah pembanding rumus lama yang tidak dipilih. Hasil resmi BR-N01, BR-N02, dan BR-N03 semuanya 82. Keputusan ini tidak berarti menghitung ulang rapor lama 84,50 atau 82 menjadi nilai lain. Simpan hasil historis dan sumber kebijakannya; bila hasil lama tidak tersedia, tandai rekonstruksi dengan rumus yang digunakan.

## 4. D02 — Fee, saldo dan slip penarikan

### 4.1 Bukti dan prinsip

`calculateFeeAndPercent` Index.html33731 memilih bracket dengan min terbesar lalu round(fee/1000)×1000. `_calcFeeAmount_` Code.gs2721 memilih bracket cocok pertama dan round(fee) ke rupiah. `_dispatchSlipPenarikanEmail` menghitung fee dari FeeConfig tanpa flag fee_applied terstruktur. `_buildSlipPenarikanHtml` Code.gs2294 secara eksplisit memakai **jumlahDiterima=jumlah−biayaAdmin** dan saldoSesudah=saldoSebelum−jumlah dari pemanggil.

Dengan demikian, baseline slip tidak mendebit nominal+fee dari saldo. Penyelarasan harus menghindari pemotongan ganda dan memastikan toggle form benar-benar memengaruhi slip.

### 4.2 Pilihan pembulatan

| Pilihan | Rumus | Rp123.000×1% | Rp150.000×1% |
|---|---|---:|---:|
| A — DIPILIH mengikuti form | round(rawFee/1000)×1000 |Rp1.000|Rp2.000|
| B — Mengikuti kalkulator backend | round(rawFee) |Rp1.230|Rp1.500|
| C | Pembulatan khusus yang dinyatakan pengguna |sesuai aturan|sesuai aturan|

**Keputusan final D02: pilihan A, pembulatan ke ribuan terdekat.** Round di sini pembulatan terdekat half-up untuk nominal nonnegatif; bukan selalu dibulatkan ke atas. Rp400→Rp0, Rp500→Rp1.000 bila pembulatanribuan. Bila ingin fee minimum atau selalu ceil, itu keputusan berbeda dan tidak diterapkan otomatis.

### 4.3 Kontrak transaksi yang mengikuti baseline slip

```text
withdrawal_amount = nominal Tarik yang dimasukkan
fee_amount = fee_applied ? calculate(snapshot bracket,withdrawal_amount,policy) : 0
balance_after = balance_before - withdrawal_amount
cash_received = withdrawal_amount - fee_amount
```

- Setor: fee_applied=false dan fee_amount0. Tarik: toggle dapat aktif/nonaktif dan disimpan sebagai field; bukan ditafsir dari teks keterangan.
- NominalSetor/Tarik minimal 1000 dan kelipatan 1000; periksa server dan database. Penarikan<=saldo yang dikunci pada transaksi.
- Bracket min inklusif,max inklusif/null tanpa batas,min>=0,max>=min,persentase0..100. Tolak bracket tumpang tindih. Nominal di luar seluruh bracket menghasilkanfee 0 disertai keterangan tidak ada tarif; jangan memilih bracket terdekat tanpa aturan.
- Snapshot bracket,persentase,raw_fee,rounding_mode,fee_applied dan fee_amount tersimpan. Histori tidak dihitung ulang dari bracket saat ini.
- fee_amount tidak boleh melebihi withdrawal_amount atau membuat cash_received negatif. Jika pembulatan menghasilkan demikian, tolak konfigurasi/transaksi, jangan mengurangi fee diam-diam.
- Nomor slip dialokasikan sekali secara unik setelah transaksi diterima; prefix S/G/N mengikuti kategori rekening terstruktur. Penomoran tidak diulang setelah void dan tidak dihitung dari jumlah baris tersisa.
- Saldo sebelum/sesudah pada slip adalah snapshot transaksi saat dibukukan, bukan hasil saldo terkini saat email retry. Backdate transaksi tidak mengubah slip lama diam-diam.
- Terbilang pada field Nominal Penarikan mengikuti nominal tarik. Jika tampil terbilang uang diterima, beri label terpisah.

### 4.4 Contoh penerimaan

BR-F01: toggle mati menghasilkan fee 0. BR-F02: toggle aktif memakai pembulatan yang dipilih. BR-F03: debit saldo tetap nominal tarik dan tunai diterima dikurangi fee sesuai baseline slip. BR-F04: retry email mempertahankan nomor, fee dan saldo snapshot transaksi.


Saldo awalRp200.000,tarikRp123.000,fee1%:

| Kasus | Fee | Saldo sesudah | Tunai diterima |
|---|---:|---:|---:|
| Togglemati |0|77.000|123.000|
| Toggleaktif+pilihanA |1.000|77.000|122.000|
| Toggleaktif+pilihanB |1.230|77.000|121.770|

Jika pengguna menghendaki fee didebit tambahan, kontrak di atas harus diubah eksplisit sekaligus validasi saldo, slip, ledger dan contoh ujinya. Belum ada instruksi demikian.

## 5. D03 — Esai survei wajib atau opsional

### 5.1 Konflik

`_surveiValidateStep` Index.html66007 hanya memvalidasi Likert dan berkomentar bahwa esai opsional. `submitSurveiUtama` Code.gs10775 memakai checkEsaiList untuk A7-1..3 dan B-11..12; bagi Siswa juga esai tiap8 mapel dan4 kegiatan diwajibkan. Pengguna dapat lolos langkah UI tetapi gagal submit final. Esai PTS-7 teman sejawat memang opsional dan harus dibedakan.

### 5.2 Pilihan

| Pilihan | Aturan | Dampak |
|---|---|---|
| A — DIPILIH untuk kesetaraan backend | Esai yang diwajibkan backend tetap wajib; esai peer opsional | UI/langkah/progres/final memberi pesan required yang konsisten; instrumen tetap lengkap |
| B | Semua esai opsional; Likert/attention dan peer tetap wajib | Backend harus berubah; submit boleh tanpa esai; AI tetap mensyaratkan minimal 5 jawaban esai nyata |
| C | Hanya kode esai tertentu wajib | Daftar kode wajib harus ditulis per role dan bagian; jangan mengira semua esai setara |

**Keputusan final D03: pilihan A, esai wajib sesuai daftar backend lama; esai penilaian teman sejawat tetap opsional. Validasi langkah, progres, dan submit final harus menggunakan aturan yang sama.** Keputusan tidak menghapus pertanyaan atau mengganti teks. `required` menjadi metadata instrumen berversi, digunakan satu validator di client/server. Bank instrumen lengkap, label Likert,rotasi8 mapel,snapshotpeer dan aturan flags dipertahankan.

### 5.3 Persyaratan yang tetap berlaku pada semua pilihan

- SkalaLikert1..5; ATT-1 ekspektasi1; ATT-2Siswa ekspektasi5. Attention bukan bagian rata-rata aspek/mapel.
- Esai required kosong atau whitespace ditolak; esai opsional kosong tidak disimpan sebagai jawaban palsu untuk memenuhi minimalAI.
- Rotasi8 mapel ditetapkan sekali/periode/siswa berdasar histori frekuensi dan seeded jitter; tidak diacak ulang saat reload.
- Snapshotpeer mencakup Guru selain diri sendiri; seluruh6 dimensi/rekan dilengkapi skor1..5 atauTT; submitpeer selesai sebelum final utamaGuru.
- TT bukan 0 dan tidak masuk denominator rata-rata. Hasil personalpeer minimal 5 penilai substantif secara default, kutipanmaksimal 3.
- Autosave lokal/server dipisahakun+periode+versiinstrumen; draftlama tidak menimpa versi baru tanpa konflik; final immutable; expiry sesi tidak memberi hak menyimpan sebagai orang lain.
- Flag waktu/straightline/attention mengikuti baseline. Flag kualitas tidak otomatis menghapus jawaban; opsi mengecualikan data mencatat filter serta jumlah dikecualikan.
- Rencanaaksi3..7 poin khususKepala, setelah akhirhari penutupan sampaiH+30 inklusif; statusbelum/proses/selesai. Surveimikro merupakan alur terpisah.

### 5.4 Kriteria penerimaan tambahan

BR-S01: A7-1kosong→UI dan server memberi keputusan sama sesuai pilihan. BR-S02: PTS-7kosong tidak menghalangi submitpeer. BR-S03: opsionalkosong tidak menambah jumlahesaiAI. BR-S04: finalterkunci menolak autosave tablama. BR-S05: numerator/denominator progres dihitung dari kode dan required aktual, bukan angka hardcode yang tidak cocok bank.

## 6. D04 — Identitas, sesi, onboarding dan pemulihan

Kontrak teknis:

1. UUID identitas menjadi relasi; username text unik dengan aturan normalisasi terdokumentasi. Hapus apostrof penyimpanan spreadsheet pada migrasi, tetapi jangan parseFloat atau membuang nolawal untuk menggabungkan akun. Duplikat ambigu menjadi laporan review.
2. Form login tetapusername/password; verifikasi identitas berada dalam sistem aplikasi/Supabase Auth. Browser tidak diberi tabel username→email/password, servicekey atau hashcredential.
3. Akun tanpa email tetap punya jalur provisioning dan reset oleh petugas berizin dengan proses verifikasi identitas. Jangan mengirim emailpemulihan ke alamat fiktif atau menganggap email identitas teknis sebagai kontak terverifikasi. Rincian adapterusername→Auth dan jalur tanpaemail wajib dibuktikan padaTahap 5–6 sebelum diberi statusberfungsi.
4. Password awal unik sementara, wajib ganti; tidak memakai123456 bersama. Pertanyaan keamanan tetap tersediasebagai bagianpermintaan pemulihan, bukan satu-satunya bukti mengganti password.
5. Sesi biasa maksimum 1 jam; remembermaksimum 168 jam dihitung sejaklogin. RefreshAuth tidak memperpanjang batasaplikasi secara diam-diam. Satusesiaktif dengan registrysesi atomik; dua loginbersamaan tidak sama-sama mengklaim slot.
6. Logout/revoke/reset mematikan registry; operasi sensitif selalu memeriksa status terkini, bukan mengandalkan claimrolecached. Ganti password mencabut sesi lain sesuai tujuan keamanan sumber; client menjalani autentikasi ulang yang jelas.
7. OTPemailGuruTTL 600 detik,cooldown 60 detik,5 kirim/hariWIB,5 percobaan; hashed,sekali pakai,rate-limitserver; perubahanalamat membatalkanverified dan pendingOTP lama.
8. Prioritasgate yang diusulkan untuk menghindari loop: sesi valid→wajib gantipassword→profilwajib→pertanyaan keamanan→verifikasiemailGuru→surveiwajib→halamanlain. Pada tiaplangkah hanya halamanperbaikan terkait+logout diizinkan; server memakai state yang sama. Prioritas ini rincian teknis baru atas tujuan gate lama, harus dites terhadap peran gabungan, bukan disalin sebagai if di banyak tempat.
9. Siswa/Calon diwajibkanprofil sesuai fieldkondisional; Guru wajib email verified sebelum fitur domain. Penggunatidakboleh terjebak karena field yang dinonaktifkan justru wajib di server.

## 7. D05 — Matriks izin aksi minimum

Ini spesifikasi target minimum yang diturunkan dari tujuan peran pada dokumen dasar. “Baca” tidak otomatis mencakup ekspor massal PII atau edit. Aksi tambahan yang belum jelas harus ditelusuri ke handler/data baseline saat porting dan ditambahkan melalui perubahan kebijakan; jangan memberi seluruhizin untuk menghindari error.

| Resource | Admin | Kepala tanpa tugas lain | Guru/tugas khusus | Siswa/Calon/Nasabah/Alumni | Orangtua |
|---|---|---|---|---|---|
| Akun/role/tugas | Kelola,reset,revoke dengan audit | Baca direktori/manajemen yang tersedia; tidak ubah privilege | Profil/keamanan sendiri | Profil/keamanan sendiri | Profil/keamanan sendiri |
| Biodata keluarga/dokumen | Kelola sesuai kebutuhan administratif | Baca sesuai scope administratif, data sensitif dibatasi | Tidak otomatis membaca seluruh NIK/dokumen | Siswa/Calon: milik sendiri | Relasi anak bukan otomatis izin edit dokumen/biodata anak |
| Kelas/jadwal | Kelola seluruh | Baca seluruh | Wali:kelola kelas/jadwal kelas ditugaskan; Guru:jadwal sendiri | Siswa:jadwal kelas sendiri | Baca data anak hanya melalui modul yang tersedia |
| Absensi | Input/koreksi/hapus berizin | Baca | Piket/pengganti terkonfirmasi hariini input sesuai scope; Wali:baca kelas | Siswa:baca sendiri | Baca anak sah |
| Penunjukan guru piket | Kelola/konfirmasi/batal | Tidak otomatis mengonfirmasi | Guru melihat status sendiri | Tidak ada | Tidak ada |
| Bimbingan | Kelola penugasan dan laporan sesuai izin | Baca pimpinan | Mentor:buat/edit laporan sendiri untuk siswa bimbingan; hapus sesuai ownership | Siswa:baca sendiri | Baca anak sah |
| Iuran | Kelola | Baca | Bendahara:kelola; Wali:baca ringkasan kelas | Siswa:baca sendiri | Baca anak sah |
| Tabungan/fee | Kelola | Baca | Pengelola:kelola; Guruberflag:baca rekening sendiri | Pemilik:baca sendiri | Baca anak sah |
| Nilai/KKM | Administratif sesuai capability, audit | Baca; sebagai Guru boleh aksi pada penugasan sendiri | Guru:input/koreksi/KKM kelas-mapel yang ditugaskan | Siswa:baca sendiri | Baca anak sah |
| Kenaikan/alumni/ijazah | Kelola | Baca bila menu tersedia, tidak otomatis melakukan promosi | Tidak ada tanpa penugasan eksplisit | Alumni:lihat/unduh sendiri menurut override | Tidak otomatis akses ijazah anakalumni |
| Buku | Kelola katalog | Baca sesuai premium | Baca sesuai premium | Baca sesuai premium | Baca sesuai premium |
| SPK event | Kelola | Baca sesuai akses dashboard; tidak otomatis hak Admin | Guru input sesuai capability sumber; Wali/Mentor/BK baca scope tugas. Scope input Guru belum terbukti ditandai review | Siswa:baca sendiri | Baca anak sah |
| SPK katalog/reset/sync | Kelola | Tidak otomatis kelola | Baca yang diperlukan; tidak otomatis kelola | Tidak ada | Tidak ada |
| Periode/rekap survei | Kelola dan baca berizin | Kelola/baca sesuai fungsi sumber | Guru:isi sendiri/hasil personal yang layak | Siswa:isi sendiri bila target | Isi sendiri bila target |
| Rencana aksi | Baca; menulis hanya bila juga tugas Kepala | Tulis dan perbarui ketercapaian | Tidak ada tanpa tugas Kepala | Baca versi publik yang diperbolehkan | Baca versi publik yang diperbolehkan |
| Konfigurasi rahasia | Tulis,lihat maskedstatus | Tidak otomatis lihat key | Tidak ada | Tidak ada | Tidak ada |
| AI analisis survei | Jalankan/baca/hapuscache sesuai izin | Jalankan/baca/hapuscache sesuai fungsi sumber | Tidak ada tanpa izin eksplisit | Tidak ada | Tidak ada |
| Log/notifikasi | Log administratif; notifikasi milik sendiri | Log sendiri kecuali izin tambahan | Log/notifikasi sendiri | Log/notifikasi sendiri | Log/notifikasi sendiri |

Aturan gabungan: capability per resource+aksi+scope merupakan union penugasan yang sah. Kepala+Bendahara dapat mengelola iuran; Kepala saja hanya baca. Admin tanpa tugas Kepala tidak menulis rencanaaksi. `aksesTabungan` tidak memberi savings.manage. Scope GuruinputSPK/BK yang belum terbukti harus diselesaikan sebelum rilis SPK, bukan ditebak dari nama menu.

Ekspor memakai scope data yang sama dan capabilityekspor yang relevan. Unduh private object memeriksa ownership/override sebelum URL/bytes. RLS dan grants database mengikuti matriks, termasuk jalurAPI/RPC/view/Storage; claim yang dapat diedit pengguna bukan sumber privilege. Pengubahan role/tugas berdampak segera pada operasi sensitif.

## 8. D06 — Keluarga, iuran dan diskon saudara

BASELINE: siswa pada kelas natural paling rendah dalam keluarga menjadi penerima gratis ketika saudara lain membayar. Sistem mencatatRp0 bertanda Gratis - Diskon Saudara Kandung. Ini bukan diskonpersentase, bukan uangmasuk, dan bukan otomatisgratisuntuk semua anak dalam keluarga besar.

Kontrak:

- Pemetaan keluarga eksplisit menggunakan student_guardians dan grupbenefit; jangan menganggap semua anak yang berbagi wali umum otomatis saudara kandung tanpa datahubungan. CSVortu ambigu atau wali lebihdarisatu ditinjau sebelum membuat grupbenefit.
- Satu penerimagratis menurut urutan kelas natural baseline per konteks pembayarankeluarga. Ketika kelas sama, legacyorder yang dicatat dipakai sampai kebijakan tie khusus diperlukan; jangan mengganti ke umuranak tanpa data/keputusan.
- Pembayaran punya alokasibulan+tahunkalender; waived adalah status terpisah dari paidcash. Tarif perperiode/kelas perlu data administrasi aktual; jangan mengarang nominal tetap.
- Benefit punya sourcepayment dan alokasi bulan sumber. Bila lebihdarisatu pembayaran saudara mendukung waiver yang sama, simpan relasisumber pendukung; voidsatusumber tidak membatalkan waiver yang masih didukung sumberlain.
- Edit/void merekonsiliasi alokasi dan benefit dalam satu transaksi; alasan/pelaku/waktu diaudit. Bulan sudahlunas terkunci kecuali alokasitransaksisedangdiedit.
- Semua siswaaktif masuk rekap, termasuk belum pernahbayar. Jika tarifbelum diketahui, tampil **tarif belum ditetapkan**, bukan tunggakanRp0 yang menyiratkan lunas.
- Arsip hasil parsing keterangan menyimpan teksasli,alokasihasil,statusreview. Tidak membuat buktipembayaran baru hanya agar data terlihat lengkap.

Contoh: Akelas7A,Bkelas9A saudara; BbayarJuliRpX→kasX,alokasiBpaidJuli,alokasiAwaivedJuliRp0. VoidB tanpa sumberlain→kasdikoreksi via reversal,alokasipaidBdibatalkan danwaiverAditinjau/dibatalkan atomik. BayarulangJuli tidak menggandakan kas/waiver karena idempotencykey danconstraintalokasi.

## 9. D07 — Integrasi, jadwal dan operasi

- Adapterserver email,WA,AI dan scheduler memiliki statusbelumterkonfigurasi/siap/gagal; tidak menampilkan sukses bila belum dikirim. Pemilihan vendor/biayapaket bukan bagianpenetapan diam-diam pada tahap ini.
- Outbox dicatat bersama transaksi domain, pengiriman dilakukan setelah commit; retrybackoff dan dedupkey. Provider timeout dengan statuspengirimanambigu ditelusuri sesuai dukunganidempotencyprovider; jangan menjanjikan exactly-once lintasprovider yang tidak mendukungnya.
- Pengingatpiket memeriksa15,17,19,21,23WIB; maksimalsatusuksesuser/hari, skiplibur,email salah,total siswa 0,absensi lengkap. Dry-run tanpa efek samping; manualberizin tetap memakai dedup.
- ResetSPK perbulan punya jobkeyperiode,unique snapshot siswa+bulan dan transaksiyangamanretry. Joblama dan jobbaru tidak aktif bersamaan saatcutover.
- AI mengikuti batas5/150/1500karakter dan JSONschema sumber. Key write-only,modelconfigurable,hasilcacheberversi,tidakmengidentifikasiresponden. Survei utama tetapberfungsi bilaAI tidak tersedia.
- Snapshotemail/slip mempertahankan field saattransaksi; perubahanprofil tidak mengubah keluaran historis tanpa reissueberizin.
- Bataspaket,Vercelrequestsize,Storage,scheduler dan ketersediaanmodel diverifikasi terhadap dokumenaktual pada tahap implementasi. Dokumenini tidak menetapkan kapasitasgratis/kuota/biayayang belum diperiksa.

## 10. D08 — Rekening dan koreksi ledger

Rekening terhubungUUIDpemilik, kategori penabungterpisah darirole login. Siswa→Alumni tidak membuat rekeningbaru atau menghilangkan saldo. KategoriS/G/N untukslip disimpan pertransaksi sesuai data rekening; labelUI siswa/non-siswa tidak dipakai sebagaijenisrekeningfinal.

Satu transaksisetoranaktif perrekening per tanggalbisnis. Setorkedua memberikonflik+detailrecordberizin→modeedit,tidak otomatis menambah/menimpa. Editmenghasilkan koreksiberversi/reversal dengan roottransaksiyangsama agar constraintsetoranaktif tetapbermakna.

Untuktarik,lockrekening→hitung saldo aktif→validasi→insertledger+slip+audit+outbox→commit. Koreksitarik dengan nominal baru mengeluarkan efeknominal lama sebelum memeriksa batasbaru. Pembatalansetoran tidak boleh membuat saldo aktifnegatif; jika berdampak demikian,tolak dan tampilkan transaksi terkait untuk direkonsiliasi, bukan menghapus diam-diam.

Terdapat dua tampilan waktu: mutasiurut tanggalbisnis (dengan urutanpencatatan stabil) dan saldo/slipsaatpembukuan. Backdate tidak mengubah snapshot slip yang sudah terbit. Rekapperiodik menampilkan saldoperiodeawaldanakhir bila judulnya saldo, bukan menamai netmutasiperiodik sebagai saldokeseluruhan.

## 11. D09 — SoTM dan konversi afektif

Urututama SoTM: saldo turun (tertinggiterlebihdahulu), jumlahpelanggaran naik (tersedikit). Untuk tieyangmasihsama gunakan legacyorder yang disnapshot saatmigrasi; data baru memakai IDstabil sebagai tie-breakteknis. Tidak menambahkan poinbonus,kehadiran,umur atau prestasi baru. Bila sekolahmenghendaki juarabersama,tetapkan sebagai kebijakanbaru sebelumterbitsertifikat.

Saldo awal50,range−50..100,level danresidivis sama baseline. Afektif=round(clamp((saldo+50)/150×100,0,100)); saldo50→67. Sinksiswamapelperiodeunik; synculangtanpapermintaankoreksi tidak menggandakan. Sumber snapshot bulan lama dipertahankan, tidak memakai saldo bulan berjalan untuk nilai arsip.

## 12. D10 — Pembaruan KKM dan penerbitan arsip

**Temuan tambahan:** `saveKKM` Code.gs7359 tidak hanya menyimpan master KKM, tetapi juga mengganti kolomKKM di semuaNilai pada kelas+mapel+tahun+semester yang sama. Dokumen dasar menghendaki snapshotKKM historis; keduanya tidak identik jika nilai/rapor sudah terbit. Temuanini dicatat tanpa mengubah acuanasal.

Rancangan untuk dibahas bersama D01:

1. KKM master perkelas-mapel-periode dapatdiperbarui dengan audit; preview jumlahnilai/rapor yang terdampak.
2. Nilai/rapor **draft** dapatdihitung ulang dengan revisiKKMperiode aktif sesuai aksi eksplisit, bukan pembaruanarsip tersembunyi.
3. Rapor **sudah terbit** mempertahankan snapshotKKM/rumus/hasil. Koreksiberizin membuat versibaru yang mereferensikan keluaranlama.
4. Karena sumber lama tidak mempunyai statuspublishedyangterjamin, data migrasi yang tidak diketahui statusnya diperlakukan sebagai arsiphistoris; jangan otomatis menerapkan perubahanKKM ke seluruhnya.

Status: rekomendasi belum menjadi kebijakan bisnis final. SkenarioujiKKM 75→80 pada periodeyangsama harusmembedakan draft/terbit dan menguji perilaku yang dipilih.

## 13. Paket uji aturan sebelum implementasi dinyatakan selesai

| Kelompok | Bukti yang perlu dihasilkan | Status |
|---|---|---|
| BR-N01..06 dan U16–17 | Rumusnilai,Praktik 0/null,KKM 100,bataspredikat,arsipversi | BELUM DIJALANKAN |
| BR-F01..04 dan U13–15 | Togglefee,multipembulatan,kasvsledger,concurrencytarik,snapshotretry | BELUM DIJALANKAN |
| BR-S01..05 dan U22–26 | Requiredesai,peerTT,autosaveconflict,finalimmutable,AIminesai | BELUM DIJALANKAN |
| U01–06 | Sesi,recovery,emailgate,role/tugasgabungan,parentIDOR,biodatakondisional | BELUM DIJALANKAN |
| U08–12,U18–21 | Jadwal/absensi,piket,keluargawaiver,kenaikan,ijazah,poin/SoTM | BELUM DIJALANKAN |
| U27–29 | Ekspor,outbox/scheduler,migrasi,recoverydanrestore | BELUM DIJALANKAN |

Ketiga kebijakan utama Tahap 2 sudah ditetapkan. D10 masih perlu diselesaikan sebelum fitur perubahan KKM/arsip rapor dinyatakan final; hal itu tidak menghalangi fondasi proyek. Tidak ada persetujuan yang disimpulkan dari diam atau lewatwaktu. Tahap 3fondasiproyek dapat berjalan setelah pengguna memerintahkannya; fitur yang bergantung keputusan tetap ditandai sampai jelas.

## 14. Catatan perubahan dari Tahap 1

- Menambahkan perhitungan tunai diterima yang benar-benar ada di templateslip (nominal−fee), serta mencatat backend tidak membawa togglefeeterstruktur.
- Menjabarkan pilihanrumus,fee,requiredesai dengan contohangka, tanpa mengubahDxx menjadi disepakati pada rancangan 0.9; pada versi 1.0 ini D01–D03 sudah disepakati sesuai catatan keputusan di bawah.
- MenemukanD10 pembaruanKKMhistoris; tidak membuat klaim bahwa baseline sudah menggunakan snapshotimmutable.
- Tidak mengubah matriksTahap 1 atau dokumendasar; keputusanpengguna nantinya diterapkan melalui versiberikutnya dengan tautanIDfitur.

## 15. Catatan keputusan pengguna — 19 Oktober 2026, 12.51 WIB

| ID | Jawaban eksplisit pengguna | Kebijakan aktif |
|---|---|---|
| D01 | Selalu PH 20%, ATS 30%, ASAS 50%; Praktik ditampilkan terpisah | RAPOR-1.0: bobot tetap 20/30/50 untuk semua kondisi Praktik |
| D02 | Ke ribuan terdekat: fee Rp1.230 menjadi Rp1.000 | FEE-1.0: nearest thousand, half-up untuk nominal nonnegatif; bukan ceil |
| D03 | Wajib sesuai daftar backend lama; validasi langkah dan submit disamakan | SURVEI-REQUIRED-1.0: daftar wajib backend; PTS-7 opsional |

Daftar esai wajib: semua responden sasaran A7-1,A7-2,A7-3 dan dua esai B sesuai role (BS-11/12, BG-11/12, BOT-11/12). Siswa juga wajib esai kelima tiap delapan mapel rotasi dan esai keempat untuk UPB,RHS,SNM,MSP. Esai PTS-7 pada penilaian teman sejawat opsional. Pertanyaan survei mikro mengikuti instrumennya sendiri.

Perubahan keputusan berikutnya harus menaikkan versi kebijakan dan menambahkan catatan perubahan; tidak menimpa arsip tanpa proses koreksi. Pilihan pengguna tidak berarti pengujian aplikasi sudah dilaksanakan. D04–D10 tetap mengikuti status masing-masing; tidak ada persetujuan tambahan yang diada-adakan.
