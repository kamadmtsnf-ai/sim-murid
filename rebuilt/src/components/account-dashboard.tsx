"use client";
import {useState} from "react";
import Link from "next/link";
import {ArrowUpRight,Search,Clock3,ShieldCheck,BookOpen,Users,ClipboardList,Settings,GraduationCap,UserRound} from "lucide-react";
import {useWorkspace} from "./workspace-shell";
import {matchesNavigation} from "@/config/account-navigation";
import {Button} from "./ui/button";
const icons=[Users,BookOpen,GraduationCap,ClipboardList,Settings,UserRound];
export function AccountDashboard({name,expiresAt}:{name:string;expiresAt:string}){
 const workspace=useWorkspace(),[query,setQuery]=useState("");
 const groups=(workspace?.navigation??[]).map(g=>({...g,items:g.items.filter(i=>i.href!=="/account"&&matchesNavigation(i,query))})).filter(g=>g.items.length);
 return <main id="main-content" tabIndex={-1} className="dashboard-page space-y-8">
  <section className="dashboard-welcome"><div><p className="eyebrow">Dashboard</p><h1>Selamat datang, {name}</h1><p className="mt-3 max-w-2xl text-muted-foreground">Kelola layanan madrasah dan kebutuhan akun Anda dari satu ruang kerja.</p></div><div className="session-note"><Clock3 className="size-4 shrink-0" aria-hidden="true"/><div><span className="block text-xs font-medium">Sesi berlaku sampai</span><time dateTime={expiresAt} className="text-sm">{new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Jakarta"}).format(new Date(expiresAt))} WIB</time></div></div></section>
  <section className="dashboard-toolbar" aria-label="Pencarian layanan"><div><h2 className="text-xl font-semibold">Layanan madrasah</h2><p className="mt-1 text-sm text-muted-foreground">Pilih layanan sesuai kebutuhan dan tanggung jawab Anda.</p></div><label className="nav-search"><Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground"/><span className="sr-only">Cari layanan madrasah</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari layanan…"/></label></section>
  {groups.length?groups.map(g=>{const Icon=icons[workspace?.navigation.findIndex(n=>n.label===g.label)??0]??BookOpen;return <section key={g.label} className="space-y-3" aria-label={g.label}><h2 className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-primary" aria-hidden="true"/>{g.label}</h2><div className="dashboard-grid">{g.items.map(i=><Link key={i.href} href={i.href} prefetch={false} className="module-card"><div className="flex items-start justify-between gap-4"><h3 className="font-semibold">{i.label}</h3><ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground"/></div><p className="mt-2 text-sm text-muted-foreground">{i.description}</p></Link>)}</div></section>;}):<section className="empty-state" role="status"><Search className="mx-auto mb-3 size-7 text-muted-foreground" aria-hidden="true"/><h2 className="text-lg font-semibold">Layanan tidak ditemukan</h2><p className="mt-2 text-muted-foreground">Coba kata kunci lain atau kosongkan pencarian.</p><Button variant="outline" className="mt-4" onClick={()=>setQuery("")}>Hapus pencarian</Button></section>}
  <p className="flex items-start gap-2 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true"/>Data dan tindakan pada setiap layanan diperiksa sesuai hak akses akun Anda.</p>
 </main>;
}
