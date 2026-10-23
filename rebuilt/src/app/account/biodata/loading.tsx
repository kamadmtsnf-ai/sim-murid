export default function BiodataLoading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      aria-busy="true"
      className="mx-auto w-full min-w-0 max-w-5xl space-y-5 px-4 py-6"
    >
      <h1 className="text-2xl font-semibold">Biodata dan dokumen</h1>
      <p role="status" className="text-sm text-muted-foreground">
        Memuat biodata dan dokumen privat…
      </p>
      <div className="skeleton h-24 w-full" />
      <div className="skeleton h-96 w-full" />
    </main>
  );
}
