import { useState } from "react";
import { createRoot } from "react-dom/client";
import Loading from "../../src/app/recovery/loading";
import { RecoveryForm } from "../../src/app/recovery/recovery-form";
import { EmailRecoveryForm } from "../../src/app/recovery/email/recovery-form";
function Fixture() {
  const [show, setShow] = useState(true);
  if (location.search.includes("view=loading")) return <Loading />;
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-lg p-4">
      <h1 className="text-2xl font-semibold mb-6">Bantuan akun</h1>
      {show ? (
        location.search.includes("email") ? (
          <EmailRecoveryForm />
        ) : (
          <RecoveryForm />
        )
      ) : (
        <p>Form ditutup.</p>
      )}
      <button
        type="button"
        className="mt-6 min-h-11"
        onClick={() => setShow(false)}
      >
        Tutup formulir uji
      </button>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
