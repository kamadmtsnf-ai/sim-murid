/** Actual help component, isolated local browser; not human UAT. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd();
const out = process.env.BULK_QA_OUTPUT ?? join(root, "docs/verification/bulk");
await mkdir(out, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), "sim-directory-"));
const req = createRequire(import.meta.url),
  runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { chromium } = runtime
  ? req(join(runtime, "playwright"))
  : req("playwright");
const tools = process.env.UI_TEST_TOOLS ?? join(root, "node_modules");
const { build } = await import(
  pathToFileURL(join(tools, "esbuild/lib/main.js"))
);
const axe = await readFile(join(tools, "axe-core/axe.min.js"), "utf8");
await build({
  entryPoints: [join(root, "tests/ui/bulk-fixture.tsx")],
  outfile: join(temp, "fixture.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  tsconfig: join(root, "tsconfig.json"),
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  plugins: [
    {
      name: "fixture-navigation",
      setup(b) {
        b.onResolve({ filter: /^@\/lib\/supabase\/environment$/ }, () => ({
          path: "fixture-env",
          namespace: "fixture-env",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture-env" }, () => ({
          contents:
            'export const getSupabasePublicEnvironment=()=>({url:"https://example.org",publishableKey:"synthetic"});',
          loader: "js",
        }));
        b.onResolve({ filter: /^next\/image$/ }, () => ({
          path: join(root, "tests/ui/settings-image-shim.ts"),
        }));
        b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({
          path: join(root, "tests/ui/promotions-storage-shim.ts"),
        }));
        b.onResolve({ filter: /^next\/navigation$/ }, () => ({
          path: join(root, "tests/ui/overview-navigation-shim.ts"),
        }));
      },
    },
  ],
});
const css = [];
async function styles(dir) {
  for (const f of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) await styles(p);
    else if (p.endsWith(".css")) css.push(await readFile(p, "utf8"));
  }
}
await styles(process.env.UI_CSS_ROOT ?? join(root, ".next/static"));
const server = createServer(async (request, response) => {
  if (request.url === "/fixture.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(await readFile(join(temp, "fixture.js")));
  } else if (request.url === "/fixture.css") {
    response.setHeader("Content-Type", "text/css");
    response.end(css.join("\n"));
  } else {
    response.setHeader("Content-Type", "text/html");
    response.end(
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Design System QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const checks = [],
  accessibility = [],
  errors = [];
function check(v, name) {
  checks.push({ name, passed: !!v });
  assert.ok(v, name);
}
let browser, page;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.UI_CHROMIUM_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  const {registerHooks}=await import('node:module');const {existsSync}=await import('node:fs');
  registerHooks({resolve(s,c,n){if(s.startsWith('.')&&!/\.[cm]?[jt]sx?$/.test(s)&&c.parentURL?.startsWith('file:')){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return {url:u.href,shortCircuit:true};}return n(s,c);}});
  const {excelBytes,EXCEL_MIME}=await import('../src/lib/spreadsheets/write.ts'),{parseBulkRows}=await import('../src/lib/bulk/rows.ts'),{headers,bulkTemplates}=await import('../src/lib/bulk/validation.ts');
  const {default:ExcelJS}=await import('exceljs');
  let mode='ok',posts=[];const stored=new Map();
  async function parse(body){const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(body.workbook,'base64'));const records=[];book.getWorksheet('Data').eachRow({includeEmpty:true},row=>records.push(headers[body.domain].map((_,i)=>String(row.getCell(i+1).value??''))));return parseBulkRows(records,body.domain);}
  await page.route('**/api/bulk-input**',async route=>{
   const request=route.request(),url=new URL(request.url()),body=request.method()==='POST'?request.postDataJSON():null;
   if(url.pathname.endsWith('/workbook')){
    if(!body){const domain=url.searchParams.get('domain');return route.fulfill({body:Buffer.from(await excelBytes(headers[domain],bulkTemplates[domain])),contentType:EXCEL_MIME,headers:{'Content-Disposition':'attachment; filename="template.xlsx"'}});}
    return route.fulfill({json:{preview:await parse(body)}});
   }
   if(!body)return route.fulfill({json:{result:stored.get(url.searchParams.get('requestId'))??{code:'not_found'}}});
   posts.push(body);const parsed=await parse(body);const result={code:body.action==='preview'?'ready':'saved',requestId:body.requestId,revision:7,rows:Array.from({length:parsed.count},(_,i)=>({row:i+2,code:body.action==='preview'?'valid':'saved'}))};
   if(body.action==='commit'){
    if(mode==='lost'){stored.set(body.requestId,result);return route.abort();}
    if(mode==='stale')return route.fulfill({status:409,json:{result:{code:'stale'}}});
    if(mode==='wrong')return route.fulfill({json:{result:{...result,requestId:'00000000-0000-4000-8000-000000000088'}}});
    if(mode==='denied')return route.fulfill({status:403,json:{message:'Denied'}});
    stored.set(body.requestId,result);
   }
   return route.fulfill({json:{result}});
  });
  page.on('dialog',d=>d.accept());
  const titles={enrollment:'Impor penempatan siswa',grades:'Impor nilai',schedules:'Impor jadwal KBM'};
  async function visit(domain='enrollment',rows=bulkTemplates[domain]){
   await page.goto(base+'/?domain='+domain);await page.getByRole('button',{name:titles[domain],exact:true}).click();
   if(domain!=='schedules')await page.getByLabel(domain==='grades'?'Tanggal penilaian':'Tanggal mulai penempatan',{exact:true}).fill('2026-10-24');
   await page.getByLabel('Unggah Excel (.xlsx)').setInputFiles({name:'data.xlsx',mimeType:EXCEL_MIME,buffer:Buffer.from(await excelBytes(headers[domain],rows))});
   await page.getByRole('button',{name:'Validasi dan pratinjau',exact:true}).waitFor({state:'visible'});
   await page.waitForFunction(()=>!document.body.textContent.includes('Memeriksa berkas Excel'));
  }
  async function preview(){await page.getByRole('button',{name:'Validasi dan pratinjau',exact:true}).click();await page.getByText('Validasi sumber berhasil.',{exact:false}).waitFor();}
  async function commit(){await page.getByLabel('Saya sudah memeriksa',{exact:false}).check();await page.getByRole('button',{name:'Konfirmasi simpan batch',exact:true}).click();}
  async function report(label){const waiting=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();const d=await waiting;const book=new ExcelJS.Workbook();await book.xlsx.readFile(await d.path());return book.getWorksheet('Data');}
  for(const domain of ['enrollment','grades','schedules'])for(const width of [320,390,768,1440]){
   mode='ok';posts=[];await page.setViewportSize({width,height:850});await visit(domain);await preview();
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   check(posts.length===1&&posts[0].action==='preview','preview only before confirmation '+domain+width);
   check(await page.getByRole('dialog').evaluate(e=>e.scrollTop===0),'focus does not scroll hidden dialog shell '+domain+width);
   const shell=await page.getByRole('dialog').boundingBox(),title=await page.getByRole('heading',{name:titles[domain],exact:true}).boundingBox(),close=await page.getByRole('button',{name:'Tutup dialog',exact:true}).boundingBox();check(title.y>=shell.y&&close.y>=shell.y&&title.y+title.height<=shell.y+shell.height&&close.y+close.height<=shell.y+shell.height,'title and close remain inside dialog '+domain+width);
   check(await page.getByRole('button',{name:'Konfirmasi simpan batch',exact:true}).isDisabled(),'explicit confirm '+domain+width);
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow '+domain+width);
   if(domain!=='schedules')check(await page.locator('td').getByText('001-02',{exact:true}).count()===1,'exact text identity '+domain+width);
   await page.addScriptTag({content:axe});const result=await page.evaluate(()=>window.axe.run(document.querySelector('[role=dialog]'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));accessibility.push({label:domain+width,violations:result.violations});check(!result.violations.length,'axe '+domain+width);
   if(width===320&&domain==='enrollment')await page.screenshot({path:join(out,"bulk-preview-320.png")});
   await commit();await page.getByText('Seluruh batch tersimpan.',{exact:false}).waitFor();check(posts.filter(p=>p.action==='commit').length===1,'single commit '+domain+width);if(width===320){const saved=await report('Unduh laporan impor');check(saved.getCell('B2').value==='Tersimpan','confirmed Excel result '+domain);}
  }
  mode='ok';posts=[];await visit('enrollment',[['a'],['a']]);check(await page.getByRole('list',{name:'Masalah Excel'}).isVisible(),'duplicate worksheet rows shown');check(posts.length===0,'invalid sheet never calls commit');const invalid=await report('Unduh daftar kesalahan');check(invalid.getCell('A2').value===3,'duplicate error report uses original worksheet row');
  for(const scenario of ['lost','wrong','stale','denied']){
   mode='ok';posts=[];await visit();await preview();mode=scenario;await commit();
   if(scenario==='denied'){await page.getByText('Sesi atau akses berubah.',{exact:false}).waitFor();check(!await page.getByRole('button',{name:'Konfirmasi simpan batch',exact:true}).count(),'revoked access blocks import');}
   else if(scenario==='stale'){await page.getByText('Data berubah',{exact:false}).first().waitFor();check(posts.filter(p=>p.action==='commit').length===1,'stale not retried');}
   else{await page.getByRole('button',{name:'Periksa hasil',exact:true}).waitFor();check(posts.filter(p=>p.action==='commit').length===1,'uncertain not retried '+scenario);if(scenario==='lost'){const uncertain=await report('Unduh laporan impor');check(uncertain.getCell('C2').value==='Hasil penyimpanan belum dapat dipastikan','uncertain report does not reuse ready as saved');await page.getByRole('button',{name:'Periksa hasil',exact:true}).click();await page.getByText('Seluruh batch tersimpan.',{exact:false}).waitFor();check(posts.filter(p=>p.action==='commit').length===1,'readback reconciles without duplicate');}}
  }
  check((await page.evaluate(()=>Object.keys(localStorage))).every(k=>!k.includes('bulk')),'workbooks not persisted in browser storage');
  check(!errors.length, "no JavaScript errors");
  await writeFile(
    join(out, "results.json"),
    JSON.stringify({ checks, accessibility, errors }, null, 2),
  );
  console.log(
    JSON.stringify({
      checks: checks.length,
      axe: accessibility.length,
      errors,
    }),
  );
} catch (e) {
  if (page) await writeFile(join(out, "page.html"), await page.content());
  throw e;
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
