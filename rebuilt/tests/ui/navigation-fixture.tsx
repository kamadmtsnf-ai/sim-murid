import { createRoot } from "react-dom/client";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import { TextField, SelectField } from "../../src/components/domain-controls";
const params = new URLSearchParams(location.search);
const role = params.get("role") ?? "admin",
  mode = params.get("mode") ?? "normal";
const caps: Record<string, string[]> = {
  teacher: [
    "references.read",
    "attendance.read",
    "mentoring.read",
    "grades.read",
    "books.read",
    "surveys.read",
  ],
  student: ["references.read", "grades.read", "books.read", "surveys.read"],
  parent: ["profiles.read", "references.read", "grades.read"],
  alumni: ["certificates.read"],
  customer: ["savings.read"],
  applicant: [],
};
createRoot(document.getElementById("root")!).render(
  <WorkspaceShell
    navigation={
      mode === "empty" ? [] : navigationFor(caps[role] ?? [], role === "admin")
    }
    navigationUnavailable={mode === "unavailable"}
    name={
      mode === "emoji"
        ? "👩‍🏫 Guru contoh"
        : mode === "blank-name"
          ? ""
          : "Nama pengguna ".repeat(12)
    }
    username="qa-navigation"
  >
    <main id="main-content" className="space-y-6">
      <h1>Navigasi layanan madrasah</h1>
      {mode === "short" ? (
        <p>Konten singkat.</p>
      ) : (
        <>
          <form
            className="grid min-w-0 gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              Object.assign(window, {
                submitted: Object.fromEntries(new FormData(e.currentTarget)),
              });
            }}
          >
            <TextField
              name="name"
              label="Nama lengkap"
              required
              value="Nama awal"
            />
            <SelectField name="classId" label="Kelas" value="001">
              <option value="001">Kelas 001</option>
            </SelectField>
            <button className="ds-field-control" type="submit">
              Simpan contoh
            </button>
          </form>
          {mode === "long" && (
            <p style={{ minHeight: 1800 }}>Akhir konten panjang.</p>
          )}
        </>
      )}
    </main>
  </WorkspaceShell>,
);
