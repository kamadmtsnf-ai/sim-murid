/** Synthetic data; actual production components. Never mounted as an application route. */
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { ClassPanel } from "../../src/app/account/classes/class-panel";
import { useDomainMutation } from "../../src/lib/education/use-mutation";
import { classSnapshot } from "../../src/lib/education/validation";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import Loading from "../../src/app/account/classes/loading";
import ErrorView from "../../src/app/account/classes/error";
const scenario =
  new URLSearchParams(location.search).get("scenario") ?? "normal";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const long = scenario === "long",
  many = scenario === "many";
const person = (n: number) => ({
  id: id(n),
  name: long ? "Nama".repeat(80) : `Siswa ${n}`,
  username: `00-${n}`,
});
const initial = classSnapshot.parse({
  revision: 1,
  can_manage: scenario !== "readonly",
  years:
    scenario === "empty"
      ? []
      : [
          { id: id(10), start_year: 2026, is_active: true },
          { id: id(11), start_year: 2025, is_active: false },
        ],
  classes:
    scenario === "empty"
      ? []
      : Array.from({ length: many ? 50 : 4 }, (_, i) => ({
          id: id(20 + i),
          year_id: id(i === 2 ? 11 : 10),
          level: 7,
          name: long ? "Kelas".repeat(80) : `7 ${String.fromCharCode(65 + i)}`,
          teacher_id: i === 0 ? id(91) : null,
          teacher_name: i === 0 ? "Guru sebelumnya" : null,
          archived: i === 3,
          can_schedule: true,
          students:
            i === 0
              ? [
                  {
                    ...person(101),
                    enrollment_id: id(201),
                    starts_on: "2026-01-01",
                    status: "inactive",
                  },
                ]
              : [],
        })),
  teachers: [{ id: id(90), name: "Guru aktif", username: "00-guru" }],
  students: Array.from({ length: many ? 100 : 3 }, (_, i) => person(102 + i)),
});
Object.assign(window, { classesFixture: initial });
function Probe() {
  const { busy, message, mutate } = useDomainMutation(
    "/api/classes",
    classSnapshot,
    "classes",
    () => {
      Object.assign(window, { classesSaved: true });
    },
    { confirmed: scenario !== "legacy" },
  );
  return (
    <>
      <button
        disabled={busy}
        onClick={() => void mutate(1, { type: "year", startYear: 2027 })}
      >
        Simpan probe
      </button>
      <p role="status">{message}</p>
    </>
  );
}
function Fixture() {
  const [show, setShow] = useState(true);
  return (
    <WorkspaceShell
      username="00-admin"
      name="Admin uji kelas"
      navigation={navigationFor(["classes.read"], true)}
    >
      {scenario === "loading" ? (
        <Loading />
      ) : scenario === "error" ? (
        <ErrorView
          error={Error("private diagnostic")}
          reset={() => Object.assign(window, { classesRetried: true })}
        />
      ) : (
        <main id="main-content" tabIndex={-1} className="min-w-0 space-y-6">
          <h1 className="text-3xl font-semibold">Kelas dan siswa</h1>
          {show ? (
            scenario === "probe" || scenario === "legacy" ? (
              <Probe />
            ) : (
              <ClassPanel initial={initial} />
            )
          ) : (
            <p>Panel ditutup</p>
          )}
          <button onClick={() => setShow(false)}>Tutup panel uji</button>
        </main>
      )}
    </WorkspaceShell>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
