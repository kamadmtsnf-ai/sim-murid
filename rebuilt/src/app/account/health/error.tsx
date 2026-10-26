"use client";
import AccountError from "../error";
export default function HealthError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <AccountError {...props} title="Kesehatan aplikasi belum dapat dimuat" />;
}
