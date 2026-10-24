export default function AccessLoading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      aria-busy="true"
      className="mx-auto w-full min-w-0 max-w-2xl space-y-5 px-4 py-6"
    >
      <h1 className="text-2xl font-semibold">Hak akses saya</h1>
      <p role="status" className="text-sm text-muted-foreground">
        Memuat hak akses…
      </p>
      <div className="skeleton h-64 w-full" />
    </main>
  );
}
