declare global {interface Window {loginNavigation?:string[];loginRefreshes?:number;}}
export function useRouter(){return {replace(destination:string){(window.loginNavigation??=[]).push(destination);if(new URLSearchParams(location.search).get('navigation')==='fail')throw Error('Synthetic navigation failure');},refresh(){window.loginRefreshes=(window.loginRefreshes??0)+1;}};}
