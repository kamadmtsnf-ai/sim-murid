import { createRoot } from "react-dom/client";
import { BiodataPanel } from "../../src/app/account/biodata/biodata-panel";
import Loading from "../../src/app/account/biodata/loading";
import ErrorPage from "../../src/app/account/biodata/error";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import {
  emptyBiodata,
  type StudentSnapshot,
} from "../../src/lib/student/validation";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const params = new URLSearchParams(location.search);
const student: StudentSnapshot = {
  id: id(3),
  name: "SiswaDenganNamaPanjangTanpaSpasi".repeat(6),
  username: "0012",
  revision: 2,
  can_write: !params.has("readonly"),
  data: { ...emptyBiodata(), NIK: "0012345678901234", JumlahSaudara: "0" },
  progress: {
    percent: 3,
    complete: false,
    missing: ["Email"],
    missingDocuments: ["KK", "AKTA", "IJAZAH_MI"],
  },
};
const documents = params.has("empty")
  ? []
  : Array.from({ length: params.has("many") ? 60 : 3 }, (_, i) => ({
      id: id(i + 10),
      kind: i === 0 ? "KK" : i === 1 ? "KIP" : "BPJS",
      filename:
        "NamaBerkasSangatPanjangTanpaSpasi".repeat(6) +
        (i === 0 ? ".pdf" : ".png"),
      mime: i === 0 ? "application/pdf" : "image/png",
      size: 1000,
      state: i === 2 ? "pending" : "ready",
      created_at: "2026-10-23T00:00:00Z",
    }));
Object.assign(window, {
  biodataFixture: { student, documents },
  storageUploads: [],
  storageError: false,
});
createRoot(document.getElementById("root")!).render(
  <WorkspaceShell
    name="Akun uji"
    username="qa-biodata"
    navigation={navigationFor([], false)}
  >
    {params.has("loading") ? (
      <Loading />
    ) : params.has("error") ? (
      <ErrorPage
        error={Error("private detail")}
        reset={() => {
          document.documentElement.dataset.retried = "true";
        }}
      />
    ) : (
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full min-w-0 max-w-5xl px-4 py-6 sm:px-6"
      >
        <BiodataPanel initial={student} initialDocuments={documents} />
      </main>
    )}
  </WorkspaceShell>,
);
