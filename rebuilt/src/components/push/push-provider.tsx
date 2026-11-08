'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {z} from 'zod';
import {configSchema,deviceSchema,prefsSchema,pushSupport,pushWorker,pushRequest,readMarker,writeMarker,markerKey,registerSubscription,applicationKey,pushError,type PushMarker} from '@/lib/push/browser';
type Config=z.infer<typeof configSchema>;
type Device=z.infer<typeof deviceSchema>;
type Preferences=z.infer<typeof prefsSchema>;
type Phase='loading'|'unsupported'|'install'|'default'|'requesting'|'denied'|'unregistered'|'active'|'offline'|'error'|'expired'|'disabled'|'account_changed';
type State={phase:Phase;message:string;config:Config|null;devices:Device[];preferences:Preferences|null;currentId:string|null;busy:boolean};
const initial:State={phase:'loading',message:'',config:null,devices:[],preferences:null,currentId:null,busy:false};
type Controls=State&{refresh:()=>Promise<void>;enable:()=>Promise<void>;revoke:(id:string)=>Promise<void>;test:()=>Promise<void>;save:(value:Preferences)=>Promise<boolean>};
const Context=createContext<Controls|null>(null);
export const usePush=()=>useContext(Context);
export function PushProvider({userId,children}:{userId:string;children:ReactNode}){
 const [state,set]=useState<State>(initial),lock=useRef(false),mounted=useRef(false),generation=useRef(0),memory=useRef<PushMarker|null>(null),registration=useRef<ServiceWorkerRegistration|null>(null),changed=useRef(false),channel=useRef<BroadcastChannel|null>(null);
 const update=useCallback((value:Partial<State>)=>{if(mounted.current&&(!changed.current||value.phase==='account_changed'))set(s=>({...s,...value}));},[]);
 const remember=useCallback((marker:PushMarker)=>{if(!changed.current){memory.current=marker;writeMarker(marker);}},[]);
 const refresh=useCallback(async()=>{
  if(lock.current||changed.current)return;
  if(!navigator.onLine){update({phase:'offline'});return;}
  const support=pushSupport();
  lock.current=true;const run=generation.current;update({busy:true});
  try{
   const config=configSchema.parse((await pushRequest('config',userId)).data);
   if(config.accountId!==userId)throw Error('Akun pada tab ini telah berubah. Muat ulang halaman.');
   const [d,p,r]=await Promise.all([pushRequest('devices',userId),pushRequest('preferences',userId),support==='supported'?pushWorker():Promise.resolve(null)]);
   if(run!==generation.current)return;
   registration.current=r;
   const devices=z.object({devices:z.array(deviceSchema)}).parse(d.data).devices;
   const preferences=z.object({code:z.literal('saved'),preferences:prefsSchema}).parse(p.data).preferences;
   const sub=r?await r.pushManager.getSubscription():null,marker=readMarker()??memory.current;
   const permission=support==='supported'?Notification.permission:'default';
   const current=marker?.owner===userId?devices.find(d=>d.id===marker.id):undefined;
   let phase:Phase=support!=='supported'?support:permission==='denied'?'denied':permission==='default'?'default':'unregistered';
   let currentId:string|null=current&&sub&&current.status!=='active'?current.id:null;
   if(current&&marker?.optIn&&support==='supported'){
    if(current.status!=='active'||(current.expires_at&&Date.parse(current.expires_at)<=Date.now())){remember({...marker,optIn:false});phase='expired';}
    else if(permission!=='granted'){
     // Browser permission changed outside the app: server cancellation comes first.
     await pushRequest('subscriptions/'+current.id,userId,{method:'DELETE'});remember({...marker,optIn:false});
     if(sub)await sub.unsubscribe();
    }else if(sub&&permission==='granted'){
     if(current.vapid_key_version!==config.vapidKeyVersion){phase='expired';currentId=current.id;}
     else if(config.enabled){
      // Reconcile only an already active opt-in owned by this exact account. No resubscribe here.
      const saved=await registerSubscription(userId,sub,current.label||'Perangkat ini');
      if(run!==generation.current)return;
      remember({owner:userId,id:saved.id,vapidVersion:config.vapidKeyVersion!,optIn:true});currentId=saved.id;phase='active';
     }else{currentId=current.id;phase='disabled';}
    }
   }
   if(support==='supported'&&!config.enabled&&phase!=='denied'&&phase!=='expired')phase='disabled';
   update({config,devices,preferences,currentId,phase,message:''});
  }catch(error){if(run===generation.current)update({phase:'error',message:pushError(error)});}
  finally{lock.current=false;update({busy:false});if(run!==generation.current&&mounted.current&&!changed.current)queueMicrotask(()=>window.dispatchEvent(new Event('sim-push-refresh')));}
 },[userId,remember,update]);
 useEffect(()=>{
  mounted.current=true;changed.current=false;memory.current=null;const effectGeneration=generation.current+1;generation.current=effectGeneration;
  let last=0;
  const hint=()=>{if(Date.now()-last<30000)return;last=Date.now();void refresh();};
  const online=()=>{last=Date.now();void refresh();};
  const offline=()=>update({phase:'offline'});
  const accountChanged=()=>{changed.current=true;generation.current++;update({phase:'account_changed',message:'Akun berubah pada tab lain. Muat ulang halaman sebelum mengelola perangkat.'});};
  const storage=(e:StorageEvent)=>{if(e.key===markerKey){const marker=readMarker();if(marker&&marker.owner!==userId)accountChanged();else online();}};
  const worker=(e:MessageEvent)=>{if(e.data?.type==='sim-push-reconcile')online();};
  try{channel.current=new BroadcastChannel('sim-push-lifecycle');channel.current.onmessage=e=>{if(e.data?.type==='account'&&e.data.accountId!==userId)accountChanged();else if(e.data?.type==='changed')online();};channel.current.postMessage({type:'account',accountId:userId});}catch{/* Optional UX hint; server session and expected-account header remain authoritative. */}
  window.addEventListener('sim-push-refresh',online);window.addEventListener('online',online);window.addEventListener('offline',offline);window.addEventListener('focus',hint);window.addEventListener('storage',storage);navigator.serviceWorker?.addEventListener('message',worker);
  void refresh();
  return()=>{mounted.current=false;generation.current=effectGeneration+1;window.removeEventListener('sim-push-refresh',online);window.removeEventListener('online',online);window.removeEventListener('offline',offline);window.removeEventListener('focus',hint);window.removeEventListener('storage',storage);navigator.serviceWorker?.removeEventListener('message',worker);channel.current?.close();};
 },[userId,refresh,update]);
 async function perform(action:()=>Promise<void>){
  if(lock.current||changed.current)return false;
  if(!navigator.onLine){update({phase:'offline'});return false;}
  lock.current=true;const run=generation.current;update({busy:true,message:''});
  try{await action();if(run!==generation.current)return false;channel.current?.postMessage({type:'changed'});return true;}
  catch(error){if(run===generation.current)update({phase:'error',message:pushError(error)});return false;}
  finally{lock.current=false;update({busy:false});}
 }
 async function enable(){
  if(lock.current||changed.current||!state.config?.enabled||!registration.current||pushSupport()!=='supported'||!navigator.onLine)return;
  // requestPermission executes in the original click stack, before any await/lock acquisition.
  let permission:Promise<NotificationPermission>;try{permission=Notification.permission==='default'?Notification.requestPermission():Promise.resolve(Notification.permission);}catch{update({phase:'error',message:'Izin belum dapat diminta. Periksa pengaturan browser.'});return;}
  update({phase:'requesting'});
  await perform(async()=>{
   if(await permission!=='granted'){update({phase:'denied',message:'Izin belum diberikan. Ubah izin melalui pengaturan browser bila diperlukan.'});return;}
   const config=configSchema.parse((await pushRequest('config',userId)).data);
   if(config.accountId!==userId||!config.enabled||!config.publicKey||!config.vapidKeyVersion)throw Error('Aktivasi belum tersedia. Periksa status perangkat.');
   const reg=registration.current!;
   let sub=await reg.pushManager.getSubscription();
   if(sub&&sub.options.applicationServerKey){const expected=applicationKey(config.publicKey),actual=new Uint8Array(sub.options.applicationServerKey);if(actual.length!==expected.length||actual.some((b,i)=>b!==expected[i]))throw Error('Kunci notifikasi diperbarui. Nonaktifkan perangkat ini sebelum mengaktifkannya kembali.');}
   sub??=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:applicationKey(config.publicKey)});
   const saved=await registerSubscription(userId,sub,'Perangkat ini');
   remember({owner:userId,id:saved.id,vapidVersion:config.vapidKeyVersion,optIn:true});
   update({config,devices:[...state.devices.filter(d=>d.id!==saved.id),{id:saved.id,label:'Perangkat ini',status:'active',vapid_key_version:config.vapidKeyVersion,expires_at:sub.expirationTime==null?null:new Date(sub.expirationTime).toISOString()}],phase:'active',currentId:saved.id,message:'Notifikasi perangkat aktif. Pengiriman tetap bergantung layanan dan perangkat.'});
  });
 }
 async function revoke(id:string){await perform(async()=>{
  const r=await pushRequest('subscriptions/'+id,userId,{method:'DELETE'});z.object({code:z.literal('saved')}).parse(r.data);
  const marker=readMarker()??memory.current;
  update({devices:state.devices.map(d=>d.id===id?{...d,status:'revoked'}:d)});
  if(marker?.owner===userId&&marker.id===id){remember({...marker,optIn:false});update({currentId:id,phase:'unregistered'});const sub=await registration.current?.pushManager.getSubscription();if(sub&&!await sub.unsubscribe())throw Error('Binding server sudah dicabut. Cleanup browser belum selesai; coba nonaktifkan kembali.');update({currentId:null});}
  update({devices:state.devices.map(d=>d.id===id?{...d,status:'revoked'}:d),message:'Binding perangkat telah dicabut.'});
 });}
 async function test(){if(!state.currentId||!state.config?.testEnabled)return;await perform(async()=>{const r=await pushRequest('test',userId,{method:'POST',body:JSON.stringify({subscription_id:state.currentId,request_id:crypto.randomUUID()})});z.object({code:z.enum(['saved','duplicate'])}).parse(r.data);update({message:'Uji telah diantrekan. Ini belum berarti notifikasi diterima atau ditampilkan.'});});}
 async function save(value:Preferences){return perform(async()=>{const r=await pushRequest('preferences',userId,{method:'PATCH',body:JSON.stringify({...value,quiet_start:value.quiet_start.slice(0,5),quiet_end:value.quiet_end.slice(0,5)})});const p=z.object({code:z.literal('saved'),preferences:prefsSchema}).parse(r.data);update({preferences:p.preferences,message:'Preferensi notifikasi tersimpan.'});});}
 return <Context.Provider value={{...state,refresh,enable,revoke,test,save}}>{children}</Context.Provider>;
}
