import {timingSafeEqual} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {privateJson} from '@/lib/auth/http';
import {senderConfiguration} from '@/lib/push/sender-config';
import {pushRepository} from '@/lib/push/repository';
import {runPushWorker} from '@/lib/push/worker';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:NextRequest){
 const expected=process.env.WEB_PUSH_WORKER_SECRET,header=request.headers.get('authorization'),token=header?.startsWith('Bearer ')?header.slice(7):'';
 if(!expected||!/^[A-Za-z0-9_-]{43,128}$/.test(expected)||!token||Buffer.byteLength(token)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(token),Buffer.from(expected)))return privateJson({message:'Akses ditolak.'},401);
 if(new URL(request.url).search)return privateJson({message:'Permintaan tidak valid.'},400);
 const config=senderConfiguration(request.url);if(!config)return privateJson({message:'Konfigurasi push belum tersedia.'},503);
 try{const outcome=await runPushWorker(pushRepository(),config);const uncertain=outcome.code==='unconfirmed'||outcome.metrics.unconfirmed>0;return privateJson(outcome,uncertain?503:200);}catch{return privateJson({message:'Worker push belum tersedia. Hasil yang belum tercatat akan diperiksa melalui lease.'},503);}
}
