import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { FloatingLabel } from "../../src/components/ui/floating-label";
import { Field, fieldControlClass } from "../../src/components/ui/field";
import { TextField } from "../../src/components/domain-controls";
import { Dialog } from "../../src/components/ui/dialog";
import { Button } from "../../src/components/ui/button";
import { LoginForm } from "../../src/app/login/login-form";
function Fixture() {
  const [audit, setAudit] = useState("");
  useEffect(() => {
    document.documentElement.style.fontSize = (new URLSearchParams(location.search).get("text") ?? "100") + "%";
  }, []);
  const [open, setOpen] = useState(false), [value, setValue] = useState(""), [result, setResult] = useState("");
  return <main style={{overflowWrap:"anywhere"}} className="mx-auto max-w-4xl space-y-6 p-4" id="main-content" tabIndex={-1}>
    <h1 className="text-2xl font-semibold">Floating label — SiM-Murid</h1>
    <Button type="button" variant="outline" onClick={async () => {
      const axe = await import("axe-core");
      const result = await axe.default.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] } });
      setAudit(JSON.stringify({viewport:innerWidth,text:document.documentElement.style.fontSize,overflow:document.documentElement.scrollWidth > document.documentElement.clientWidth,violations:result.violations.map(v => ({id:v.id, targets:v.nodes.map(n=>n.target)}))}));
    }}>Periksa aksesibilitas</Button><output style={{display:"block",wordBreak:"break-all"}} role="status">{audit}</output>
    <form className="grid min-w-0 gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); setResult(JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))); }} onReset={() => { setValue(""); setResult(""); }}>
      <TextField name="fullName" label="Nama lengkap" required />
      <Field id="example-email" label="Alamat email" description="Gunakan alamat email aktif."><input id="example-email" name="email" type="email" autoComplete="email" className={fieldControlClass} aria-describedby="example-email-help" /></Field>
      <FloatingLabel label="Cari data"><input placeholder="Cari nama atau username" type="search" name="search" className={fieldControlClass}/></FloatingLabel>
      <FloatingLabel label="Nomor HP"><input placeholder=" " type="tel" name="phone" autoComplete="tel" className={fieldControlClass}/></FloatingLabel>
      <FloatingLabel label="Nominal tabungan"><input placeholder=" " type="number" name="amount" min={0} defaultValue={0} className={fieldControlClass}/></FloatingLabel>
      <FloatingLabel label="Tanggal"><input placeholder=" " type="date" name="date" className={fieldControlClass}/></FloatingLabel>
      <FloatingLabel label="Waktu"><input placeholder=" " type="time" name="time" className={fieldControlClass}/></FloatingLabel>
      <FloatingLabel label="Tanggal dan waktu"><input placeholder=" " type="datetime-local" name="datetime" className={fieldControlClass}/></FloatingLabel>
      <FloatingLabel label="Username tidak dapat diubah"><input placeholder=" " name="readonly" readOnly defaultValue="guru-001" className={fieldControlClass}/></FloatingLabel>
      <FloatingLabel label="Isian tidak tersedia"><input placeholder=" " name="disabled" disabled defaultValue="Nonaktif" className={fieldControlClass}/></FloatingLabel>
      <Field id="example-error" label="Kode verifikasi" error="Masukkan enam digit." required><input id="example-error" name="code" inputMode="numeric" maxLength={6} aria-invalid="true" aria-describedby="example-error-error" className={fieldControlClass}/></Field>
      <Field id="example-note" label="Catatan bimbingan dan tindak lanjut siswa yang perlu diperiksa kembali oleh guru wali" description="Maksimal 200 karakter."><textarea id="example-note" name="notes" value={value} onChange={e=>setValue(e.target.value)} rows={3} maxLength={200} aria-describedby="example-note-help" className={fieldControlClass}/></Field>
      <label><input type="checkbox" name="check"/> Contoh checkbox tetap native</label>
      <div className="flex flex-wrap gap-2"><Button type="submit">Simpan contoh</Button><Button variant="outline" type="reset">Reset contoh</Button></div>
      <output className="break-all text-sm sm:col-span-2">{result}</output>
    </form>
    <Dialog open={open} onOpenChange={setOpen} title="Contoh formulir modal" description="Pengujian input dan fokus pada modal." trigger={<Button type="button">Buka modal</Button>}><TextField label="Nama di modal" name="modalName"/><TextField label="Nilai di modal" name="modalValue" value="Tersimpan"/></Dialog>
    <section className="max-w-md space-y-4" aria-labelledby="login-heading"><h2 id="login-heading" className="text-xl font-semibold">Login aktual</h2><LoginForm captcha={{mode:"disabled"}}/></section>
  </main>;
}
function Preview() {
  const [width, setWidth] = useState("390"), [text, setText] = useState("100");
  if (new URLSearchParams(location.search).has("frame")) return <Fixture/>;
  return <div className="space-y-3 p-2"><div className="flex gap-2"><label>Lebar viewport <select value={width} onChange={e=>setWidth(e.target.value)}><option>320</option><option>390</option><option>768</option><option>1280</option></select></label><label>Ukuran teks <select value={text} onChange={e=>setText(e.target.value)}><option>100</option><option>200</option><option>400</option></select></label></div><iframe title="Pratinjau formulir" src={"/?frame=1&text="+text} style={{width:Number(width),maxWidth:"100%",height:850,border:0}}/></div>;
}
createRoot(document.getElementById("root")!).render(<Preview/>);
