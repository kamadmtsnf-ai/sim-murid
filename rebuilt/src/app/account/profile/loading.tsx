import { LoadingState } from "@/components/ui/content-state";
export default function Loading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      aria-busy="true"
      className="mx-auto w-full min-w-0 max-w-3xl space-y-5 px-4 py-6"
    >
      <h1 className="text-2xl font-semibold">Profil pribadi</h1>
      <LoadingState>Memuat profil pribadi…</LoadingState>
    </main>
  );
}
