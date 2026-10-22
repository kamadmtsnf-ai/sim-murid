"use client";
import {Button} from "@/components/ui/button";
import {Status} from "@/components/ui/status";
export default function AccountError({reset,title="Layanan belum dapat dimuat"}:{title?:string;error:Error&{digest?:string};reset:()=>void}){return <main id="main-content" tabIndex={-1} className="space-y-5"><h1 className="text-2xl font-semibold">{title}</h1><Status tone="error">Periksa koneksi dan coba kembali. Jika masalah berulang, hubungi administrator madrasah.</Status><div className="flex flex-wrap gap-3"><Button onClick={reset}>Coba kembali</Button></div></main>;}
