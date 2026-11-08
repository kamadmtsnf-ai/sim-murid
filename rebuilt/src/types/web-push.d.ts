declare module 'web-push' {
 export function generateRequestDetails(subscription:{endpoint:string;keys:{p256dh:string;auth:string}},payload:string,options:{vapidDetails:{subject:string;publicKey:string;privateKey:string};TTL:number;contentEncoding:'aes128gcm';urgency:'normal'|'high'}):{method:string;endpoint:string;headers:Record<string,string|number>;body:Buffer};
}
