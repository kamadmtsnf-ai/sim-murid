import { createRoot } from "react-dom/client";
import { useState } from "react";
import {
  Field,
  fieldControlClass,
  fieldDescriptionIds,
} from "../../src/components/ui/field";
import {
  FilterBar,
  Pagination,
} from "../../src/components/ui/collection-controls";
import {
  EmptyState,
  LoadingState,
} from "../../src/components/ui/content-state";
import { Status } from "../../src/components/ui/status";
import { Dialog } from "../../src/components/ui/dialog";
import { TableRegion } from "../../src/components/ui/data-table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../src/components/ui/card";
import { Button } from "../../src/components/ui/button";
function Fixture() {
  const [page, setPage] = useState(1),
    [open, setOpen] = useState(false),
    [value, setValue] = useState(""),
    [error, setError] = useState("");
  const hint = "Gunakan nama yang mudah dikenali.";
  return (
    <main
      id="main-content"
      className="mx-auto min-w-0 max-w-4xl space-y-6 p-4 sm:p-6"
    >
      <h1 className="text-2xl font-semibold">Komponen bersama SiM-Murid</h1>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Filter dan formulir</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              setError(value.trim() ? "" : "Nama wajib diisi.");
            }}
            className="space-y-4"
          >
            <FilterBar label="Filter contoh">
              <Field
                id="sample-name"
                label="Nama"
                required
                description={hint}
                error={error}
              >
                <input
                  id="sample-name"
                  required
                  className={fieldControlClass}
                  value={value}
                  aria-invalid={!!error}
                  aria-describedby={fieldDescriptionIds(
                    "sample-name",
                    hint,
                    error,
                  )}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setError("");
                  }}
                />
              </Field>
              <Field id="sample-scope" label="Cakupan">
                <select id="sample-scope" className={fieldControlClass}>
                  <option>Semua cakupan</option>
                  <option>Kelas {"panjang".repeat(40)}</option>
                </select>
              </Field>
            </FilterBar>
            <div className="ds-actions">
              <Button type="submit">Periksa isian</Button>
              <Button type="button" variant="outline" disabled>
                Tindakan dinonaktifkan
              </Button>
              <Button type="button" variant="outline">
                {"Tombol panjang ".repeat(10)}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <section className="space-y-3" aria-labelledby="feedback-title">
        <h2 id="feedback-title" className="font-semibold">
          Umpan balik
        </h2>
        <Status>Informasi layanan.</Status>
        <Status tone="pending">Memeriksa data…</Status>
        <Status tone="success">Data tersimpan.</Status>
        <Status tone="warning">
          Hasil belum terkonfirmasi. Periksa status sebelum mengirim ulang.
        </Status>
        <Status tone="error">Data belum dapat dimuat.</Status>
      </section>
      <EmptyState title="Tidak ada data yang cocok">
        <p>Ubah pencarian atau reset filter untuk melihat data lainnya.</p>
      </EmptyState>
      <LoadingState>Memuat daftar…</LoadingState>
      <section aria-labelledby="table-title" className="space-y-3">
        <h2 id="table-title" className="font-semibold">
          Tabel responsif
        </h2>
        <TableRegion label="Contoh tabel jadwal">
          <table>
            <caption className="sr-only">Contoh tabel jadwal</caption>
            <thead>
              <tr>
                {["Hari", "Kelas", "Mata pelajaran", "Guru", "Ruang"].map(
                  (x) => (
                    <th scope="col" key={x}>
                      {x}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>
                  <th scope="row">Senin {i + 1}</th>
                  <td>7 A</td>
                  <td>Ilmu Pengetahuan Sosial</td>
                  <td>Guru uji</td>
                  <td>Ruang belajar</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      </section>
      <Pagination
        label="Halaman contoh"
        page={page}
        pageCount={3}
        onPageChange={setPage}
      />
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={"Rincian jadwal ".repeat(8)}
        description="Periksa informasi sebelum menutup dialog."
        trigger={<Button type="button">Buka rincian</Button>}
      >
        <div className="space-y-4">
          <Field id="dialog-note" label="Catatan">
            <textarea id="dialog-note" className={fieldControlClass} rows={8} />
          </Field>
          <p>{"Keterangan panjang ".repeat(120)}</p>
          <div className="ds-actions">
            <Button type="button" onClick={() => setOpen(false)}>
              Selesai
            </Button>
          </div>
        </div>
      </Dialog>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
