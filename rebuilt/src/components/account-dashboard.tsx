"use client";
import {Clock3,ShieldCheck,UserRound,Layers,PanelLeft,BookOpen} from "lucide-react";
import {useWorkspace} from "./workspace-shell";
import {Card,CardContent} from "./ui/card";
export function AccountDashboard({name,expiresAt}:{name:string;expiresAt:string}){
 const workspace=useWorkspace();
 const groups=(workspace?.navigation??[]).map(g=>({...g,items:g.items.filter(i=>i.href!=="/account")})).filter(g=>g.items.length);
 return <main id="main-content" tabIndex={-1} className="dashboard-page space-y-8">
  <section className="dashboard-welcome"><div><p className="eyebrow">Ruang kerja Anda</p><h1>Selamat datang, {name}</h1><p className="mt-3 max-w-2xl text-muted-foreground">Satu ruang kerja untuk mendampingi murid dan mengelola layanan madrasah.</p></div><span className="workspace-status"><ShieldCheck className="size-4" aria-hidden="true"/>Sesi terverifikasi</span></section>
  <section aria-labelledby="account-summary-title" className="space-y-4"><h2 id="account-summary-title" className="text-lg font-semibold">Ringkasan akun</h2><div className="account-summary-grid">
   <Card><CardContent><div className="summary-icon"><UserRound aria-hidden="true"/></div><h3 className="mt-4 text-sm font-medium text-muted-foreground">Identitas akun</h3><p className="mt-1 font-semibold wrap-anywhere">{name}</p><p className="mt-1 text-sm text-muted-foreground wrap-anywhere">@{workspace?.username}</p></CardContent></Card>
   <Card><CardContent><div className="summary-icon"><Clock3 aria-hidden="true"/></div><h3 className="mt-4 text-sm font-medium text-muted-foreground">Sesi berlaku sampai</h3><time dateTime={expiresAt} className="mt-1 block font-semibold">{new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Jakarta"}).format(new Date(expiresAt))} WIB</time><p className="mt-1 text-sm text-muted-foreground">Keluar dari akun setelah memakai perangkat bersama.</p></CardContent></Card>
   <Card><CardContent><div className="summary-icon"><ShieldCheck aria-hidden="true"/></div><h3 className="mt-4 text-sm font-medium text-muted-foreground">Privasi dan akses</h3><p className="mt-1 font-semibold">Sesuai tanggung jawab Anda</p><p className="mt-1 text-sm text-muted-foreground">Data dan tindakan diperiksa menurut peran dan hubungan akun.</p></CardContent></Card>
  </div></section>
  <div className="sidebar-guidance"><PanelLeft className="size-5 shrink-0 text-primary" aria-hidden="true"/><div><p className="font-medium">Buka layanan melalui sidebar</p><p className="mt-1 text-sm text-muted-foreground">Pilih atau cari menu pada sidebar. Di ponsel, buka navigasi melalui tombol menu di bagian atas.</p></div></div>
  <section aria-labelledby="available-services-title" className="space-y-4"><div className="flex items-center gap-2"><Layers className="size-5 text-primary" aria-hidden="true"/><h2 id="available-services-title" className="text-lg font-semibold">Layanan sesuai akses Anda</h2></div><div className="dashboard-grid">{groups.map(g=><section key={g.label} className="dashboard-group"><div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-semibold">{g.label}</h3><span className="service-count">{g.items.length} layanan</span></div><ul className="mt-4 space-y-2">{g.items.map(i=><li key={i.href} className="flex items-start gap-2 text-sm text-muted-foreground"><BookOpen className="mt-0.5 size-3.5 shrink-0" aria-hidden="true"/><span>{i.label}</span></li>)}</ul></section>)}</div></section>
 </main>;
}
