import Link from 'next/link';
import {formatAcademicYear} from '@/lib/academic/period';
import type {z} from 'zod';
import {Users,ArrowLeft,ArrowRight,Search} from 'lucide-react';
import {TableRegion} from '@/components/ui/data-table';
import {Button} from '@/components/ui/button';
import {TextField,SelectField} from '@/components/domain-controls';
import {directorySnapshot,directoryQuery} from '@/lib/education/validation';
import {directoryRoles,directoryRoleLabel,directoryPageCount,directoryPageUrl,assignmentLabel} from '@/lib/education/directory';
type Filter=z.infer<typeof directoryQuery>;
type Person=z.infer<typeof directorySnapshot>['rows'][number];
export function DirectoryFilters({filter,isAdmin}:{filter:Filter;isAdmin:boolean}){
 return <form action="/account/directory" method="get" className={`directory-filters ${isAdmin?"directory-filters-admin":""}`} aria-label="Filter direktori">
  <SelectField label="Jenis pengguna" name="role" value={filter.role}>{Object.entries(directoryRoles).map(([value,label])=><option key={value} value={value}>{label}</option>)}</SelectField>
  <TextField label="Nama / username" name="query" type="search" value={filter.query} max={100}/>
  {isAdmin?<SelectField label="Status" name="status" value={filter.status}><option value="active">Aktif</option><option value="inactive">Nonaktif</option><option value="all">Semua</option></SelectField>:<input name="status" type="hidden" value="active"/>}
  <div className="directory-filter-actions"><Button type="submit"><Search aria-hidden="true"/>Terapkan filter</Button><Button variant="outline" asChild><Link prefetch={false} href={directoryPageUrl(directoryQuery.parse({}),1)}>Reset filter</Link></Button></div>
 </form>;
}
function PersonStatus({person}:{person:Person}){return <div className="space-y-2"><span className={`directory-status ${person.status==='active'?'directory-status-active':''}`}>{person.status==='active'?'Aktif':'Nonaktif'}</span>{person.progress?<div className="space-y-1"><p className="text-xs text-muted-foreground">Kelengkapan profil {person.progress.percent}%</p><progress className="directory-progress" value={person.progress.percent} max={100} aria-label={`Kelengkapan profil ${person.name}`}/></div>:null}</div>;}
function PersonAssignments({person}:{person:Person}){return <div className="space-y-2 text-sm"><p>{person.classes.map(c=>`${c.name} (${formatAcademicYear(c.year)})`).join(', ')||'Informasi kelas belum tersedia.'}</p>{person.role==='teacher'?<><p>{person.assignments.map(a=>assignmentLabel(a.code)).join(', ')||'Tidak ada tugas tambahan aktif'}</p><p>Wali kelas: {person.homerooms.map(c=>c.name).join(', ')||'Belum ditetapkan'}</p><p>{person.schedule_count} jadwal aktif</p></>:null}</div>;}
function DetailLink({person}:{person:Person}){return <Button asChild variant="outline"><Link prefetch={false} href={`/account/directory/${person.id}`} aria-label={`Lihat detail: ${person.name}`}>Lihat detail<ArrowRight aria-hidden="true"/></Link></Button>;}
export function DirectoryPanel({data,filter,isAdmin}:{data:z.infer<typeof directorySnapshot>;filter:Filter;isAdmin:boolean}){
 const pages=directoryPageCount(data),pageUrl=(page:number)=>directoryPageUrl(filter,page);
 return <div className="directory-panel space-y-6">
  <DirectoryFilters key={directoryPageUrl(filter,1)} filter={filter} isAdmin={isAdmin}/>
  <section aria-labelledby="directory-results-title" className="space-y-4">
   <div className="directory-results-heading"><div><h2 id="directory-results-title" className="text-lg font-semibold">Daftar {directoryRoleLabel(filter.role).toLocaleLowerCase('id-ID')}</h2><p className="mt-1 text-sm text-muted-foreground">{data.total.toLocaleString('id-ID')} pengguna sesuai filter dan akses Anda.</p></div><p className="text-sm text-muted-foreground">Halaman {data.page} dari {pages}</p></div>
   {Math.ceil(data.total/data.page_size)>2000?<p className="text-sm text-muted-foreground">Hasil melebihi batas halaman. Gunakan pencarian untuk mempersempit daftar.</p>:null}
   {data.rows.length===0?<div className="empty-state"><Users className="mx-auto mb-3 size-7 text-muted-foreground" aria-hidden="true"/><p className="font-medium">Tidak ada pengguna yang sesuai.</p><p className="mt-2 text-sm text-muted-foreground">Ubah filter atau kata pencarian. Daftar tetap mengikuti hak akses akun Anda.</p></div>:<>
    <ul className="directory-cards">{data.rows.map(person=><li key={person.id}><article className="directory-person-card"><div className="directory-person-heading"><div className="min-w-0"><h3 className="font-semibold">{person.name}</h3><p className="mt-1 text-sm text-muted-foreground">@{person.username}</p></div><PersonStatus person={person}/></div><div className="my-4 border-t pt-4"><PersonAssignments person={person}/></div><DetailLink person={person}/></article></li>)}</ul>
    <div className="directory-table"><TableRegion label="Tabel direktori — gulir untuk melihat seluruh kolom"><table className="w-full text-left text-sm"><caption className="sr-only">Direktori {directoryRoleLabel(filter.role)}</caption><thead><tr>{['Nama / username','Status / kelengkapan','Kelas / penugasan','Detail'].map(title=><th scope="col" key={title}>{title}</th>)}</tr></thead><tbody>{data.rows.map(person=><tr key={person.id}><td><strong>{person.name}</strong><p className="mt-1 text-muted-foreground">@{person.username}</p></td><td><PersonStatus person={person}/></td><td><PersonAssignments person={person}/></td><td><DetailLink person={person}/></td></tr>)}</tbody></table></TableRegion></div>
   </>}
  </section>
  {pages>1?<nav aria-label="Halaman direktori" className="directory-pagination">{data.page>1?<Button asChild variant="outline"><Link prefetch={false} href={pageUrl(data.page-1)}><ArrowLeft aria-hidden="true"/>Sebelumnya</Link></Button>:<Button variant="outline" disabled><ArrowLeft aria-hidden="true"/>Sebelumnya</Button>}<span className="text-sm text-muted-foreground">Halaman {data.page} dari {pages}</span>{data.page<pages?<Button asChild variant="outline"><Link prefetch={false} href={pageUrl(data.page+1)}>Berikutnya<ArrowRight aria-hidden="true"/></Link></Button>:<Button variant="outline" disabled>Berikutnya<ArrowRight aria-hidden="true"/></Button>}</nav>:null}
 </div>;
}
