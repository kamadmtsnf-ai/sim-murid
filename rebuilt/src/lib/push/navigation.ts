/** Opaque reference is a destination hint, never an access credential. */
export const pushRefPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function pushDestination(ref:unknown){return typeof ref==='string'&&pushRefPattern.test(ref)?'/account/notifications/open/'+ref:null;}
export function pushReference(path:string){const prefix='/account/notifications/open/';return path.startsWith(prefix)&&pushDestination(path.slice(prefix.length))===path?path.slice(prefix.length):null;}
