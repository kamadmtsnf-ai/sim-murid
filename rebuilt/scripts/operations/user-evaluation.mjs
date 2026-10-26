import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { uatScenarios } from './release-gates.mjs';
/** Extends the P11 task protocol; scenarios reuse P10's role/assignment taxonomy. */
export const userTasks = [
 ['A01','admin','Akun baru, password sementara, login ulang dan email/OTP'],
 ['A02','admin','Impor Excel: pratinjau, kesalahan baris dan retry tanpa akun ganda'],
 ['A03','admin','Tugas tambahan guru: beri, akhiri, lalu periksa penolakan akses'],
 ['A04','school_head','Ringkasan dan tindak lanjut sesuai cakupan'],
 ['A05','subject_teacher','Absensi pertemuan: simpan, cek riwayat, tolak kelas asing'],
 ['A06','subject_teacher','Input nilai: periode benar, hasil sesuai rumus existing'],
 ['A07','homeroom','Pratinjau rapor kelas binaan tanpa mengubah arsip terbit'],
 ['A08','mentor','Catat bimbingan siswa binaan dan tolak siswa asing'],
 ['A09','duty','Absensi harian sesuai roster dan tanggal WIB'],
 ['A10','duty','Piket pengganti: akses aktif lalu penolakan saat dibatalkan/kedaluwarsa'],
 ['A11','counselor','Tindak lanjut sesuai cakupan dan penolakan tanpa tugas aktif'],
 ['A12','committee_treasurer','Pembayaran komite: alokasi, riwayat dan retry tidak ganda'],
 ['A13','savings_manager','Setor/tarik: saldo, fee, slip dan ledger cocok'],
 ['A14','student','Onboarding biodata, email dan pertanyaan tidak saling melewati'],
 ['A15','student','Jadwal, survei dan rapor sendiri; data siswa asing ditolak'],
 ['A16','parent_multi_child','Pindah anak: cakupan benar termasuk setelah relasi dicabut'],
 ['A17','alumni','Dokumen kelulusan sesuai izin'],
 ['A18','customer','Rekening/transaksi sendiri, rekening asing ditolak'],
 ['A19','applicant','Biodata calon siswa tanpa akses akademik aktif'],
 ['A20','admin','Logout dibatalkan/disetujui serta sesi lama ditolak'],
 ['A21','subject_teacher','Timeout/offline: status belum pasti diperiksa tanpa submit ganda'],
].map(([id,scenario,label])=>({id,scenario,label}));
if(userTasks.some(t=>!uatScenarios.includes(t.scenario)))throw Error('Task scenario outside existing role matrix');
const sha=z.string().regex(/^[a-f0-9]{40}$/), digest=z.string().regex(/^[a-f0-9]{64}$/);
const task=z.enum(userTasks.map(t=>t.id));
const observation=z.object({
 id:z.string().regex(/^O[0-9]{1,6}$/),participant:z.string().regex(/^P[0-9]{1,4}$/),task,
 phase:z.enum(['baseline','after']),commit:sha,dataset:digest,repetition:z.number().int().min(1).max(100),
 viewport:z.enum(['mobile','tablet','desktop']),durationSeconds:z.number().finite().positive().max(86400),
 outcome:z.enum(['success','failure','aborted']),errors:z.number().int().min(0).max(10000),
 reentries:z.number().int().min(0).max(10000),assistance:z.number().int().min(0).max(10000),
 domainMatched:z.boolean(),unauthorizedAccessDenied:z.boolean(),duplicateMutationPrevented:z.boolean(),
}).strict();
export const evaluationSchema=z.object({
 version:z.literal(1),kind:z.enum(['human','simulation']),environment:z.enum(['staging','isolated']),
 consentRecorded:z.boolean(),operatorAttested:z.boolean(),evidenceSha256:digest.nullable(),
 baselineCommit:sha,afterCommit:sha,targetSuccessRate:z.number().min(0.95).max(1),
 observations:z.array(observation).max(10000),
 findings:z.array(z.object({id:z.string().regex(/^F[0-9]{1,6}$/),task,severity:z.enum(['P0','P1','P2']),
 status:z.enum(['open','retest_passed']),fixCommit:sha.nullable(),retestObservation:z.string().regex(/^O[0-9]{1,6}$/).nullable(),
 }).strict()).max(1000),
}).strict();
const median=values=>{if(!values.length)return null;const a=[...values].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
const successful=o=>o.outcome==='success'&&o.domainMatched&&o.unauthorizedAccessDenied&&o.duplicateMutationPrevented;
const stats=rows=>({attempts:rows.length,successful:rows.filter(successful).length,successRate:rows.length?rows.filter(successful).length/rows.length:null,medianSeconds:median(rows.map(o=>o.durationSeconds)),assistance:rows.reduce((n,o)=>n+o.assistance,0),errors:rows.reduce((n,o)=>n+o.errors,0),reentries:rows.reduce((n,o)=>n+o.reentries,0)});
export function evaluateUserTasks(input){
 const e=evaluationSchema.parse(input),blocked=[];
 if(e.kind!=='human'||e.environment!=='staging'||!e.consentRecorded||!e.operatorAttested||!e.evidenceSha256)blocked.push('Human staging evidence, consent and operator attestation required');
 if(e.baselineCommit===e.afterCommit)blocked.push('Baseline and after commits must differ');
 const ids=new Set(),keys=new Set();
 for(const o of e.observations){
  const key=JSON.stringify([o.participant,o.task,o.dataset,o.repetition,o.phase]);
  if(ids.has(o.id)||keys.has(key))blocked.push('Duplicate observation or attempt');ids.add(o.id);keys.add(key);
  if(o.commit!==(o.phase==='baseline'?e.baselineCommit:e.afterCommit))blocked.push('Observation commit does not match phase');
  if(o.outcome==='success'&&!successful(o))blocked.push('Claimed success has failed domain/access/duplicate checks');
  if((!o.domainMatched||!o.unauthorizedAccessDenied||!o.duplicateMutationPrevented)&&!e.findings.some(f=>f.task===o.task&&f.severity==='P0'&&f.status==='retest_passed'))blocked.push(o.task+': integrity/access failure requires critical triage and retest');
 }
 const tasks=userTasks.map(t=>{
  const rows=e.observations.filter(o=>o.task===t.id),before=rows.filter(o=>o.phase==='baseline'),after=rows.filter(o=>o.phase==='after');
  const pairKey=o=>JSON.stringify([o.participant,o.dataset,o.repetition,o.viewport]);
  const pairs=new Set(before.map(pairKey));
  const paired=before.length===after.length&&after.every(o=>pairs.has(pairKey(o)));
  if(before.length<3||after.length<3||!paired)blocked.push(t.id+': at least three comparable baseline/after attempts required');
  const b=stats(before),a=stats(after);
  if(a.successRate!==null&&a.successRate<e.targetSuccessRate)blocked.push(t.id+': target task success rate not met');
  return {...t,baseline:b,after:a,comparable:paired&&before.length>=3,medianChangeSeconds:paired&&b.medianSeconds!==null&&a.medianSeconds!==null?a.medianSeconds-b.medianSeconds:null};
 });
 const findings=new Set();
 for(const f of e.findings){
  if(findings.has(f.id))blocked.push('Duplicate finding');findings.add(f.id);
  if(f.severity!=='P2'&&f.status!=='retest_passed')blocked.push(f.id+': unresolved critical finding');
  if(f.status==='retest_passed'){
   const o=e.observations.find(o=>o.id===f.retestObservation);
   if(f.fixCommit!==e.afterCommit||!o||o.task!==f.task||o.phase!=='after'||!successful(o))blocked.push(f.id+': missing matching successful retest');
  }
 }
 return {status:blocked.length?'blocked':'evidence_complete',ready:blocked.length===0,sourceKind:e.kind,
 scope:'Operator-submitted evidence validated structurally; not independent proof of human participation or production release approval.',
 baselineCommit:e.baselineCommit,afterCommit:e.afterCommit,targetSuccessRate:e.targetSuccessRate,
 blocked:[...new Set(blocked)],tasks,findings:{total:e.findings.length,open:e.findings.filter(f=>f.status==='open').length},
 };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [input,output]=process.argv.slice(2);
  if(!input||!output||resolve(input)===resolve(output))throw Error();
  const bytes=await readFile(input);if(bytes.length>1048576)throw Error();
  const result=evaluateUserTasks(JSON.parse(bytes.toString('utf8')));
  await writeFile(output,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({status:result.status,tasks:result.tasks.length,blocked:result.blocked.length}));
  if(!result.ready)process.exitCode=2;
 }catch{console.error('Evaluation input invalid or unavailable. Use the documented redacted schema; no input details logged.');process.exitCode=1;}
}
