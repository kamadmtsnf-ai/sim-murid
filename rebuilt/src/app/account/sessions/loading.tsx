export default function SessionsLoading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      aria-busy="true"
      className="mx-auto w-full min-w-0 max-w-2xl space-y-5 px-4 py-6"
    >
      <h1 className="text-2xl font-semibold">Sesi dan perangkat</h1>
      <p role="status" className="text-sm text-muted-foreground">
        Memuat daftar sesi dan perangkat…
      </p>
      <div className="skeleton h-64 w-full" />
    </main>
  );
}
