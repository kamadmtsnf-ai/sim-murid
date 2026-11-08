/* SiM-Murid Web Push v1. No fetch handler, private cache or forced page reload. */
'use strict';
const INBOX='/account/services/notifications';
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const uuid=new RegExp('^'+UUID+'$','i');
const openPath=new RegExp('^/account/notifications/open/'+UUID+'$','i');
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let ref=null,eventRef=null;
 try{
  const text=event.data?.text()??'';
  if(new TextEncoder().encode(text).length>2048)throw Error('Oversized payload');
  const p=JSON.parse(text);
  if(!p||p.v!==1||Object.keys(p).some(k=>!['v','deliveryRef','eventRef','title','body'].includes(k))||!uuid.test(p.deliveryRef)||!uuid.test(p.eventRef))throw Error('Invalid payload');
  ref=p.deliveryRef;eventRef=p.eventRef;
 }catch{/* Always show a generic fallback; never trust text or URLs from payload. */}
 event.waitUntil(self.registration.showNotification('SiM-Murid',{
  body:'Ada pemberitahuan baru. Buka aplikasi untuk melihat detail.',
  icon:'/pwa/icon-192.png',badge:'/pwa/icon-192.png',tag:eventRef?'sim-push:'+eventRef:'sim-push-fallback',
  data:{path:ref?'/account/notifications/open/'+ref:INBOX},renotify:false
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const candidate=event.notification.data?.path;
 const path=typeof candidate==='string'&&openPath.test(candidate)?candidate:INBOX;
 const target=new URL(path,self.location.origin);
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  // Only focus an exact destination; do not navigate a window holding an unfinished form.
  for(const client of windows){const u=new URL(client.url);if(u.origin===target.origin&&u.pathname===target.pathname&&!u.search&&!u.hash&&'focus' in client){await client.focus();return;}}
  await self.clients.openWindow(target.href);
 })());
});
self.addEventListener('pushsubscriptionchange',event=>event.waitUntil((async()=>{
 const windows=await self.clients.matchAll({type:'window'});
 for(const client of windows)client.postMessage({type:'sim-push-reconcile'});
})()));
