import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { z } from "zod";
import { useDomainMutation } from "../../src/lib/education/use-mutation";
import { listenForUnsavedChanges } from "../../src/lib/forms/leave-guard";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import { ProfileForm } from "../../src/app/account/profile/profile-form";
import { Button } from "../../src/components/ui/button";
import { MutationFeedback } from "../../src/components/feedback/mutation-feedback";
const snapshot = z.object({
    revision: z.number().int().nonnegative(),
    label: z.string(),
  }),
  command = z.object({ label: z.string().min(1) });
function Probe() {
  const [value, setValue] = useState("data-uji"),
    [saved, setSaved] = useState("awal"),
    [revision, setRevision] = useState(1),
    [inspected, setInspected] = useState("");
  const { busy, message, phase, blocked, feedbackRef, hint, fail, clear, mutate } =
    useDomainMutation(
      "/qa/mutation",
      snapshot,
      "classes",
      (next) => {
        setSaved(next.label);
        setValue(next.label);
        setRevision(next.revision);
        Object.assign(window, {
          formsSaved:
            Number(
              (window as unknown as { formsSaved?: number }).formsSaved ?? 0,
            ) + 1,
        });
      },
      { confirmed: true, commandSchema: command },
    );
  useEffect(
    () =>
      listenForUnsavedChanges((e) => {
        if (value !== saved) e.preventDefault();
      }),
    [value, saved],
  );
  useEffect(() => {
    Object.assign(window, {
      forceFormsSave: () => mutate(revision, { label: value }),
    });
  }, [mutate, revision, value]);
  return (
    <section className="space-y-4" aria-label="Probe transport formulir">
      <label htmlFor="probe-value">Isian uji</label>
      <input
        id="probe-value"
        className="ds-field-control"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <p>
        Fase: <span id="probe-phase">{phase}</span>
      </p>
      <p id="probe-saved">Data terkonfirmasi: {saved}</p>
      {message && (
        <MutationFeedback ref={feedbackRef} tabIndex={-1} phase={phase} hint={hint}>
          {message}
        </MutationFeedback>
      )}
      <div className="ds-actions">
        <Button
          disabled={busy || blocked}
          onClick={() => void mutate(revision, { label: value })}
        >
          Simpan isian uji
        </Button>
        <Button variant="outline" onClick={() => fail("validasi tambahan")}>
          Ubah pesan validasi
        </Button>
        <Button variant="outline" onClick={clear}>
          Bersihkan pesan
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            void fetch("/qa/mutation")
              .then((r) => r.json())
              .then((v) => setInspected(v.label))
          }
        >
          Periksa data tersimpan
        </Button>
      </div>
      <p id="probe-inspected">{inspected}</p>
    </section>
  );
}
function Fixture() {
  const [show, setShow] = useState(true);
  return (
    <WorkspaceShell
      username="qa-forms"
      name="Pengguna uji"
      navigation={navigationFor([], true)}
    >
      <main id="main-content" className="min-w-0 space-y-6">
        <h1 className="text-2xl font-semibold">Keandalan formulir</h1>
        {location.search.includes("profile") ? (
          <ProfileForm
            initialProfile={{
              username: "001-user",
              full_name: "Nama awal",
              phone: "",
              contact_email: "",
              bio: "",
              updated_at: "2026-10-24T01:00:00.123456+00:00",
            }}
          />
        ) : show ? (
          <Probe />
        ) : (
          <p>Probe dilepas</p>
        )}
        <Button variant="outline" onClick={() => setShow(false)}>
          Lepas probe
        </Button>
      </main>
    </WorkspaceShell>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
