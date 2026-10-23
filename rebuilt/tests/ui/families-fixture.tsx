import { createRoot } from "react-dom/client";
import { FamilyPanel } from "../../src/app/account/families/family-panel";
import { familySnapshot } from "../../src/lib/education/validation";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const empty = new URLSearchParams(location.search).has("empty");
const students = Array.from({ length: 45 }, (_, i) => ({
  id: id(10 + i),
  name: i === 0 ? "SiswaDenganNamaPanjangTanpaSpasi".repeat(5) : "Siswa " + i,
  username: "00" + i,
}));
const data = familySnapshot.parse({
  revision: 0,
  students: empty ? [] : students,
  parents: empty
    ? []
    : [{ id: id(200), name: "Orang Tua", username: "ortu-1" }],
  references: empty
    ? []
    : [{ id: id(999), name: "Anggota Nonaktif", username: "old-001" }],
  guardians: empty
    ? []
    : Array.from({ length: 25 }, (_, i) => ({
        id: id(300 + i),
        student_id: id(10 + i),
        parent_id: id(200),
        relationship: "father",
      })),
  families: empty
    ? []
    : Array.from({ length: 25 }, (_, i) => ({
        id: id(400 + i),
        name: "Grup " + i,
        members:
          i === 0
            ? [
                { student_id: id(999), legacy_order: 1 },
                { student_id: id(10), legacy_order: 2 },
              ]
            : [{ student_id: id(10 + i), legacy_order: i + 2 }],
      })),
});
Object.assign(window, { familiesFixture: data });
createRoot(document.getElementById("root")!).render(
  <main
    id="main-content"
    className="mx-auto min-w-0 max-w-5xl space-y-6 px-4 py-6 sm:px-6"
  >
    <h1 className="text-3xl font-semibold">Relasi keluarga</h1>
    <FamilyPanel initial={data} />
  </main>,
);
