'use client';
import type {ReactNode} from 'react';
export const controlClass='mt-1 w-full rounded border bg-background p-2';
export function TextField({label,name,value='',type='text',required=false,max=200}:{label:string;name:string;value?:string|undefined;type?:string;required?:boolean;max?:number}){return <label className="block text-sm">{label}<input name={name} type={type} className={controlClass} defaultValue={value} required={required} maxLength={max}/></label>;}
export function SelectField({label,name,value='',children,required=false}:{label:string;name:string;value?:string|undefined;children:ReactNode;required?:boolean}){return <label className="block text-sm">{label}<select name={name} defaultValue={value} className={controlClass} required={required}>{children}</select></label>;}
