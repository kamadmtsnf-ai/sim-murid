import {z} from 'zod';
export const pushCategories=['points','schedule','reports','surveys','follow_up','documents'] as const;
export const configSchema=z.object({accountId:z.uuid(),available:z.boolean(),enabled:z.boolean(),testEnabled:z.boolean(),publicKey:z.string().nullable(),vapidKeyVersion:z.string().nullable(),categories:z.array(z.enum(pushCategories)),maxDevices:z.number()});
export const deviceSchema=z.object({id:z.uuid(),label:z.string(),status:z.enum(['active','disabled','revoked','invalid','expired']),vapid_key_version:z.string(),expires_at:z.string().nullable()});
export const prefsSchema=z.object({revision:z.number().int(),categories:z.array(z.enum(pushCategories)),quiet_start:z.string(),quiet_end:z.string(),timezone:z.string()});
const markerSchema=z.object({owner:z.uuid(),id:z.uuid(),vapidVersion:z.string(),optIn:z.boolean()});
export type PushMarker=z.infer<typeof markerSchema>;
export const markerKey='sim-push-opt-in-v1';
export function readMarker():PushMarker|null{try{const p=markerSchema.safeParse(JSON.parse(localStorage.getItem(markerKey)??'null'));return p.success?p.data:null;}catch{return null;}}
export function writeMarker(marker:PushMarker){try{localStorage.setItem(markerKey,JSON.stringify(marker));return true;}catch{return false;}}
export function appleNeedsInstall(){return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)?!window.matchMedia('(display-mode: standalone)').matches&&!(navigator as Navigator&{standalone?:boolean}).standalone:false;}
export function pushSupport(){if(appleNeedsInstall())return 'install';return window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window?'supported':'unsupported';}
let worker:Promise<ServiceWorkerRegistration>|undefined;
export function pushWorker(){
 if(!worker)worker=navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(async r=>{
  if(r.active?.state!=='activated')await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Worker belum siap. Coba kembali.')),10000);const check=()=>{if(r.active?.state==='activated'){clearTimeout(timer);resolve();}};r.installing?.addEventListener('statechange',check);r.waiting?.addEventListener('statechange',check);r.active?.addEventListener('statechange',check);check();});
  return r;
 }).catch(e=>{worker=undefined;throw e;});return worker;
}
export function applicationKey(value:string){const bytes=Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));return bytes;}
export async function pushRequest(path:string,owner:string,init:RequestInit={}){
 const response=await fetch('/api/push/'+path,{...init,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Sim-Push-Account':owner,...init.headers},signal:AbortSignal.timeout(12000)});
 const data:unknown=await response.json();const message=z.object({message:z.string().max(1000).optional()}).passthrough().safeParse(data);
 if(!response.ok&&response.status!==428)throw Error(message.success&&message.data.message?message.data.message:'Layanan perangkat belum tersedia. Coba kembali.');
 return {status:response.status,data};
}
export async function registerSubscription(owner:string,subscription:PushSubscription,label:string){
 const payload=JSON.stringify({label,subscription:subscription.toJSON()});
 // 428 confirms no registration has happened and a cookie was issued. Only this status is retried.
 for(let i=0;i<2;i++){const r=await pushRequest('subscriptions',owner,{method:'POST',body:payload});if(r.status===428)continue;return z.object({code:z.literal('saved'),id:z.uuid(),binding_version:z.number().int()}).parse(r.data);}
 throw Error('Cookie perangkat belum tersimpan. Izinkan cookie situs lalu coba kembali.');
}

export function pushError(error:unknown){if(error instanceof z.ZodError||error instanceof SyntaxError||error instanceof DOMException)return "Status perangkat belum dapat diverifikasi. Periksa koneksi dan coba kembali.";return error instanceof Error?error.message:"Hasil perubahan belum dapat dipastikan. Periksa status sebelum mencoba lagi.";}
