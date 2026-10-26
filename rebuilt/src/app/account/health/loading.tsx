import { Status } from "@/components/ui/status";
export default function HealthLoading() {
  return <main id="main-content" className="mx-auto max-w-7xl space-y-6 p-6" aria-busy="true"><h1 className="text-3xl font-semibold">Kesehatan aplikasi</h1><Status tone="pending" heading="Memeriksa sumber operasional">Menunggu hasil baca. Data yang belum diterima tidak dianggap sehat.</Status></main>;
}
