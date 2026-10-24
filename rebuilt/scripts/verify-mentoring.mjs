/** Isolated Mentoring browser regression suite. No real account, API mutation or production data. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd(),
  baseline = process.argv.includes("--baseline");
const out =
  process.env.MENTORING_QA_OUTPUT ??
  join(root, "docs/verification/mentoring");
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
  entryPoints: [join(root, "tests/ui/mentoring-fixture.tsx")],
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
        b.onResolve({ filter: /^next\/navigation$/ }, () => ({
          path: join(root, "tests/ui/mentoring-navigation-shim.ts"),
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Absensi QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const checks = [],
  issues = [],
  errors = [],
  axeResults = [];
let browser;
function check(ok, name, detail) {
  checks.push({ name, passed: !!ok, ...(detail ? { detail } : {}) });
  if (!ok) {
    issues.push(name);
    if (!baseline) assert.fail(name + " " + JSON.stringify(detail ?? ""));
  }
}
async function geometry(page, name) {
  const size = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  if (size.document > size.viewport + 1 && !baseline) {
    const nodes = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .map((e) => ({
          tag: e.tagName,
          class: e.className,
          text: e.textContent?.slice(0, 50),
          x: e.getBoundingClientRect().x,
          right: e.getBoundingClientRect().right,
          width: e.getBoundingClientRect().width,
        }))
        .filter((e) => e.right > innerWidth + 1 && e.x >= 0)
        .slice(0, 30),
    );
    await writeFile(
      join(out, "overflow-diagnostic.json"),
      JSON.stringify(nodes, null, 2),
    );
  }
  check(
    size.document <= size.viewport + 1,
    name + " no horizontal overflow",
    size,
  );
}
async function a11y(page, name) {
  await page.evaluate(axe);
  const r = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"],
      },
    }),
  );
  const violations = r.violations.map((v) => ({
    id: v.id,
    targets: v.nodes.map((n) => n.target),
  }));
  axeResults.push({ name, violations });
  check(!violations.length, name + " axe", violations);
}
try {
 browser=await chromium.launch({headless:true,executablePath:process.env.UI_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const page=await browser.newPage({hasTouch:true});page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 let posts=[],gets=[],reply='success';
 await page.route('**/api/operations/mentoring?*',async route=>{
  const request=route.request(),data=await page.evaluate(()=>window.mentoringFixture),q=new URL(request.url()).searchParams;
  if(request.method()==='GET'){
   gets.push(request.url());if(reply==='read-error')return route.fulfill({status:503,json:{message:'Unavailable'}});
   data.page=Number(q.get('page')??1);data.people=[];return route.fulfill({json:{data}});
  }
  posts.push(request.postDataJSON());if(reply==='network')return route.abort();if(reply==='hang')return;
  if(reply==='slow')await new Promise(r=>setTimeout(r,700));
  if(['stale','denied','invalid','duplicate'].includes(reply))return route.fulfill({status:reply==='denied'?403:409,json:{code:reply,result:{code:reply},message:'Perubahan ditolak: '+reply}});
  if(reply==='malformed')return route.fulfill({json:{result:{code:'saved'},data:{revision:-1}}});
  if(reply==='removed'){data.rows=[];data.total=0;}
  data.revision = route.request().postDataJSON().revision + 1;return route.fulfill({json:{result:{code:'saved'},code:'saved',data,message:'Perubahan berhasil disimpan.'}});
 });
 async function visit(mode='normal',width=375,height=812){reply='success';posts=[];gets=[];await page.setViewportSize({width,height});await page.goto(base+'/?mode='+mode);await page.getByRole('heading',{level:1}).waitFor();}
 const dialog=()=>page.getByRole('dialog'),history=()=>page.getByRole('region',{name:'Filter laporan'});
 async function openAssign(){await page.getByRole('button',{name:'Atur penugasan Guru Wali',exact:true}).click();await dialog().getByRole('combobox',{name:'Guru Wali',exact:true}).selectOption(id(300));}
 async function openReport(){await page.getByRole('button',{name:'Input laporan bimbingan',exact:true}).tap();await dialog().getByRole('combobox',{name:'Siswa',exact:true}).selectOption(id(10));await dialog().getByRole("textbox", {name:"Nama hafalan lainnya",exact:true}).fill('An-Nas');await dialog().getByRole("textbox", {name:"Predikat hafalan",exact:true}).fill('Lancar');}
 async function bounds(name){const r=await dialog().evaluate(e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,vw:innerWidth,vh:innerHeight,scroll:e.scrollWidth,client:e.clientWidth};});check(r.x>=-1&&r.y>=-1&&r.right<=r.vw+1&&r.bottom<=r.vh+1&&r.scroll<=r.client+1,name+' dialog contained',r);}
 for(const mode of ['normal','empty','large','readonly','teacher','loading','error']){
  await visit(mode,320,568);await geometry(page,mode+' mobile');if(!['loading','error'].includes(mode))await a11y(page,mode+' mobile');
  for(const width of [375, 390, 768, 1440]){await page.setViewportSize({width,height:900});await geometry(page,mode+' '+width);}
  if(mode==='readonly')check(await page.getByRole('button',{name:'Input laporan bimbingan',exact:true}).count()===0,'read only no report input');
  if(mode==='teacher'){check(await page.getByRole('button',{name:'Atur penugasan Guru Wali',exact:true}).count()===0,'teacher cannot assign');await openReport();check(await dialog().getByRole('combobox',{name:'Siswa',exact:true}).locator('option[value="'+id(12)+'"]').count()===0,'teacher report picker only assigned students');}
 }
 // Full replacement survives both history filtering and client-side search, including assignments outside the active catalog.
 await visit();await history().getByRole('combobox',{name:'Siswa',exact:true}).selectOption(id(10));await history().getByRole('button',{name:'Terapkan filter'}).click();await page.getByRole('status').filter({hasText:'Laporan diperbarui'}).waitFor();check((await page.getByRole('link',{name:'Ekspor Excel'}).getAttribute('href')).includes('studentId='+id(10)),'export retains student filter');
 await openAssign();check(await dialog().getByRole('checkbox',{checked:true}).count()===3,'replacement prefills full assignment set including uncatalogued student');check(await dialog().getByRole('checkbox',{name:/Siswa 3/}).isDisabled(),'student assigned elsewhere cannot be selected');
 await dialog().getByLabel('Cari siswa',{exact:true}).fill('Siswa 1');check(await dialog().getByRole('checkbox',{checked:true}).count()===1,'search narrows visible choices only');await dialog().getByRole('checkbox',{name:/Tetapkan juga tugas/}).check();await dialog().getByRole('button',{name:'Simpan penugasan',exact:true}).click();await dialog().waitFor({state:'hidden'});check(posts[0].command.studentIds.length===3&&posts[0].command.studentIds.includes(id(90)),'filtered replacement preserves hidden assignments');check(posts[0].command.assignTask===true,'optional task assignment retained');
 // Empty replacement requires explicit confirmation; rejecting it leaves the form intact.
 await openAssign();while(await dialog().getByRole('checkbox',{checked:true}).count())await dialog().getByRole('checkbox',{checked:true}).first().uncheck();page.removeAllListeners('dialog');page.on('dialog',d=>d.dismiss());await dialog().getByRole('button',{name:'Simpan penugasan',exact:true}).click();check(posts.length===1,'declined clear-all never writes');check(await dialog().count()===1,'declined clear-all retains dialog');page.removeAllListeners('dialog');page.on('dialog',d=>d.accept());await dialog().getByRole('button',{name:'Simpan penugasan',exact:true}).click();await dialog().waitFor({state:'hidden'});check(posts.at(-1).command.studentIds.length===0,'explicit empty replacement supported');
 // Assignment drafts survive declined teacher switch.
 await openAssign();await dialog().getByRole('checkbox',{name:/Siswa 1/}).uncheck();page.removeAllListeners('dialog');page.on('dialog',d=>d.dismiss());await dialog().getByRole('combobox',{name:'Guru Wali',exact:true}).selectOption(id(301));check(await dialog().getByRole('combobox',{name:'Guru Wali',exact:true}).inputValue()===id(300),'declined teacher switch retains teacher');check(await dialog().getByRole('checkbox',{name:/Siswa 1/}).isChecked()===false,'declined teacher switch retains draft');page.removeAllListeners('dialog');page.on('dialog',d=>d.accept());await page.keyboard.press('Escape');await dialog().waitFor({state:'hidden'});
 // Two report kinds use their own required fields and retain notes.
 await visit();await openReport();await dialog().getByLabel('Catatan hafalan',{exact:true}).fill('Catatan penting');await dialog().getByRole('combobox',{name:'Master hafalan',exact:true}).selectOption(id(60));check(await dialog().getByRole("textbox", {name:"Nama hafalan lainnya",exact:true}).count()===0,'master title comes from catalog');await dialog().getByRole('button',{name:'Simpan laporan',exact:true}).dblclick();await dialog().waitFor({state:'hidden'});check(posts.length===1,'double submit sends one report');check(posts[0].command.catalogId===id(60)&&posts[0].command.subject==='','master report contract retained');check(posts[0].command.notes==='Catatan penting','report notes retained');
 await page.getByRole('button',{name:'Input laporan bimbingan',exact:true}).click();await dialog().getByRole('combobox',{name:'Siswa',exact:true}).selectOption(id(10));await dialog().getByRole('combobox',{name:'Jenis laporan',exact:true}).selectOption('development');check(await dialog().getByRole("textbox", {name:"Predikat hafalan",exact:true}).count()===0,'development hides irrelevant predicate');await dialog().getByRole("textbox", {name:"Aspek perkembangan",exact:true}).fill('Kemandirian');await dialog().getByRole('button',{name:'Simpan laporan',exact:true}).click();check(posts.length===1,'development requires description');await dialog().getByLabel('Deskripsi perkembangan',{exact:true}).fill('Mulai mandiri');await dialog().getByRole('button',{name:'Simpan laporan',exact:true}).click();await dialog().waitFor({state:'hidden'});check(posts.at(-1).command.kind==='development'&&posts.at(-1).command.catalogId===null&&posts.at(-1).command.predicate==='','development payload has no stale memorization fields');
 // Correction, void, validation, focus, mobile/landscape scroll and pending dismiss lock.
 await visit();const trigger=page.getByRole('button',{name:'Koreksi',exact:true}).first();await trigger.click();await dialog().waitFor();await a11y(page,'correction dialog');await bounds('mobile');await dialog().getByRole('button',{name:'Simpan koreksi',exact:true}).click();check(posts.length===0,'correction requires reason');await dialog().getByLabel('Alasan koreksi / pembatalan').fill('Ditinjau ulang');reply='invalid';await dialog().getByRole('button',{name:'Simpan koreksi',exact:true}).click();await dialog().getByRole('alert').waitFor();check(await dialog().evaluate(e=>e.contains(document.activeElement)),'error focus remains in dialog');check(await dialog().getByLabel('Alasan koreksi / pembatalan').inputValue()==='Ditinjau ulang','failed correction retains reason');reply='slow';await dialog().getByRole('button',{name:'Simpan koreksi',exact:true}).click();await page.keyboard.press('Escape');check(await dialog().count()===1,'pending save blocks Escape dismissal');await dialog().waitFor({state:'hidden'});check(posts.at(-1).command.id===id(100),'correction retains report id');reply='success';await trigger.click();await dialog().getByLabel('Alasan koreksi / pembatalan').fill('Laporan ganda');await dialog().getByRole('button',{name:'Batalkan laporan',exact:true}).click();await dialog().waitFor({state:'hidden'});check(posts.at(-1).command.type==='void','void retains existing contract');
 await trigger.click();await page.setViewportSize({width:812,height:375});await bounds('landscape');await page.setViewportSize({width:1440,height:900});await bounds('desktop');await page.screenshot({path:join(out,'mentoring-desktop.png')});await page.setViewportSize({width:320,height:568});await bounds('short mobile');const close=dialog().getByRole('button',{name:'Tutup',exact:true});await close.scrollIntoViewIfNeeded();const box=await close.boundingBox();check(box.y>=0&&box.y+box.height<=568,'short modal footer reachable');await page.screenshot({path:join(out,'mentoring-mobile.png')});await page.keyboard.press('Tab');check(await dialog().evaluate(e=>e.contains(document.activeElement)),'keyboard focus trapped');await page.keyboard.press('Escape');await dialog().waitFor({state:'hidden'});check(await trigger.evaluate(e=>e===document.activeElement),'Escape returns trigger focus');
 await visit();await page.getByRole('button',{name:'Koreksi',exact:true}).first().click();await dialog().getByLabel('Alasan koreksi / pembatalan').fill('Dibatalkan setelah diperiksa');reply='removed';await dialog().getByRole('button',{name:'Batalkan laporan',exact:true}).click();await dialog().waitFor({state:'hidden'});check(await page.locator('#mentoring-filter').evaluate(e=>e===document.activeElement),'removed row returns focus to stable filter heading');
 for(const failure of ['invalid','duplicate','stale','denied','network','malformed']){
  await visit();await openReport();reply=failure;await dialog().getByRole('button',{name:'Simpan laporan',exact:true}).click();await dialog().getByRole('alert').waitFor();check(await dialog().getByRole('button',{name:'Simpan laporan',exact:true}).isDisabled()===['stale','denied','network','malformed'].includes(failure),failure+' retry policy');check(await dialog().getByRole("textbox", {name:"Nama hafalan lainnya",exact:true}).inputValue()==='An-Nas',failure+' retains draft');
 }
 await visit('large');await page.getByRole('button',{name:'Berikutnya',exact:true}).click();await page.getByRole('status').filter({hasText:'Laporan diperbarui'}).waitFor();check(await page.getByText('Halaman 2 dari 3',{exact:true}).count()===1,'pagination advances');reply='read-error';await page.getByRole('button',{name:'Sebelumnya',exact:true}).click();await page.getByRole('status').filter({hasText:'Laporan belum dapat dimuat'}).waitFor();check(await page.getByText('Halaman 2 dari 3',{exact:true}).count()===1,'failed read retains previous page');
 await visit();await openAssign();await bounds('assignment');await a11y(page,'assignment dialog');
 await page.keyboard.press('Escape');await dialog().waitFor({state:'hidden'});await openReport();await page.clock.install();reply='hang';await dialog().getByRole('button',{name:'Simpan laporan',exact:true}).click();await page.clock.fastForward(31000);await page.clock.resume();await dialog().getByRole('alert').filter({hasText:'Hasil penyimpanan'}).waitFor();check(await dialog().getByRole('button',{name:'Simpan laporan',exact:true}).isDisabled(),'30 second timeout locks retry');
  check(!errors.length, "no uncaught JavaScript errors", errors);
  await writeFile(
    join(out, "browser-results.json"),
    JSON.stringify(
      {
        status: "passed",
        checks,
        axe: axeResults,
        errors,
        limits: [
          "Synthetic fixtures and intercepted writes, not authenticated production role UAT or physical-device testing.",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      status: "passed",
      checks: checks.length,
      axe: axeResults.length,
    }),
  );
} catch (error) {
  await writeFile(
    join(out, "failure.json"),
    JSON.stringify(
      { error: String(error), checks, errors, axe: axeResults },
      null,
      2,
    ),
  );
  throw error;
} finally {
  if (browser) await browser.close();
  server.close();
}
