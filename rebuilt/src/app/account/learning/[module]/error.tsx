"use client";
import AccountError from "../../error";
export default function ErrorState(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AccountError {...props} title="Akademik belum dapat dimuat" />;
}
