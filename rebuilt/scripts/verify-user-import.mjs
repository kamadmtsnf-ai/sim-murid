/** Actual help component, isolated local browser; not human UAT. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd();
const out = process.env.USER_IMPORT_QA_OUTPUT ?? join(root, "docs/verification/user-import");
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
  entryPoints: [join(root, "tests/ui/import-users-fixture.tsx")],
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
  const {excelBytes,EXCEL_MIME}=await import('../src/lib/spreadsheets/write.ts');
  const {default:ExcelJS}=await import('exceljs');
  const heads=['username','full_name','role','contact_email'];
  let mode='ok',posts=[],previewPosts=0;const created=new Map();
  await page.route('**/api/directory/users**',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.pathname.endsWith('/import')){
      if(request.method()==='GET')return route.fulfill({body:Buffer.from(await excelBytes(heads,[],['Username Text; kode peran student/teacher/admin.'])),contentType:EXCEL_MIME,headers:{'Content-Disposition':'attachment; filename="template-pengguna.xlsx"'}});
      previewPosts++;const b=request.postDataJSON();
      const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(b.workbook,'base64'));const data=book.getWorksheet('Data');
      const rows=[];data.eachRow((row,n)=>{if(n>1)rows.push({username:String(row.getCell(1).value??''),fullName:String(row.getCell(2).value??''),role:String(row.getCell(3).value??''),contactEmail:String(row.getCell(4).value??'')});});
      if(mode==='invalid')return route.fulfill({status:422,json:{message:'Username sudah terdaftar.',issues:[{row:2,message:'Username sudah terdaftar.'}],quality:{count:1,valid:0,invalid:1,percentage:0}}});
      return route.fulfill({json:{rows,count:rows.length}});
    }
    const body=request.postDataJSON();posts.push(body);
    if(mode==='lost'){created.set(body.requestId,body.username);mode='ok';return route.abort();}
    if(mode==='rate')return route.fulfill({status:429,json:{message:'rate_limited',retryable:false}});
    if(mode==='duplicate')return route.fulfill({status:409,json:{message:'Username sudah ada.',retryable:false}});
    created.set(body.requestId,body.username);return route.fulfill({status:201,json:{created:true,username:body.username}});
  });
  page.on('dialog',d=>d.accept());
  async function open(rows=[['001-02','Nama','student',''],['1-2','Guru','teacher','g@example.org']]){
    await page.goto(base);await page.getByRole('button',{name:'Impor pengguna Excel'}).click();
    const bytes=await excelBytes(heads,rows);await page.getByLabel('Unggah Excel pengguna').setInputFiles({name:'pengguna.xlsx',mimeType:EXCEL_MIME,buffer:Buffer.from(bytes)});
    await page.getByText('Pratinjau valid.',{exact:false}).waitFor();
  }
  async function backup(){const download=page.waitForEvent('download');await page.getByRole('button',{name:'Unduh kredensial sementara'}).click();const d=await download;const book=new ExcelJS.Workbook();await book.xlsx.readFile(await d.path());check(book.getWorksheet('Data').getRow(2).getCell(1).value==='001-02','credential export preserves identity');check(String(book.getWorksheet('Data').getRow(2).getCell(4).value).startsWith('Aa1_'),'temporary credentials exported as text');await page.getByRole('checkbox',{name:/Saya sudah menyimpan/}).check();}
  async function start(label){await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Ya, proses akun',exact:true}).click();}
  async function report(label){const waiting=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();const download=await waiting;const book=new ExcelJS.Workbook();await book.xlsx.readFile(await download.path());return book.getWorksheet('Data');}
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:850});await open();
    check(await page.getByRole('button',{name:'Mulai impor pengguna'}).isDisabled(),'no write before backup/confirmation '+width);
    check(posts.length===0,'preview never creates accounts '+width);
    const download=page.waitForEvent('download');await page.getByRole('link',{name:'Unduh template Excel'}).click();const d=await download;check(d.suggestedFilename().endsWith('.xlsx'),'template Excel download '+width);
    await backup();
    if(width===320)await page.screenshot({path:join(out,"user-preview-320.png")});
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow '+width);
    await page.addScriptTag({content:axe});const result=await page.evaluate(()=>window.axe.run(document.body,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));accessibility.push({label:width,violations:result.violations});check(!result.violations.length,'axe '+width);
  }
  posts=[];mode='ok';await open();await backup();await page.getByRole('button',{name:'Mulai impor pengguna'}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Batal',exact:true}).click();check(posts.length===0,'ordinary import also requires explicit confirmation');
  const before=await report('Unduh laporan impor');check(before.getCell('B2').value==='001-02','result report keeps literal username');check(!JSON.stringify(before.getSheetValues()).includes('Aa1_'),'result report excludes temporary passwords');check(before.getCell('C2').value==='Belum diproses','preview report does not claim creation');
  await page.evaluate(()=>{window.originalReportURL=URL.createObjectURL;URL.createObjectURL=()=>{throw Error('synthetic download failure');};});
  await page.getByRole('button',{name:'Unduh laporan impor',exact:true}).click();await page.getByText('Laporan belum dapat diunduh',{exact:true}).waitFor();check(posts.length===0,'failed report never submits import');check(await page.getByRole('button',{name:'Mulai impor pengguna'}).isEnabled(),'report failure preserves checked draft');
  await page.evaluate(()=>{URL.createObjectURL=window.originalReportURL;});const recovered=await report('Unduh laporan impor');check(recovered.getCell('B2').value==='001-02','report export can recover without changing draft');
  posts=[];mode='lost';await open();await backup();await start('Mulai impor pengguna');
  await page.getByText('Impor dijeda.',{exact:false}).waitFor();check(posts.length===1,'uncertain stops next row');const frozen={...posts[0]};const uncertain=await report('Unduh laporan impor');check(uncertain.getCell('C2').value==='Belum dapat dipastikan','lost-response report remains uncertain');
  await start('Lanjutkan baris belum selesai');await page.getByText('2/2 berhasil',{exact:false}).waitFor();check(JSON.stringify(posts[1])===JSON.stringify(frozen),'retry uses identical ID and password');check(created.size===2,'idempotent recovery does not duplicate account');const completed=await report('Unduh laporan impor');check(completed.getCell('C2').value==='Berhasil dibuat','confirmed report reflects creation');
  mode='rate';posts=[];created.clear();await open();await backup();await start('Mulai impor pengguna');await page.getByText('Menunggu batas waktu',{exact:false}).waitFor();check(posts.length===1,'rate limit stops processing');mode='ok';await start('Lanjutkan baris belum selesai');await page.getByText('2/2 berhasil',{exact:false}).waitFor();check(posts[0].requestId===posts[1].requestId,'rate resume preserves request identity');
  mode='ok';posts=[];await open([['001-02','Admin QA','admin','']]);await backup();await page.getByRole('button',{name:'Mulai impor pengguna'}).click();await page.getByRole('alertdialog').waitFor();check(await page.getByRole('alertdialog').getByText(/1 akun Admin dengan kewenangan penuh/).count()===1,'admin privilege warning remains explicit');await page.getByRole('alertdialog').getByRole('button',{name:'Batal',exact:true}).click();check(posts.length===0,'admin escalation requires confirmation');
  mode='invalid';await page.goto(base);await page.getByRole('button',{name:'Impor pengguna Excel'}).click();await page.getByLabel('Unggah Excel pengguna').setInputFiles({name:'pengguna.xlsx',mimeType:EXCEL_MIME,buffer:Buffer.from(await excelBytes(heads,[['001-02','Nama','student','']]))});await page.getByRole('list',{name:'Masalah impor pengguna'}).waitFor();check(posts.length===0,'invalid/existing rows do not create users');check(previewPosts>0,'workbook inspected before creation');const errorSheet=await report('Unduh daftar kesalahan');check(errorSheet.getCell('A2').value===2,'error report retains Excel source row');check(errorSheet.getCell('B2').value==='Username sudah terdaftar.','error report explains correction');check(await page.getByText(/0\/1 baris valid/).count()===1,'quality summary is explicit');
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
