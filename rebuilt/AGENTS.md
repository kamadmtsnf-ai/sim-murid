# Rebuilt SiM-Murid

- Stack wajib Next.js App Router + TypeScript strict + Tailwind CSS + shadcn/ui + Zod + Supabase. Hosting target Vercel.
- Baca docs/specifications dan docs/decisions sebelum mengubah perilaku bisnis. Jangan push atau deploy tanpa lingkup tahap yang memerintahkannya.
- Kebijakan final: PH20/ATS30/ASAS50; Praktik terpisah. Fee ribuan terdekat half-up. Esai wajib sesuai backend lama; esai peer opsional.
- D10 RAPOR-REVISION-1.0 disepakati: arsip immutable; koreksi membuat versi baru dengan alasan, penerbit, waktu dan audit. Versi lama tetap dapat diakses sesuai izin. Jangan mengubah hasil arsip diam-diam.
- Jangan mengklaim modul selesai karena halaman tampil; cek UI/API/database/RLS dan efek bisnis.
- Auth dan database baru dikerjakan pada tahap tersendiri. Jangan memakai dummy login atau spreadsheet eksternal sebagai validator.
- Identitas caller dari sesi server, bukan request username. Jangan mengirim secret ke client.
- Service domain dipisahkan dari repository dan UI. Satu rumus dipakai layar dan ekspor.
- npm ci, npm run typecheck, npm run build; cek lint bila TSX diubah. Simpan lockfile dan versi eksak.
- Jangan commit node_modules, .next, .env.local, secret atau data pribadi produksi.
- Jangan membuat route operasional fiktif. Modul yang belum diimplementasikan harus tercatat jujur.
