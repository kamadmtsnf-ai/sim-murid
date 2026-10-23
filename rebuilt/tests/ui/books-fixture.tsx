/** Actual catalog and shell, with synthetic records and isolated service boundaries. */
import { createRoot } from "react-dom/client";
import { BooksPanel } from "../../src/app/account/learning/[module]/books-panel";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import { booksSnapshot } from "../../src/lib/learning/books";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const mode = new URLSearchParams(location.search).get("mode");
const data = booksSnapshot.parse({
  module: "books",
  revision: 1,
  today: "2026-10-23",
  isAdmin: mode !== "readonly",
  canWrite: mode !== "readonly",
  semester: 1,
  classes: [],
  people: [],
  rows:
    mode === "empty"
      ? []
      : Array.from({ length: mode === "large" ? 50 : 3 }, (_, i) => ({
          id: id(10 + i),
          title:
            i === 2
              ? "JudulTanpaSpasi".repeat(22).slice(0, 300)
              : "Buku " + (i + 1),
          author: "Guru",
          publisher: "Madrasah",
          publication_year: 2026,
          version: "1",
          category: "Pelajaran",
          subject_id: id(70),
          level: 7,
          external_url:
            i === 1
              ? "https://drive.google.com/file/d/example123/view"
              : i === 2
                ? null
                : "https://example.org/old.pdf",
          premium: i === 1,
          active: true,
          assets: i === 0 ? [{ id: id(80), filename: "buku.pdf" }] : [],
        })),
  extra: {
    subjects: [{ id: id(70), name: "Matematika" }],
    total: mode === "large" ? 101 : mode === "empty" ? 0 : 3,
    page: 1,
  },
});
Object.assign(window, {
  booksFixture: data,
  storageUploads: [],
  storageError: false,
});
createRoot(document.getElementById("root")!).render(
  <WorkspaceShell
    navigation={navigationFor(["books.read"], data.isAdmin)}
    name="Petugas uji"
    username="qa-books"
  >
    <main id="main-content" className="mx-auto min-w-0 max-w-7xl space-y-6 p-6">
      <h1 className="text-3xl font-semibold">Buku digital</h1>
      <BooksPanel initial={data} />
    </main>
  </WorkspaceShell>,
);
