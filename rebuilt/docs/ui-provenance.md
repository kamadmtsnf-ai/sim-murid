# shadcn/ui component provenance

Button, Card, Badge diambil dari repository resmi shadcn-ui/ui, apps/v4/registry/new-york-v4/ui pada 19 Oktober 2026 melalui sumber GitHub. Import cn disesuaikan menjadi @/lib/utils; styling tokens disesuaikan untuk fondasi SiM-Murid. Lisensi upstream disertakan pada docs/licenses.

CLI shadcn tidak selesai merespons dalam sesi ini; komponen dipasang melalui jalur manual yang didokumentasikan resmi, bukan dianggap berhasil lewat CLI. components.json tersedia untuk penambahan komponen berikutnya. Dependensi Radix, CVA, clsx, tailwind-merge telah dipin melalui npm.

Sumber: https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/new-york-v4/ui
Dokumentasi: https://ui.shadcn.com/docs/installation/manual

## Adaptasi enterprise UI, 21 Oktober 2026

Master design system ada pada [design-system/MASTER.md](design-system/MASTER.md). UI UX Pro Max dari upstream dipakai sebagai sumber rekomendasi dan dicatat dengan commit serta hasil pencarian aktual. daisyUI dipakai sebagai referensi warna semantik; tidak diinstal. Komponen baru memakai Radix yang sudah tersedia, Tailwind, dan Lucide existing. Lisensi sumber rekomendasi ada pada licenses/ui-ux-pro-max-LICENSE.txt.

## Referensi plass-ui

Adaptasi berdasarkan jooy2/plass-ui pada commit7f7a86c39931ca7b58d55c8c0f70897ea9359c7e: bahasan material, warna, sidebar, kontrol dan dashboard. Tidak menginstal dependensi plass-ui, tidak memindahkan stack. Lisensi referensi ada pada licenses/plass-ui-LICENSE.txt. Master Design System mencatat pemetaan dan penyederhanaan untuk administrasi madrasah.
