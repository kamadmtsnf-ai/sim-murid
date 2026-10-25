"use client";
import {createRoot} from "react-dom/client";
import {AlertDialog} from "radix-ui";
import {Button} from "./button";
let active=false;
let cancelActive:(()=>void)|null=null;
export function cancelActiveConfirmation(){cancelActive?.();}
/** Resolve an explicit decision once; never queue or replay mutations. */
export function confirmAction(message:string):Promise<boolean>{
 if(typeof document==="undefined" || active)return Promise.resolve(false);
 active=true;
 const previous=document.activeElement instanceof HTMLElement ? document.activeElement : null;
 const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
 return new Promise(resolve=>{
  let settled=false;
  const cancel=()=>finish(false);
  function finish(value:boolean){if(settled)return;settled=true;cancelActive=null;
   window.removeEventListener("popstate",cancel);window.removeEventListener("pagehide",cancel);root.render(null);
   setTimeout(()=>{root.unmount();host.remove();active=false;if(previous?.isConnected)previous.focus();resolve(value);},0);
  }
  cancelActive=cancel;window.addEventListener("popstate",cancel);window.addEventListener("pagehide",cancel);
  root.render(<AlertDialog.Root open onOpenChange={open=>{if(!open)finish(false);}}><AlertDialog.Portal><AlertDialog.Overlay className="fixed inset-0 z-[100] bg-foreground/45 backdrop-blur-sm"/><AlertDialog.Content className="fixed left-1/2 top-1/2 z-[101] max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card p-[clamp(16px,4vw,24px)] text-card-foreground shadow-2xl [overflow-wrap:anywhere]" onEscapeKeyDown={()=>finish(false)}>
   <AlertDialog.Title className="text-lg font-semibold">Konfirmasi tindakan</AlertDialog.Title><AlertDialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">{message}</AlertDialog.Description>
   <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><AlertDialog.Cancel asChild><Button type="button" className="min-w-0 max-w-full whitespace-normal" variant="outline" onClick={()=>finish(false)}>Batal</Button></AlertDialog.Cancel><AlertDialog.Action asChild><Button type="button" className="min-w-0 max-w-full whitespace-normal" onClick={()=>finish(true)}>Lanjutkan</Button></AlertDialog.Action></div>
  </AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>);
 });
}
