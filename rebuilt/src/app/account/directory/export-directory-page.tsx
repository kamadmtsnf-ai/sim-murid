'use client';
import { useRef,useState } from 'react';
import { Button } from '@/components/ui/button';
export function ExportDirectoryPage({rows,page}:{rows:readonly (readonly string[])[];page:number}){
 const lock=useRef(false);const [busy,setBusy]=useState(false),[failed,setFailed]=useState(false);
 async function download(){if(lock.current)return;lock.current=true;setBusy(true);setFailed(false);try{const {downloadExcel}=await import('@/lib/spreadsheets/write');await downloadExcel(`direktori-halaman-${page}.xlsx`,['Nama','Username','Jenis pengguna','Status','Kelas','Tugas tambahan'],rows,['Hanya baris pada halaman yang sedang ditampilkan, sesuai filter dan hak akses saat data dimuat. Bukan seluruh hasil pencarian.']);}catch{setFailed(true);}finally{lock.current=false;setBusy(false);}}
 return <div className="space-y-2"><Button type="button" variant="outline" disabled={busy||!rows.length} onClick={()=>void download()}>{busy?'Menyiapkan Excel…':'Ekspor halaman ini'}</Button>{failed&&<p role="alert" className="text-sm text-destructive">Excel belum dapat dibuat. Coba kembali.</p>}</div>;
}
