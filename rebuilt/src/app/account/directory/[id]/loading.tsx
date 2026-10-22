export default function DirectoryDetailLoading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="directory-detail space-y-6"
      aria-busy="true"
    >
      <h1 className="text-2xl font-semibold">Memuat detail pengguna</h1>
      <p role="status">Menyiapkan informasi pengguna sesuai hak akses Anda…</p>
      <div aria-hidden="true" className="directory-detail-grid">
        {[0, 1, 2].map((n) => (
          <div key={n} className="skeleton h-32" />
        ))}
      </div>
    </main>
  );
}
