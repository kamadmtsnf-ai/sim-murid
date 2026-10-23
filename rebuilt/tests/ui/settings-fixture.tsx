import { createRoot } from "react-dom/client";
import { SettingsPanel } from "../../src/app/account/settings/settings-panel";
import {
  emptySchool,
  type SettingsSnapshot,
} from "../../src/lib/settings/validation";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const empty = new URLSearchParams(location.search).has("empty");
const data: SettingsSnapshot = {
  revision: 0,
  school: empty
    ? null
    : {
        ...structuredClone(emptySchool),
        id: id(1),
        name: "MTs Uji Responsif",
        asset_data: {},
        updated_at: "2026-10-23",
        identity_data: { ...emptySchool.identity_data, npsn: "00001" },
      },
  subjects: empty
    ? []
    : Array.from({ length: 25 }, (_, i) => ({
        id: id(10 + i),
        code: "MP" + i,
        name:
          i === 0
            ? "MataPelajaranDenganNamaSangatPanjangTanpaSpasi".repeat(3)
            : "Mata pelajaran " + i,
        active: i !== 24,
        sort_order: i,
      })),
  memorization: [],
  holidays: empty
    ? []
    : Array.from({ length: 25 }, (_, i) => ({
        id: id(100 + i),
        holiday_date: `2026-10-${String(i + 1).padStart(2, "0")}`,
        description:
          i === 0
            ? "KeteranganPanjangTanpaSpasi".repeat(15)
            : "Hari libur " + i,
      })),
};
Object.assign(window, { settingsFixture: data });
createRoot(document.getElementById("root")!).render(
  <main
    id="main-content"
    className="mx-auto min-w-0 max-w-5xl space-y-6 px-4 py-6 sm:px-6"
  >
    <h1 className="text-3xl font-semibold">Pengaturan madrasah</h1>
    <SettingsPanel initial={data} assetBase="https://assets.example.invalid/" />
  </main>,
);
