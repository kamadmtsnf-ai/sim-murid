/** Actual panel/shell; synthetic records and HTTP/Storage boundaries only. */
import { createRoot } from "react-dom/client";
import { PromotionsPanel } from "../../src/app/account/learning/[module]/promotions-panel";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import { promotionsSnapshot } from "../../src/lib/learning/promotions";
import { diplomaFields } from "../../src/lib/learning/validation";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const mode = new URLSearchParams(location.search).get("mode") ?? "normal";
const classes = [
  {
    id: id(30),
    name: "7A",
    year: 2026,
    academic_year_id: id(70),
    level: 7,
    archived_at: null,
  },
  {
    id: id(31),
    name: "8A",
    year: 2027,
    academic_year_id: id(71),
    level: 8,
    archived_at: null,
  },
  {
    id: id(32),
    name: "9A",
    year: 2026,
    academic_year_id: id(70),
    level: 9,
    archived_at: null,
  },
  {
    id: id(33),
    name: "7 Lama",
    year: 2025,
    academic_year_id: id(72),
    level: 7,
    archived_at: null,
  },
  {
    id: id(34),
    name: "7 Baru",
    year: 2027,
    academic_year_id: id(71),
    level: 7,
    archived_at: null,
  },
  {
    id: id(35),
    name: "8 Arsip",
    year: 2027,
    academic_year_id: id(71),
    level: 8,
    archived_at: "2026-10-01",
  },
];
const rows = Array.from(
  { length: mode === "empty" ? 0 : mode === "large" ? 70 : 8 },
  (_, i) => {
    const role =
        i === 2
          ? "applicant"
          : (i >= 3 && i <= 5) || (mode === "large" && i >= 40)
            ? "alumni"
            : "student",
      alumni = role === "alumni";
    return {
      student_id: id(100 + i),
      name: i === 6 ? "NamaTanpaSpasi".repeat(20) : "Pengguna " + (i + 1),
      role,
      class_id:
        alumni || role === "applicant"
          ? null
          : id(i === 1 ? 32 : i === 7 ? 33 : 30),
      diploma: alumni
        ? {
            metadata: Object.fromEntries(
              diplomaFields.map((k) => [
                k,
                k === "nomor_ijazah"
                  ? "IJAZAH-" + (i + 1)
                  : k === "nilai_rata_rata"
                    ? "0"
                    : "",
              ]),
            ),
            view_override: "deny",
            download_override: "deny",
          }
        : null,
      canView: i !== 5,
      canDownload: i !== 4,
      assets:
        alumni && i !== 5
          ? [
              {
                id: id(500 + i),
                slot: "IJAZAH",
                filename:
                  "Dokumen " + (i + 1) + " " + "panjang".repeat(10) + ".pdf",
                mime: "application/pdf",
              },
            ]
          : [],
    };
  },
);
const data = promotionsSnapshot.parse({
  module: "promotions",
  revision: 1,
  today: "2026-10-23",
  isAdmin: mode !== "readonly",
  canWrite: mode !== "readonly",
  semester: 1,
  classes,
  people: [],
  rows:
    mode === "readonly" ? rows.filter((r) => r.student_id === id(105)) : rows,
  extra: {
    years: [
      { id: id(71), start_year: 2027 },
      { id: id(70), start_year: 2026 },
      { id: id(72), start_year: 2025 },
    ],
    access: { allow_view: false, allow_download: true },
  },
});
Object.assign(window, {
  promotionsFixture: data,
  storageUploads: [],
  storageError: false,
});
createRoot(document.getElementById("root")!).render(
  <WorkspaceShell
    navigation={navigationFor(
      ["graduation.manage", "certificates.read"],
      data.isAdmin,
    )}
    name="Petugas uji"
    username="qa-promotions"
  >
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto min-w-0 max-w-7xl space-y-6 p-6"
    >
      <h1 className="text-3xl font-semibold">Kenaikan dan ijazah</h1>
      <PromotionsPanel initial={data} />
    </main>
  </WorkspaceShell>,
);
