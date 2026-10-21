"use client";
import {Clock3,ShieldCheck,UserRound,Layers,PanelLeft} from "lucide-react";
import {useWorkspace} from "./workspace-shell";
import {NavigationIcon} from "./navigation-icon";
import {Card,CardContent} from "./ui/card";
import {Status} from "./ui/status";

const sessionFormatter=new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Jakarta"});

export function AccountDashboard({name,expiresAt}:{name:string;expiresAt:string}){
 const workspace=useWorkspace();
 const groups=(workspace?.navigation??[]).map(g=>({...g,items:g.items.filter(i=>i.href!=="/account")})).filter(g=>g.items.length);
 const expires=new Date(expiresAt);
 const sessionTime=Number.isNaN(expires.getTime())?null:sessionFormatter.format(expires);
 return <main id="main-content" tabIndex={-1} className="dashboard-page space-y-8">
  <section className="dashboard-welcome">
   <div className="min-w-0"><p className="eyebrow">Ruang kerja Anda</p><h1>Selamat datang, {name}</h1><p className="mt-3 max-w-2xl text-muted-foreground">Satu ruang kerja untuk mendampingi murid dan mengelola layanan madrasah.</p></div>
   <span className="workspace-status"><ShieldCheck className="size-4 shrink-0" aria-hidden="true"/>Akun terverifikasi</span>
  </section>
  <section aria-labelledby="account-summary-title" className="space-y-4">
   <h2 id="account-summary-title" className="text-lg font-semibold">Ringkasan akun</h2>
   <div className="account-summary-grid">
    <Card className="min-w-0 py-5"><CardContent className="min-w-0 px-5"><div className="summary-icon"><UserRound aria-hidden="true"/></div><h3 className="mt-4 text-sm font-medium text-muted-foreground">Identitas akun</h3><p className="mt-1 font-semibold wrap-anywhere">{name}</p><p className="mt-1 text-sm text-muted-foreground wrap-anywhere">{workspace?.username?`@${workspace.username}`:"Username belum tersedia"}</p></CardContent></Card>
    <Card className="min-w-0 py-5"><CardContent className="min-w-0 px-5"><div className="summary-icon"><Clock3 aria-hidden="true"/></div><h3 className="mt-4 text-sm font-medium text-muted-foreground">Sesi berlaku sampai</h3>{sessionTime?<time dateTime={expiresAt} className="mt-1 block font-semibold tabular-nums">{sessionTime} WIB</time>:<p className="mt-1 font-semibold">Waktu sesi belum tersedia</p>}<p className="mt-2 text-sm text-muted-foreground">Keluar dari akun setelah memakai perangkat bersama.</p></CardContent></Card>
    <Card className="min-w-0 py-5"><CardContent className="min-w-0 px-5"><div className="summary-icon"><ShieldCheck aria-hidden="true"/></div><h3 className="mt-4 text-sm font-medium text-muted-foreground">Privasi dan akses</h3><p className="mt-1 font-semibold">Sesuai tanggung jawab Anda</p><p className="mt-2 text-sm text-muted-foreground">Data dan tindakan diperiksa menurut peran dan hubungan akun.</p></CardContent></Card>
   </div>
  </section>
  <div className="sidebar-guidance"><PanelLeft className="size-5 shrink-0 text-primary" aria-hidden="true"/><div className="min-w-0"><p className="font-medium">Buka layanan melalui sidebar</p><p className="mt-1 text-sm text-muted-foreground">Pilih atau cari menu pada sidebar. Di ponsel, buka navigasi melalui tombol menu di bagian atas.</p></div></div>
  <section aria-labelledby="available-services-title" className="space-y-4">
   <div className="flex items-start gap-2"><Layers className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true"/><div className="min-w-0"><h2 id="available-services-title" className="text-lg font-semibold">Layanan sesuai akses Anda</h2><p className="mt-1 text-sm text-muted-foreground">Lihat layanan yang tersedia, lalu buka melalui sidebar.</p></div></div>
   {!workspace?<Status>Daftar layanan belum dapat dimuat. Muat ulang halaman untuk mencoba kembali.</Status>:workspace.navigationUnavailable?<Status>Daftar layanan belum dapat dimuat sepenuhnya. Muat ulang halaman untuk mencoba kembali. Menu yang tersedia tetap dapat digunakan sesuai akses Anda.</Status>:null}
   {groups.length?<div className="dashboard-grid">{groups.map(g=><section key={g.label} className="dashboard-group"><div className="flex flex-wrap items-start justify-between gap-3"><h3 className="min-w-0 flex-1 font-semibold">{g.label}</h3><span className="service-count">{g.items.length} layanan</span></div><ul className="dashboard-services">{g.items.map(i=><li key={i.href}><NavigationIcon href={i.href}/><span className="min-w-0">{i.label}</span></li>)}</ul></section>)}</div>:workspace&&!workspace.navigationUnavailable?<div className="empty-state"><p className="font-medium">Belum ada layanan untuk ditampilkan.</p><p className="mt-2 text-sm text-muted-foreground">Hubungi administrator madrasah jika Anda memerlukan akses layanan.</p></div>:null}
  </section>
 </main>;
}
