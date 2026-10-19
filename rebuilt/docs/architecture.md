# Arsitektur fondasi

Tahap 3 bootstrap framework; Tahap 4 menambahkan fondasi schema dan SDK Supabase. src/app untuk routing dan composition; src/components/ui untuk komponen shadcn yang dimiliki proyek; src/config untuk metadata/kebijakan yang telah disepakati; src/lib untuk kontrak dan validasi umum; src/modules untuk domain yang diimplementasikan bertahap.

Service domain tidak mengimpor UI. Repository akan menangani persistence Supabase; izin server/RLS wajib pada tahap integrasinya. Jangan membuat repository palsu yang diam-diam memakai array in-memory.

17 domain pada registry adalah indeks pengerjaan, bukan modul yang sudah berjalan. Halaman beranda/foundation saat ini adalah halaman pengembangan; bukan dashboard operasional, login, atau role switcher. Sebelum produksi operasional, route-status dapat dipindah/dihapus sesuai kebutuhan.

SDK/client factory dan migration/schema awal sudah disiapkan serta diuji secara terisolasi. Koneksi cloud, Auth runtime, izin scoped, secrets dan deployment belum dikonfigurasi. Build harus bisa dilakukan tanpa akun layanan eksternal. /api/health adalah liveness proses, bukan cek koneksi database.

Tanggal bisnis Asia/Jakarta; uang integer rupiah atau decimal eksak. RLS dan sesi tidak diturunkan dari user-editable metadata. Aturan ini menjadi kontrak tahapan berikut, belum merupakan implementasi database.
