/** Browser fixture adapter only; production imports next/navigation unchanged. */
export function usePathname(){const v=new URLSearchParams(location.search).get('view');return v==='classes'?'/account/classes':v==='operations'?'/account/operations/attendance':v==='learning'?'/account/learning/reports':v==='services'?'/account/services/discipline':'/account';}
export function useRouter(){return {push:()=>{},replace:()=>{},refresh:()=>{},prefetch:()=>{}};}
