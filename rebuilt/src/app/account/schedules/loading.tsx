import { LoadingState } from "@/components/ui/content-state";
export default function Loading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      aria-busy="true"
      className="schedules-panel space-y-6"
    >
      <h1 className="text-3xl font-semibold">Jadwal dan piket siswa</h1>
      <LoadingState>Memuat jadwal dan piket siswa…</LoadingState>
    </main>
  );
}
