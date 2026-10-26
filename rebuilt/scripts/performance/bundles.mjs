/** Compiler-specific dependency estimates, not transferred page bytes or field CWV. */
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const profiles={operations:['duty','attendance','mentoring','committee','savings'],learning:['grades','reports','promotions','books'],services:['jobs','reconciliation','discipline','surveys','notifications','insights-workspace']};
const symbols={duty:'DutyPanel',attendance:'AttendancePanel',mentoring:'MentoringPanel',committee:'CommitteePanel',savings:'SavingsPanel',grades:'GradesPanel',reports:'ReportsPanel',promotions:'PromotionsPanel',books:'BooksPanel',jobs:'JobsPanel',reconciliation:'ReconciliationPanel',discipline:'DisciplinePanel',surveys:'SurveysPanel',notifications:'NotificationsPanel','insights-workspace':'InsightsWorkspace'};
const result={kind:'static dependency-set upper bound; compiler-specific; not whole-page/network bytes',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),buildId:(await readFile('.next/BUILD_ID','utf8')).trim(),profiles:[],selectors:{}};
for(const [group,names] of Object.entries(profiles)){
 const route=`/account/${group}/[module]/page`;
 const ctx={}; vm.runInNewContext(await readFile(`.next/server/app${route}_client-reference-manifest.js`,'utf8'),ctx);
 const refs=ctx.__RSC_MANIFEST[route].clientModules;
 result.selectors[group]=createHash('sha256').update(await readFile(`src/app/account/${group}/[module]/panel.tsx`)).digest('hex');
 let lazy={};try{lazy=JSON.parse(await readFile(`.next/server/app${route}/react-loadable-manifest.json`,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const deferred=[];
 for(const entry of Object.values(lazy)){
  const files=entry.files.filter(f=>f.endsWith('.js'));
  const source=(await Promise.all(files.map(f=>readFile(`.next/${f}`,'utf8')))).join('\n');
  const matches=names.filter(n=>source.includes(`"${symbols[n]}"`));
  deferred.push({files,matches,followUp:source.includes('"FollowUpCenter"')});
 }
 for(const name of names){
  const suffix=name==='insights-workspace'?'insights-workspace.tsx':`${name}-panel.tsx`;
  const entry=Object.entries(refs).find(([key])=>key.endsWith(`/${suffix}`))??Object.entries(refs).find(([key])=>key.endsWith('/panel.tsx'));
  if(!entry)throw Error(`Missing boundary ${group}/${name}`);
  const files=new Set(entry[1].chunks.filter(f=>f.endsWith('.js')).map(f=>f.replace(/^\/_next\//,'')));
  for(const d of deferred)if(d.matches.includes(name)||(name==='notifications'&&d.followUp)||(!d.matches.length&&!d.followUp))d.files.forEach(f=>files.add(f));
  let rawBytes=0,gzipBytes=0;for(const f of files){const bytes=await readFile(`.next/${f}`);rawBytes+=bytes.length;gzipBytes+=gzipSync(bytes).length;}
  result.profiles.push({group,name,boundary:entry[0],chunks:[...files].sort(),rawBytes,gzipBytes,unknownDeferredGroups:deferred.filter(d=>!d.matches.length&&!d.followUp).length});
 }
}
await writeFile(process.argv[2]??'/tmp/l09-bundles.json',JSON.stringify(result,null,2)+'\n');
