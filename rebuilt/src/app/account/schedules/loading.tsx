export default function SchedulesLoading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      aria-busy="true"
      className="schedules-panel space-y-6"
    >
      <h1 className="text-3xl font-semibold">Jadwal dan piket siswa</h1>
      <p role="status">Memuat jadwal dan piket siswa…</p>
      <div aria-hidden="true" className="space-y-4">
        {[0, 1, 2].map((n) => (
          <div className="skeleton h-28" key={n} />
        ))}
      </div>
    </main>
  );
}
