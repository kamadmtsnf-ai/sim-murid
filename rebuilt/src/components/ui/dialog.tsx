"use client";
import {Dialog as Primitive} from "radix-ui";
import {X} from "lucide-react";
import type {ReactNode,RefObject} from "react";
import {Button} from "./button";
import {cn} from "@/lib/utils";
export function Dialog({open,onOpenChange,title,description,trigger,children,className,returnFocusRef,closeDisabled=false,onEscapeKeyDown}:{open:boolean;onOpenChange:(open:boolean)=>void;title:string;description:string;trigger?:ReactNode;children:ReactNode;className?:string;closeDisabled?:boolean;onEscapeKeyDown?:(event:KeyboardEvent)=>void;returnFocusRef?:RefObject<HTMLElement|null>}){
 return <Primitive.Root open={open} onOpenChange={onOpenChange}>
  {trigger&&<Primitive.Trigger asChild>{trigger}</Primitive.Trigger>}
  <Primitive.Portal><Primitive.Overlay className="dialog-overlay fixed inset-0 z-40 bg-foreground/45"/>
   <Primitive.Content onEscapeKeyDown={onEscapeKeyDown} className={cn("dialog-content min-w-0 [overflow-wrap:anywhere] fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-card shadow-xl",className)} onPointerDownOutside={e=>e.preventDefault()} onCloseAutoFocus={e=>{if(returnFocusRef?.current?.isConnected){e.preventDefault();returnFocusRef.current.focus();}}}>
    <div className="flex shrink-0 items-start justify-between gap-4 border-b p-5"><div className="min-w-0"><Primitive.Title className="text-xl font-semibold">{title}</Primitive.Title><Primitive.Description className="mt-1 text-sm text-muted-foreground">{description}</Primitive.Description></div><Primitive.Close asChild><Button type="button" variant="ghost" size="icon" aria-label="Tutup dialog" disabled={closeDisabled}><X aria-hidden="true"/></Button></Primitive.Close></div>
    <div className="min-h-0 overflow-y-auto p-5">{children}</div>
   </Primitive.Content>
  </Primitive.Portal>
 </Primitive.Root>;
}
