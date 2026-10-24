import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { AccountDashboard } from "../../src/components/account-dashboard";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import { overviewFixture } from "../fixtures/overview";
import type { Overview } from "../../src/lib/dashboard/overview";
function Fixture() {
  const q = new URLSearchParams(location.search),
    role = (q.get("role") ?? "teacher") as NonNullable<Overview["role"]>,
    mode = q.get("mode") ?? "normal";
  const [overview, setOverview] = useState(() => overviewFixture(role, mode)),
    [show, setShow] = useState(true);
  useEffect(() => {
    Object.assign(window, {
      overviewFixture: overview,
      replaceOverview: (next: Overview) => setOverview(next),
      unmountOverview: () => setShow(false),
    });
  }, [overview]);
  return (
    <WorkspaceShell
      navigation={navigationFor(
        [
          "references.read",
          "attendance.read",
          "mentoring.read",
          "fees.read",
          "savings.read",
          "notifications.read",
        ],
        role === "admin",
      )}
      name="Akun pengujian"
      username="qa-overview"
    >
      {show ? (
        <AccountDashboard
          name="Akun pengujian"
          expiresAt="2026-12-31T10:00:00Z"
          overview={overview}
        />
      ) : (
        <main id="main-content">
          <h1>Ringkasan dilepas</h1>
        </main>
      )}
    </WorkspaceShell>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
