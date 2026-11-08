'use client';
import {useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Status} from '@/components/ui/status';
export function ReadNotification({reference,read}:{reference:string;read:boolean}){
 const [done,setDone]=useState(read),[pending,setPending]=useState(false),[message,setMessage]=useState(''),lock=useRef(false);
 async function mark(){if(lock.current)return;lock.current=true;setPending(true);setMessage('');try{
 const response=await fetch('/api/push/open/'+reference,{method:'POST',cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(12000)});
 const data=await response.json();if(!response.ok||data.code!=='saved'||typeof data.read_at!=='string')throw Error();setDone(true);
 }catch{setMessage('Status dibaca belum dapat dipastikan. Muat ulang halaman untuk memeriksa hasil.');}finally{lock.current=false;setPending(false);}}
 return <div className="space-y-3">{done?<p role="status" className="text-sm">Sudah dibaca.</p>:<Button type="button" disabled={pending} onClick={()=>void mark()}>{pending?'Menyimpan…':'Tandai dibaca'}</Button>}{message?<Status tone="error">{message}</Status>:null}</div>;
}
