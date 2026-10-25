import { createRoot } from "react-dom/client";
import { useState } from "react";
import { confirmAction } from "../../src/components/ui/confirm-action";
import { Dialog } from "../../src/components/ui/dialog";
import { FormNavigationGuard } from "../../src/components/forms/navigation-guard";
import { useWriteGuard } from "../../src/lib/forms/use-write-guard";
function Fixture() {
  const [count, setCount] = useState(0),
    [open, setOpen] = useState(false),
    [logout, setLogout] = useState(0),
    [nav, setNav] = useState(0);
  useWriteGuard(
    () => false,
    () => true,
  );
  async function remove() {
    if (await confirmAction("Hapus catatan? <img src=x>"))
      setCount((n) => n + 1);
  }
  async function close() {
    if (await confirmAction("Abaikan isian yang belum disimpan?"))
      setOpen(false);
  }
  return (
    <FormNavigationGuard>
      <main className="mx-auto max-w-xl space-y-4 p-4">
        <h1>Konfirmasi tindakan</h1>
        <button onClick={() => void remove()}>Hapus catatan</button>
        <p>Perubahan: {count}</p>
        <button onClick={() => setOpen(true)}>Buka formulir</button>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (!next) void close();
          }}
          title="Formulir uji"
          description="Isian tetap ada saat dibatalkan."
        >
          <label>
            Isian
            <input
              className="block min-h-11 w-full border"
              defaultValue="Draf"
            />
          </label>
          <button onClick={() => void close()}>Tutup formulir</button>
        </Dialog>
        <form
          method="post"
          action="/api/auth/logout"
          onSubmit={(e) => {
            e.preventDefault();
            setLogout((n) => n + 1);
          }}
        >
          <button>Keluar</button>
        </form>
        <p>Logout: {logout}</p>
        <a
          href="/account/classes"
          onClick={(e) => {
            e.preventDefault();
            setNav((n) => n + 1);
          }}
        >
          Pindah halaman
        </a>
        <p>Navigasi: {nav}</p>
      </main>
    </FormNavigationGuard>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
