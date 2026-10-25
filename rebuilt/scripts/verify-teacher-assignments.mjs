/** Actual help component, isolated local browser; not human UAT. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd();
const out = process.env.ASSIGNMENTS_QA_OUTPUT ?? join(root, "docs/verification/teacher-assignments");
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
  entryPoints: [join(root, "tests/ui/teacher-assignments-fixture.tsx")],
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
const results=[],errors=[];let browser;
try {
 browser=await chromium.launch({headless:true,executablePath:process.env.UI_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:850}});page.on('pageerror',e=>errors.push(String(e)));
  let rows=[],posts=[],fail=false;
  await page.route('**/api/directory/*/assignments',async route=>{const r=route.request();if(r.method()==='POST'){const c=r.postDataJSON();posts.push(c);if(fail){fail=false;await route.abort();return;}if(c.action==='assign')rows=[{id:'22222222-2222-4222-8222-222222222222',code:c.code,valid_from:c.validFrom,valid_until:c.validUntil,revoked_at:null}];else rows=rows.map(v=>({...v,revoked_at:new Date().toISOString()}));}await route.fulfill({json:{rows,saved:r.method()==='POST'}});});
  await page.goto(base);await page.getByRole('button',{name:'Kelola Tugas Tambahan',exact:true}).click();
  await page.getByRole('button',{name:'Simpan penugasan',exact:true}).waitFor();
  await page.locator('select[name=code]').selectOption('savings_manager');
  fail=true;await page.getByRole('button',{name:'Simpan penugasan',exact:true}).click();await page.getByRole('button',{name:'Coba kembali dengan permintaan yang sama',exact:true}).click();
  await page.getByText('Perubahan tugas tambahan berhasil disimpan.',{exact:false}).waitFor();assert.deepEqual(posts[0],posts[1]);
  await page.getByLabel('Alasan pencabutan').fill('Penugasan selesai');await page.getByRole('button',{name:'Cabut tugas',exact:true}).click();
  await page.getByRole('alertdialog').getByRole('button',{name:'Lanjutkan',exact:true}).click();await page.getByText('Dicabut',{exact:false}).waitFor();
  assert.equal(posts.at(-1).action,'revoke');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.addScriptTag({content:axe});const scan=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.equal(scan.violations.length,0,JSON.stringify(scan.violations));
  results.push({width,retry:true,revoke:true,noOverflow:true,axeViolations:0,keyboardFocus:true});await page.screenshot({path:join(out,`assignments-${width}.png`)});await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.getByRole('button',{name:'Kelola Tugas Tambahan',exact:true}).evaluate(e=>e===document.activeElement),true);await page.close();
 }
 assert.equal(errors.length,0);await writeFile(join(out,'results.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));
}finally{await browser?.close();server.close();}
