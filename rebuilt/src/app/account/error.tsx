"use client";
import Link from "next/link";
import {Button} from "@/components/ui/button";
import {Status} from "@/components/ui/status";
export default function AccountError({reset}:{error:Error&{digest?:string};reset:()=>void}){return <main id="main-content" className="space-y-5"><h1 className="text-2xl font-semibold">Layanan belum dapat dimuat</h1><Status tone="error">Periksa koneksi dan coba kembali. Jika masalah berulang, hubungi administrator madrasah.</Status><div className="flex flex-wrap gap-3"><Button onClick={reset}>Coba kembali</Button><Button variant="outline" asChild><Link href="/account">Kembali ke dashboard</Link></Button></div></main>;}
