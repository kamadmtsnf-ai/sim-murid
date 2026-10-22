import { RecoveryShell } from "./recovery-shell";
export default function Loading() {
  return (
    <RecoveryShell
      title="Bantuan akun"
      description="Menyiapkan formulir bantuan akun."
    >
      <div
        role="status"
        aria-busy="true"
        aria-label="Memuat formulir bantuan akun"
      >
        <div aria-hidden="true" className="grid gap-5">
          <div className="skeleton h-11" />
          <div className="skeleton h-11" />
          <div className="skeleton h-11" />
        </div>
        <span className="sr-only">Memuat formulir bantuan akun…</span>
      </div>
    </RecoveryShell>
  );
}
