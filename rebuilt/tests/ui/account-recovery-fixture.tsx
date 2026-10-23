import { createRoot } from "react-dom/client";
import { RecoveryPanel } from "../../src/app/account/recovery/recovery-panel";
import type { RecoveryList } from "../../src/lib/auth/recovery-validation";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const params = new URLSearchParams(location.search);
const items: RecoveryList = params.has("empty")
  ? []
  : Array.from({ length: 25 }, (_, i) => ({
      id: id(i + 1),
      username: "student-" + (i + 1),
      full_name:
        i === 0 ? "NamaPanjangTanpaSpasi".repeat(8) : "Pengguna " + (i + 1),
      request_type: i % 2 === 0 ? "password" : "session",
      status: i === 2 ? "verified" : "pending",
      requested_at: new Date(Date.now() - 3600000).toISOString(),
      expires_at: new Date(
        Date.now() + (params.has("expired") && i === 0 ? -1000 : 3600000),
      ).toISOString(),
      security_answer_verified: i % 2 === 0,
      self_request: i === 24,
    }));
Object.assign(window, { recoveryFixture: items });
createRoot(document.getElementById("root")!).render(
  <main
    id="main-content"
    className="mx-auto min-w-0 max-w-5xl space-y-6 px-4 py-6 sm:px-6"
  >
    <h1 className="text-3xl font-semibold">Pemulihan akun</h1>
    <RecoveryPanel initialRequests={items} />
  </main>,
);
