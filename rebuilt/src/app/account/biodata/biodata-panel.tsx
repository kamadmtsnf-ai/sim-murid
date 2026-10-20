'use client';
import Link from 'next/link';
import Image from 'next/image';
import {useState,useRef,type FormEvent} from 'react';
import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {Button} from '@/components/ui/button';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import {getSupabasePublicEnvironment} from '@/lib/supabase/environment';
import {rules,enums,normalizeBiodata,biodataRequest,requiredFields,studentSnapshot,type StudentSnapshot,type Biodata} from '@/lib/student/validation';
import {documentRow,documentPrepare} from '@/lib/documents/validation';
const sections=[['student','Data siswa'],['father','Ayah'],['mother','Ibu'],['guardian','Wali'],['address','Alamat siswa'],['documents','Dokumen']] as const;
const label=(field:string)=>field.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/No HP/g,'No. HP');
const fieldClass='mt-1 w-full rounded border bg-background p-2';
export function BiodataPanel({initial,initialDocuments}:{initial:StudentSnapshot;initialDocuments:z.infer<typeof documentRow>[]}){
 const [student,setStudent]=useState(initial),[data,setData]=useState<Biodata>(()=>normalizeBiodata(initial.data)),[documents,setDocuments]=useState(initialDocuments),[section,setSection]=useState('student'),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[message,setMessage]=useState(''),[preview,setPreview]=useState<{url:string;mime:string;filename:string}|null>(null),[download,setDownload]=useState<{url:string;filename:string}|null>(null),[zoom,setZoom]=useState(100);const lock=useRef(false);
 const required=requiredFields(data);const fields=rules.fields.filter(k=>section==='student'?!/^(Ayah|Ibu|Wali|Siswa)/.test(k):section==='father'?k.startsWith('Ayah'):section==='mother'?k.startsWith('Ibu'):section==='guardian'?k.startsWith('Wali'):section==='address'?k.startsWith('Siswa'):false);
 function update(field:string,value:string|boolean){setData(current=>normalizeBiodata({...current,[field]:value}));setDirty(true);}
 function visible(field:string){
  if(field.startsWith('Ayah')&&rules.fatherAddress.includes(field))return data.AyahStatus==='Masih Hidup'&&data.AyahAlamatTinggalLuarNegeri!==true;
  if(field==='AyahAlamatTinggalLuarNegeri')return data.AyahStatus==='Masih Hidup';
  if(field.startsWith('Ibu')&&rules.motherAddress.includes(field))return data.IbuStatus==='Masih Hidup'&&data.IbuAlamatTinggalLuarNegeri!==true&&data.IbuAlamatSamadenganAyah!==true;
  if(['IbuAlamatTinggalLuarNegeri','IbuAlamatSamadenganAyah'].includes(field))return data.IbuStatus==='Masih Hidup';
  if(field.startsWith('Wali')&&field!=='WaliPilihan'){
   if(data.WaliPilihan!=='Lainnya')return false;
   if(rules.guardianAddress.includes(field))return data.WaliAlamatStatus==='Lainnya'&&data.WaliAlamatTinggalLuarNegeri!==true;
   if(field==='WaliAlamatTinggalLuarNegeri')return data.WaliAlamatStatus==='Lainnya';
  }
  return true;
 }
 async function readResponse(r:Response){const body:unknown=await r.json();return z.object({message:z.string().optional(),student:studentSnapshot.optional(),documents:z.array(documentRow).optional()}).passthrough().parse(body);}
 function apply(result:{student?:StudentSnapshot|undefined;documents?:z.infer<typeof documentRow>[]|undefined}){if(result.student){setStudent(result.student);setData(normalizeBiodata(result.student.data));setDirty(false);}if(result.documents)setDocuments(result.documents);}
 async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setMessage('Menyimpan biodata…');try{
  const parsed=biodataRequest.safeParse({requestId:crypto.randomUUID(),revision:student.revision,data});if(!parsed.success){setMessage(parsed.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '));return;}
  const r=await fetch(`/api/student-profile/${student.id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsed.data)});const result=await readResponse(r);setMessage(result.message??'Permintaan belum berhasil.');if(r.ok)apply(result);
 }catch{setMessage('Koneksi terputus. Muat ulang untuk memastikan hasil penyimpanan.');}finally{lock.current=false;setBusy(false);}}
 async function documentCommand(command:unknown){const r=await fetch(`/api/student-documents/${student.id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command)});const body=await readResponse(r);if(!r.ok)throw new Error(body.message??'Permintaan dokumen belum berhasil.');return body;}
 async function upload(e:FormEvent<HTMLFormElement>){e.preventDefault();if(lock.current)return;const form=new FormData(e.currentTarget),file=form.get('file');if(!(file instanceof File))return;
  lock.current=true;setBusy(true);setMessage('Menyiapkan unggahan privat…');setPreview(null);setDownload(null);
  try{
   const input=documentPrepare.safeParse({action:'prepare',kind:String(form.get('kind')),filename:file.name,size:file.size,mime:file.type});if(!input.success){setMessage(input.error.issues[0]?.message??'Periksa file.');return;}
   const response=await documentCommand(input.data),prepared=z.object({id:z.uuid(),upload:z.object({path:z.string(),token:z.string()})}).parse(response);
   const env=getSupabasePublicEnvironment(),storage=createClient(env.url,env.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}).storage.from('student-documents');
   setMessage('Mengunggah langsung ke penyimpanan privat. Jangan tutup halaman…');const r=await storage.uploadToSignedUrl(prepared.upload.path,prepared.upload.token,file,{contentType:file.type,cacheControl:'0'});if(r.error)throw new Error('Unggahan gagal. Periksa koneksi atau kuota penyimpanan, lalu muat ulang.');
   setMessage('Memvalidasi isi dokumen…');const result=await documentCommand({action:'finalize',id:prepared.id});apply(result);setMessage(result.message??'Dokumen tersimpan.');
  }catch(error){setMessage(error instanceof Error?error.message:'Unggahan belum berhasil. Muat ulang.');}finally{lock.current=false;setBusy(false);}
 }
 async function act(id:string,action:'preview'|'download'|'delete'|'finalize'){
  if(lock.current)return;if(action==='delete'&&!window.confirm('Hapus dokumen? Jika wajib, kelengkapan profil akan diperiksa ulang.'))return;
  lock.current=true;setBusy(true);try{
   if(action==='preview'||action==='download'){const result=await documentCommand({action:'download',id,download:action==='download'});const view=z.object({url:z.url(),mime:z.string(),filename:z.string()}).parse(result);if(action==='preview'){setPreview(view);setZoom(100);}else setDownload(view);setMessage('Tautan berlaku 60 detik. Klik kembali tombol jika kedaluwarsa.');}
   else{const result=await documentCommand({action,id});apply(result);setPreview(null);setDownload(null);setMessage(result.message??'Dokumen diperbarui.');}
  }catch(error){setMessage(error instanceof Error?error.message:'Permintaan belum berhasil.');}finally{lock.current=false;setBusy(false);}
 }
 return <div className="space-y-6"><h1 className="text-3xl font-semibold">Biodata dan dokumen</h1><p>{student.name} <span className="text-muted-foreground">({student.username})</span></p><p>Kelengkapan tersimpan: <strong>{student.progress.percent}%</strong>. Field bertanda * wajib untuk melanjutkan; biodata dapat disimpan sebagai draf.</p><progress className="w-full" value={student.progress.percent} max={100} aria-label="Kelengkapan profil tersimpan"/>{student.progress.complete&&<Link href="/account/security" className="block text-primary underline">Lanjutkan pengaturan keamanan akun</Link>}
 {!student.can_write&&<p className="rounded border p-3">Anda memiliki akses baca. Perubahan hanya dapat dilakukan pemilik akun atau Admin.</p>}
 <nav aria-label="Bagian biodata" className="flex flex-wrap gap-2">{sections.map(([value,title])=><Button key={value} disabled={busy} variant={section===value?'default':'outline'} aria-pressed={section===value} onClick={()=>setSection(value)}>{title}</Button>)}</nav><p role="status" aria-live="polite">{message}</p>
 {section!=='documents'&&<Card><CardHeader><CardTitle>{sections.find(s=>s[0]===section)?.[1]}</CardTitle></CardHeader><CardContent><form onSubmit={e=>void save(e)}><fieldset disabled={busy||!student.can_write} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2">{fields.filter(visible).map(field=>rules.booleans.includes(field)?<label className="flex items-center gap-2" key={field}><input type="checkbox" checked={data[field]===true} onChange={e=>update(field,e.target.checked)}/>{label(field)}</label>:<label className="block text-sm" key={field}>{label(field)}{required.includes(field)?' *':''}{enums[field]?<select className={fieldClass} value={String(data[field]??'')} onChange={e=>update(field,e.target.value)}><option value="">Pilih…</option>{enums[field]?.map(v=><option key={v} value={v}>{v}</option>)}</select>:<input className={fieldClass} maxLength={500} type={field.endsWith('TanggalLahir')||field==='TanggalLahir'?'date':field==='Email'?'email':'text'} value={String(data[field]??'')} onChange={e=>update(field,e.target.value)}/>}</label>)}</div>{section==='guardian'&&data.WaliPilihan!=='Lainnya'&&<p>Biodata wali mengikuti data {String(data.WaliPilihan||'ayah/ibu')} yang dipilih. Hubungan akun Orang Tua harus diverifikasi Admin secara terpisah.</p>}{student.can_write&&<Button type="submit">{busy?'Menyimpan…':'Simpan biodata / draf'}</Button>}</fieldset></form></CardContent></Card>}
 {section==='documents'&&<Card><CardHeader><CardTitle>Dokumen privat</CardTitle></CardHeader><CardContent className="space-y-5"><p>KK, Akta, dan Ijazah: PDF. Kartu bantuan, BPJS, dan KTP: PNG/JPEG. Maksimal 50 MB per file. Dokumen wajib yang belum lengkap: {student.progress.missingDocuments.join(', ')||'tidak ada'}.</p>{dirty&&<p className="rounded border p-3">Simpan perubahan biodata sebelum mengunggah, memvalidasi, atau menghapus dokumen.</p>}
 {student.can_write&&<form onSubmit={e=>void upload(e)}><fieldset disabled={busy||dirty} className="grid gap-4 sm:grid-cols-2"><label>Jenis dokumen<select name="kind" className={fieldClass}>{rules.documents.map(kind=><option key={kind} value={kind}>{kind}</option>)}</select></label><label>File<input type="file" name="file" required className="block max-w-full" accept="application/pdf,image/png,image/jpeg"/></label><Button type="submit">Unggah dan validasi</Button></fieldset></form>}
 {documents.length===0?<p>Belum ada dokumen.</p>:<ul className="divide-y">{documents.map(doc=><li className="space-y-2 py-3" key={doc.id}><p><strong>{doc.kind}</strong> — {doc.filename} ({Math.ceil(doc.size/1024)} KB) · {doc.state==='ready'?'Siap':doc.state==='pending'?'Menunggu unggahan/validasi':'Penghapusan belum selesai'}</p><div className="flex flex-wrap gap-2">{doc.state==='ready'&&<><Button variant="outline" disabled={busy} onClick={()=>void act(doc.id,'preview')}>Pratinjau</Button><Button variant="outline" disabled={busy} onClick={()=>void act(doc.id,'download')}>Unduh</Button></>}{student.can_write&&doc.state==='pending'&&<Button variant="outline" disabled={busy||dirty} onClick={()=>void act(doc.id,'finalize')}>Coba validasi kembali</Button>}{student.can_write&&<Button variant="outline" disabled={busy||dirty} onClick={()=>void act(doc.id,'delete')}>{doc.state==='deleting'?'Ulangi hapus':'Hapus'}</Button>}</div></li>)}</ul>}
 {download&&<a href={download.url} target="_blank" rel="noreferrer" className="block text-primary underline">Klik untuk mengunduh {download.filename} (tautan 60 detik)</a>}
 {preview&&<section aria-label="Pratinjau dokumen" className="space-y-3 rounded border p-3"><div className="flex items-center justify-between gap-3"><h3>{preview.filename}</h3><Button variant="outline" onClick={()=>setPreview(null)}>Tutup pratinjau</Button></div>{preview.mime==='application/pdf'?<iframe src={preview.url} title={`PDF ${preview.filename}`} referrerPolicy="no-referrer" className="h-[70vh] w-full"/>:<><label>Zoom {zoom}%<input type="range" min={50} max={200} step={10} value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label><div className="max-h-[70vh] overflow-auto"><Image unoptimized src={preview.url} alt={preview.filename} width={1200} height={1600} style={{width:`${zoom}%`,height:'auto',maxWidth:'none'}} onError={()=>setMessage('Pratinjau tidak tersedia atau tautan kedaluwarsa. Klik Pratinjau kembali.')}/></div></>}<p className="text-sm">Jika tautan kedaluwarsa, klik Pratinjau atau Unduh kembali untuk membuat tautan baru.</p></section>}
 </CardContent></Card>}
 <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy} onClick={()=>{if(!dirty||window.confirm('Muat ulang dan batalkan perubahan yang belum disimpan?'))window.location.reload();}}>Muat ulang</Button>{section==='documents'&&dirty&&<Button disabled={busy} onClick={()=>setSection('student')}>Kembali untuk menyimpan biodata</Button>}</div>
 </div>;
}
