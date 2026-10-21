"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useWorkspace} from "./workspace-shell";
export function ModuleNavigation({base,titles,label}:{base:string;titles:Record<string,string>;label:string}){const path=usePathname(),workspace=useWorkspace();const visible=workspace?.navigation.flatMap(g=>g.items).map(i=>i.href);return <nav className="module-navigation" aria-label={label}>{Object.entries(titles).filter(([key])=>!visible||visible.includes(base+key)).map(([key,title])=><Link prefetch={false} key={key} href={base+key} aria-current={path===base+key?"page":undefined}>{title}</Link>)}</nav>;}
