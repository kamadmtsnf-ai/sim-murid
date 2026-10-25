import { createRoot } from "react-dom/client";
import { useState } from "react";
import { ContextualHelp } from "../../src/components/help/contextual-help";
function Fixture() {
  const [href, setHref] = useState("/account/learning/reports");
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <h1>Bantuan pengguna</h1>
      <button
        type="button"
        onClick={() => setHref("/account/operations/savings")}
      >
        Ganti konteks
      </button>
      <ContextualHelp
        key={href}
        href={href}
        label={href.endsWith("reports") ? "Rapor" : "Tabungan"}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
