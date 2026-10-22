"use client";
import AccountError from "../../error";
export default function DirectoryDetailError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="directory-detail">
      <AccountError {...props} title="Detail pengguna belum dapat dimuat" />
    </div>
  );
}
