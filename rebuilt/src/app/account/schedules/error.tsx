"use client";
import AccountError from "../error";
export default function SchedulesError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="schedules-panel">
      <AccountError
        {...props}
        title="Jadwal dan piket siswa belum dapat dimuat"
      />
    </div>
  );
}
