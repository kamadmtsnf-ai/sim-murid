"use client";
import AccountError from "../error";
export default function ClassesError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="classes-panel">
      <AccountError {...props} title="Kelas dan siswa belum dapat dimuat" />
    </div>
  );
}
