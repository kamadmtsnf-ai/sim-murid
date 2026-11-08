/** Opaque reference is a destination hint, never an access credential. */
export const pushRefPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function pushDestination(ref:unknown){return typeof ref==='string'&&pushRefPattern.test(ref)?'/account/notifications/open/'+ref:null;}
export function pushReference(path:string){const prefix='/account/notifications/open/';return path.startsWith(prefix)&&pushDestination(path.slice(prefix.length))===path?path.slice(prefix.length):null;}

/** Called only after the authenticated inbox/source resolver, never from worker payload URLs. */
export function pushServiceDestination(entry:{category:string;context?:{owner_id:string|null;class_id:string|null;year_id:string|null;semester:number|null}|null}){
 const c=entry.context,valid=(id:unknown):id is string=>typeof id==='string'&&pushRefPattern.test(id);
 if(entry.category==='documents')return valid(c?.owner_id)?'/account/biodata/'+c.owner_id:'/account/services/notifications';
 if(entry.category==='schedule')return '/account/schedules'+(valid(c?.class_id)&&valid(c?.year_id)?'?'+new URLSearchParams({class:c.class_id,year:c.year_id}).toString():'');
 if(entry.category==='reports')return '/account/learning/reports'+(valid(c?.class_id)&&valid(c?.owner_id)&&[1,2].includes(c?.semester??0)?'?'+new URLSearchParams({classId:c.class_id,studentId:c.owner_id,semester:String(c.semester)}).toString():'');
 return entry.category==='points'?'/account/services/discipline':entry.category==='surveys'?'/account/services/surveys':'/account/services/notifications';
}
