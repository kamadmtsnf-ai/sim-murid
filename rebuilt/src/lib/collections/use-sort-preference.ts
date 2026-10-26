'use client';
import {useSyncExternalStore} from 'react';
import {validCollectionSort,type CollectionSort} from './presentation';
const event='sim-collection-sort';
const memory=new Map<string,CollectionSort>();
function subscribe(callback:()=>void){const changed=(e:StorageEvent)=>{if(e.key)memory.delete(e.key);else memory.clear();callback();};window.addEventListener('storage',changed);window.addEventListener(event,callback);return ()=>{window.removeEventListener('storage',changed);window.removeEventListener(event,callback);};}
const server=():CollectionSort=>'label-asc';
/** Only display ordering persists. Never store queries, classes, grants or personal data rows. */
export function useSortPreference(userId:string){
 const key=`sim-collection-sort:v1:${encodeURIComponent(userId)}:access`;
 const read=():CollectionSort=>{const cached=memory.get(key);if(cached)return cached;try{const value=localStorage.getItem(key);return validCollectionSort(value)?value:'label-asc';}catch{return 'label-asc';}};
 const sort=useSyncExternalStore(subscribe,read,server);
 function setSort(value:CollectionSort){if(!validCollectionSort(value))return;memory.set(key,value);try{localStorage.setItem(key,value);}catch{/* Storage denied: current default remains usable. */}window.dispatchEvent(new Event(event));}
 return [sort,setSort] as const;
}
