export default function ProfileLoading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      aria-busy="true"
      className="mx-auto w-full min-w-0 max-w-3xl space-y-5 px-4 py-6"
    >
      <h1 className="text-2xl font-semibold">Profil pribadi</h1>
      <p role="status" className="text-sm text-muted-foreground">
        Memuat profil pribadi…
      </p>
      <div className="skeleton h-24 w-full" />
      <div className="skeleton h-96 w-full" />
    </main>
  );
}
