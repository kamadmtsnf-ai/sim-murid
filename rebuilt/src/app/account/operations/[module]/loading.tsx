import { LoadingState } from "@/components/ui/content-state";
export default function Loading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      aria-busy="true"
      className="mx-auto min-w-0 max-w-7xl space-y-6 p-4 sm:p-6"
    >
      <h1 className="text-3xl font-semibold">Layanan siswa</h1>
      <LoadingState>Memuat layanan siswa…</LoadingState>
    </main>
  );
}
