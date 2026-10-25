/** Actual help component, isolated local browser; not human UAT. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd();
const out = process.env.CONFIRM_QA_OUTPUT ?? join(root, "docs/verification/confirm");
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
  entryPoints: [join(root, "tests/ui/confirm-fixture.tsx")],
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
  page.on("dialog",d=>{errors.push("Unexpected native dialog");d.dismiss();});
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:850});await page.goto(base);
    const action=page.getByRole("button",{name:"Hapus catatan",exact:true}),modal=page.getByRole("alertdialog");
    await action.click();await modal.waitFor();
    check(await modal.getByRole("button",{name:"Batal",exact:true}).evaluate(e=>e===document.activeElement),"safe cancel focus "+width);
    check(await modal.locator("img").count()===0,"escaped confirmation text "+width);
    await page.keyboard.press("Escape");await modal.waitFor({state:"hidden"});
    await page.waitForFunction(()=>document.activeElement?.textContent==="Hapus catatan");
    check(await action.evaluate(e=>e===document.activeElement),"focus restored "+width);
    await action.evaluate(e=>{e.click();e.click();});await modal.waitFor();
    await modal.getByRole("button",{name:"Lanjutkan",exact:true}).click();await page.getByText("Perubahan: 1",{exact:true}).waitFor();check(true,"double activation confirms once "+width);
    await action.click();await modal.waitFor();await page.evaluate(()=>window.dispatchEvent(new PopStateEvent("popstate")));await modal.waitFor({state:"hidden"});check(await page.getByText("Perubahan: 1",{exact:true}).isVisible(),"navigation cancels stale decision "+width);
    await page.getByRole("button",{name:"Buka formulir"}).click();await page.getByLabel("Isian").fill("Draf dipertahankan");await page.getByRole("button",{name:"Tutup formulir"}).click();await modal.waitFor();await modal.getByRole("button",{name:"Batal",exact:true}).click();await modal.waitFor({state:"hidden"});check(await page.getByLabel("Isian").inputValue()==="Draf dipertahankan","nested draft preserved "+width);
    await page.getByRole("button",{name:"Tutup formulir"}).click();await modal.waitFor();
    await page.addScriptTag({content:axe});const result=await page.evaluate(()=>window.axe.run(document.body,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]}}));accessibility.push({label:width,violations:result.violations});check(!result.violations.length,"nested axe "+width);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"no overflow "+width);
    await modal.getByRole("button",{name:"Lanjutkan",exact:true}).click();await page.getByRole("dialog").waitFor({state:"hidden"});
    await page.getByRole("button",{name:"Keluar",exact:true}).click();await modal.waitFor();await modal.getByRole("button",{name:"Tetap di aplikasi",exact:true}).click();await modal.waitFor({state:"hidden"});check(await page.getByText("Logout: 0",{exact:true}).isVisible(),"cancelled logout skips child cleanup "+width);
    await page.getByRole("button",{name:"Keluar",exact:true}).click();await modal.waitFor();await modal.getByRole("button",{name:"Ya, keluar",exact:true}).click();await page.getByText("Logout: 1",{exact:true}).waitFor();check(true,"approved logout runs original submit exactly once "+width);
    await page.getByRole("link",{name:"Pindah halaman"}).click();await modal.waitFor();await modal.getByRole("button",{name:"Lanjutkan",exact:true}).click();await page.getByText("Navigasi: 1",{exact:true}).waitFor();check(true,"approved navigation runs original click "+width);
  }
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
