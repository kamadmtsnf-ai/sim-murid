import { createRoot } from "react-dom/client";
import { useState } from "react";
import AccountError from "../../src/app/account/error";
import RootError from "../../src/app/error";
function Fixture() {
  const [count, setCount] = useState(0),
    q = new URLSearchParams(location.search),
    error = Object.assign(new Error("PRIVATE_PASSWORD_TOKEN_EMAIL"), {
      digest: q.get("bad")
        ? "PRIVATE_PASSWORD_TOKEN_EMAIL"
        : "12345678901234567890",
    }),
    View = q.has("root") ? RootError : AccountError;
  return (
    <>
      <View error={error} reset={() => setCount((n) => n + 1)} />
      <p role="status">Percobaan ulang: {count}</p>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
