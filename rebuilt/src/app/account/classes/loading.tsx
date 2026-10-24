import { LoadingState } from "@/components/ui/content-state";
export default function Loading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      aria-busy="true"
      className="classes-panel space-y-6"
    >
      <h1 className="text-3xl font-semibold">Kelas dan siswa</h1>
      <LoadingState>Memuat kelas dan siswa…</LoadingState>
    </main>
  );
}
