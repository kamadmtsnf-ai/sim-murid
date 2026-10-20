'use client';
import {useRef,useState} from 'react';
import type {z} from 'zod';
export function useDomainMutation<T>(url:string,schema:z.ZodType<T>,responseKey:string,onSaved:(data:T)=>void){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');const lock=useRef(false);
 async function mutate(revision:number,command:unknown){if(lock.current)return;lock.current=true;setBusy(true);setMessage('Menyimpan…');
  try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),revision,command})});const body:unknown=await r.json();if(typeof body!=='object'||body===null)throw new Error('Invalid response');const data=body as Record<string,unknown>;setMessage(typeof data.message==='string'?data.message:'Permintaan belum berhasil.');if(r.ok)onSaved(schema.parse(data[responseKey]));}
  catch{setMessage('Koneksi terputus atau layanan belum tersedia. Muat ulang untuk memastikan hasil sebelum mencoba kembali.');}finally{lock.current=false;setBusy(false);}
 }
 return {busy,message,mutate};
}
