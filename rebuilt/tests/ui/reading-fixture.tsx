import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Guidance } from "../../src/components/ui/guidance";
import { Card, CardContent, CardHeader, CardTitle } from "../../src/components/ui/card";
import { Button } from "../../src/components/ui/button";
import { Status } from "../../src/components/ui/status";
function Fixture() {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  return <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl space-y-6 p-4">
    <h1 className="text-2xl font-semibold">Tampilan ringkas</h1>
    <Card><CardHeader><CardTitle><h2>Data utama</h2></CardTitle></CardHeader><CardContent className="space-y-4">
      <Guidance summary="Panduan membaca data"><p>Penjelasan tambahan tersedia saat diperlukan. Informasi panjang tetap dapat dibaca seluruhnya tanpa pemotongan, termasuk kata {"contoh".repeat(70)}.</p></Guidance>
      <Status tone="warning">Periksa data sebelum menyimpan. Hasil yang belum pasti tidak boleh diulang otomatis.</Status>
      <form className="space-y-4" onSubmit={event=>{event.preventDefault();setSaved(true);}}>
        <label className="ds-field"><span>Nama</span><input className="ds-field-control" required value={name} onChange={event=>setName(event.target.value)} /></label>
        <p className="text-sm">Nama wajib diisi.</p>
        <Button type="submit">Simpan</Button>
      </form>
      {saved && <Status tone="success">Data contoh tersimpan.</Status>}
    </CardContent></Card>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
