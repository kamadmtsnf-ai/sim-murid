/** Actual Hak akses saya UI with isolated HTTP boundaries. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd();
const out =
  process.env.NAVIGATION_QA_OUTPUT ??
  join(root, "docs/verification/navigation");
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
  entryPoints: [join(root, "tests/ui/navigation-fixture.tsx")],
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
          path: join(root, "tests/ui/shell-navigation-shim.ts"),
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
  errors = [],
  accessibility = [];
let browser, page;
function check(ok, name) {
  checks.push({ name, passed: !!ok });
  assert.ok(ok, name);
}
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.UI_CHROMIUM_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  page = await browser.newPage({ hasTouch: true });
  page.on("pageerror", (e) => errors.push(String(e)));
  const button = (name) => page.getByRole("button", { name, exact: true });
  async function visit(role = "admin", width = 1440, height = 900) {
    await page.setViewportSize({ width:process.argv.includes("--accordion-only")?width:1440, height });
    await page.goto(base + "?role=" + role);
    await page
      .getByRole("heading", { name: "Navigasi layanan madrasah" })
      .waitFor();
    if(!process.argv.includes('--accordion-only')){
      // Legacy shell scenarios explicitly open groups first; collapsed defaults are tested separately.
      const toggles=page.getByRole('navigation',{name:'Navigasi utama',exact:true}).locator('.nav-group-toggle');
      for(let i=0;i<await toggles.count();i++)if(await toggles.nth(i).getAttribute('aria-expanded')==='false')await toggles.nth(i).click();
      await page.setViewportSize({width,height});
    }
  }
  async function a11y(name) {
    await page.evaluate(axe);
    const r = await page.evaluate(() =>
      window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"],
        },
      }),
    );
    accessibility.push({ name, violations: r.violations.map((v) => v.id) });
    check(!r.violations.length, name + " axe");
  }
  if (process.argv.includes('--accordion-only')) {
    for (const width of [320, 768, 1440]) {
      await visit('admin', width);
      if (width < 1024) await button('Buka navigasi').click();
      const nav = page.getByRole('navigation', {name: width < 1024 ? 'Navigasi utama seluler' : 'Navigasi utama', exact:true});
      const surface=width<1024?page.getByRole('dialog',{name:'Navigasi',exact:true}):page.getByRole('complementary',{name:'Sidebar layanan madrasah',exact:true});
      const toggles = nav.locator('.nav-group-toggle');
      const count = await toggles.count();
      check(count > 1, 'Grouped menus exist '+width);
      for (let i=0;i<count;i++) check(await toggles.nth(i).getAttribute('aria-expanded') === 'false', 'Group defaults collapsed '+width+' '+i);
      check(await nav.getByRole('link').count() === 0, 'Collapsed links leave keyboard navigation '+width);
      const currentGroup=nav.locator('.nav-group-toggle[data-current-group="true"]');
      check(await currentGroup.count()===1 && await currentGroup.getAttribute('aria-expanded')==='false','Current group marked without opening '+width);
      const description=await currentGroup.getAttribute('aria-describedby');
      check(await page.locator(`[id="${description}"]`).textContent().then(t=>t.includes('Dashboard')),'Current group has accessible page description '+width);
      await page.screenshot({path:join(out,'current-location-'+width+'.png'),fullPage:true});

      const first=toggles.first();
      await first.focus(); await page.keyboard.press('Enter');
      check(await first.getAttribute('aria-expanded') === 'true', 'Enter expands group '+width);
      check(await nav.getByRole('link').count()>0, 'Expanded links available '+width);
      await page.keyboard.press('Space');
      check(await first.getAttribute('aria-expanded') === 'false', 'Space collapses group '+width);
      const search=page.getByRole('searchbox',{name:width < 1024 ? 'Cari menu pada navigasi seluler' : 'Cari menu navigasi',exact:true});
      await search.fill('Keamanan akun');
      await nav.getByRole('link',{name:'Keamanan akun',exact:true}).waitFor();
      check(true,'Search exposes matching collapsed menu '+width);
      await surface.getByText('Halaman saat ini: Dashboard, kelompok Ruang kerja.',{exact:false}).waitFor();
      check(true,'Search explains current location outside results '+width);
      await nav.locator('.nav-group-toggle').first().click();
      check(await nav.getByRole('link').count()===0,'User can collapse matching results '+width);
      await search.fill('');await search.fill('Keamanan akun');
      await nav.getByRole('link',{name:'Keamanan akun',exact:true}).waitFor();
      check(true,'Repeating search reopens matches rather than restoring stale collapse '+width);
      await button('Hapus pencarian menu').click();
      check(await search.evaluate(e=>e===document.activeElement),'Clear search restores input focus '+width);
      await search.fill('zzzz-no-such-menu');await surface.getByText('Menu tidak ditemukan. Coba nama layanan atau istilah lain, atau hapus pencarian.',{exact:true}).waitFor();
      check(await nav.getByRole('link').count()===0,'Empty search never introduces routes '+width);
      await search.press('Escape');check(await search.inputValue()==='','Escape clears empty results '+width);

      await search.fill('');
      check(await nav.getByRole('link').count()===0,'Clearing search restores collapsed groups '+width);
      await first.click(); await toggles.nth(1).click();
      check(await first.getAttribute('aria-expanded')==='true' && await toggles.nth(1).getAttribute('aria-expanded')==='true','Groups expand independently '+width);
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow '+width);
      await a11y('accordion '+width);
      await page.screenshot({path:join(out,'accordion-'+width+'.png'),fullPage:true});
      await page.evaluate(()=>{history.pushState({},'', '/account/security');window.dispatchEvent(new PopStateEvent('popstate'));});
      if(width<1024){await page.getByRole('dialog').waitFor({state:'hidden'});await button('Buka navigasi').click();}
      const securityGroup=nav.locator('.nav-group-toggle[data-current-group="true"]');
      await securityGroup.waitFor();
      check(await securityGroup.getAttribute('aria-expanded')==='false','Route change does not force active group open '+width);
      check(await securityGroup.getAttribute('aria-describedby').then(id=>page.locator(`[id="${id}"]`).textContent()).then(t=>t.includes('Keamanan akun')),'Current marker follows live route '+width);
      await page.goBack();
      if(width<1024){await page.getByRole('dialog').waitFor({state:'hidden'});await button('Buka navigasi').click();}
      check(await nav.locator('.nav-group-toggle[data-current-group="true"]').getAttribute('aria-describedby').then(id=>page.locator(`[id="${id}"]`).textContent()).then(t=>t.includes('Dashboard')),'Browser Back restores location marker '+width);
      await a11y('wayfinding '+width);

    }
    for(const role of ['teacher','student','parent','alumni','customer','applicant']) {
      await visit(role);
      const nav=page.getByRole('navigation',{name:'Navigasi utama',exact:true});
      const toggles=nav.locator('.nav-group-toggle');
      for(let i=0;i<await toggles.count();i++) await toggles.nth(i).click();
      check(await nav.getByRole('link',{name:'Pengaturan madrasah',exact:true}).count()===0,'Accordion preserves restricted menu scope '+role);
    }
  } else {
  for (const role of [
    "admin",
    "teacher",
    "student",
    "parent",
    "alumni",
    "customer",
    "applicant",
  ]) {
    await visit(role);
    const nav = page.getByRole("navigation", {
      name: "Navigasi utama",
      exact: true,
    });
    check(
      (await nav
        .getByRole("link", { name: "Keamanan akun", exact: true })
        .count()) === 1,
      role + " account security available",
    );
    check(
      (await nav
        .getByRole("link", { name: "Pengaturan madrasah", exact: true })
        .count()) === (role === "admin" ? 1 : 0),
      role + " administrative menu scope",
    );
    await a11y(role);
  }
  await visit();
  const search = () =>
    page.getByRole("searchbox", { name: "Cari menu navigasi", exact: true });
  await search().fill("JADWAL   KBM");
  check(
    (await page
      .getByRole("link", { name: "Jadwal dan piket siswa", exact: true })
      .count()) === 1,
    "task alias and whitespace search",
  );
  await page.getByRole("status").getByText("1 menu ditemukan").waitFor();
  await search().fill("tidak-ditemukan");
  await page.getByText("Menu tidak ditemukan. Coba nama layanan atau istilah lain, atau hapus pencarian.").waitFor();
  await button("Hapus pencarian menu").click();
  check(
    (await search().inputValue()) === "" &&
      (await search().evaluate((e) => e === document.activeElement)),
    "clear recovers search and focus",
  );
  await search().fill("guru wali");
  await page.getByRole("link", { name: "Bimbingan", exact: true }).waitFor();
  await search().press("Escape");
  check((await search().inputValue()) === "", "desktop Escape clears search");
  await page
    .getByRole("textbox", { name: "Nama lengkap", exact: true })
    .fill("Nama dikirim");
  await button("Simpan contoh").click();
  check(
    await page.evaluate(
      () =>
        window.submitted.name === "Nama dikirim" &&
        window.submitted.classId === "001",
    ),
    "Field adapter preserves names and native FormData/default values",
  );
  for (const [width, height] of [
    [320, 700],
    [390, 844],
    [768, 900],
    [1440, 900],
    [844, 390],
    [568, 260],
  ]) {
    await visit("admin", width, height);
    if (width < 1024) {
      await button("Buka navigasi").click();
      await page
        .getByRole("dialog", { name: "Navigasi", exact: true })
        .waitFor();
      const input = page.getByRole("searchbox", {
        name: "Cari menu pada navigasi seluler",
        exact: true,
      });
      await input.fill("tidak-ditemukan");
      await input.press("Escape");
      check(
        (await input.inputValue()) === "" &&
          (await page.getByRole("dialog").isVisible()),
        "first Escape clears mobile search " + width + "x" + height,
      );
      await input.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await button("Buka navigasi").focus();
      await page.keyboard.press("Enter");
      await page.getByRole("dialog").waitFor();
      await input.fill("keamanan");
      await page
        .getByRole("link", { name: "Keamanan akun", exact: true })
        .waitFor();
      await a11y("drawer " + width + "x" + height);
      await page.screenshot({
        path: join(out, "navigation-" + width + "x" + height + ".png"),
        fullPage: true,
      });
      await button("Tutup dialog").click();
    }
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "no page overflow " + width + "x" + height,
    );
    check(
      await page
        .getByRole("textbox", { name: "Nama lengkap", exact: true })
        .evaluate((e) => e.getBoundingClientRect().height >= 44),
      "touch target " + width + "x" + height,
    );
  }
  await visit("admin", 390, 844);
  await button("Buka navigasi").click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  check(true, "drawer closes on desktop breakpoint");
  // Live pathname changes represent Next navigation and browser back/forward without remounting the shell.
  await visit("admin", 390, 844);
  await page.evaluate(() => {
    history.pushState(
      {},
      "",
      "/account/directory/11111111-1111-4111-8111-111111111111",
    );
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByText("Detail pengguna", { exact: true })
    .waitFor();
  await button("Buka navigasi").click();
  let mobileSearch = page.getByRole("searchbox", {
    name: "Cari menu pada navigasi seluler",
    exact: true,
  });
  await mobileSearch.fill("keamanan");
  const controlled = await page
    .locator('button[aria-label="Buka navigasi"]')
    .getAttribute("aria-controls");
  check(
    !!controlled &&
      (await page.getByRole("dialog").getAttribute("id")) === controlled,
    "menu button controls its actual drawer",
  );
  await page.evaluate(() => {
    history.pushState(
      {},
      "",
      "/account/biodata/11111111-1111-4111-8111-111111111111",
    );
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByText("Detail biodata", { exact: true })
    .waitFor();
  check(
    true,
    "external route change closes drawer and updates detail breadcrumb",
  );
  await button("Buka navigasi").click();
  mobileSearch = page.getByRole("searchbox", {
    name: "Cari menu pada navigasi seluler",
    exact: true,
  });
  check(
    (await mobileSearch.inputValue()) === "",
    "route change resets prior search",
  );
  await page.goBack();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByText("Detail pengguna", { exact: true })
    .waitFor();
  check(true, "browser Back updates navigation without stale drawer");
  for (const [width, height] of [
    [320, 700],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(base + "?role=admin&mode=short");
    await page.getByText("Konten singkat.", { exact: true }).waitFor();
    await page.evaluate(() => {
      localStorage.setItem(
        "sim-academic:v1:qa-navigation",
        JSON.stringify({ version: 1, year: 2026, semester: 1, classId: null }),
      );
      dispatchEvent(new Event("sim-academic-context"));
    });
    await page
      .getByText("Pilihan akademik tersimpan:", { exact: false })
      .waitFor();
    const box = await page.getByRole("contentinfo").boundingBox();
    check(
      box.y + box.height <= height + 1,
      "short page footer stays within viewport with academic summary " + width,
    );
    check(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight + 1,
      ),
      "no forced vertical page overflow " + width,
    );
    await page.screenshot({
      path: join(out, "shell-short-" + width + ".png"),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 320 });
  await page.goto(base + "?role=admin&mode=unavailable");
  await page
    .getByText("Status menu belum dapat diverifikasi.", { exact: false })
    .waitFor();
  const sidebar = page.getByRole("complementary");
  await sidebar
    .getByRole("button", { name: "Keluar dari akun", exact: true })
    .scrollIntoViewIfNeeded();
  check(
    await sidebar
      .getByRole("button", { name: "Keluar dari akun", exact: true })
      .isVisible(),
    "logout reachable in short desktop sidebar",
  );
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "short desktop no horizontal overflow",
  );
  await page.evaluate(() => {
    history.pushState({}, "", "/account/access");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  const shortSearch = page.getByRole("searchbox", {
    name: "Cari menu navigasi",
    exact: true,
  });
  await shortSearch.fill("keamanan");
  await shortSearch.press("Escape");
  const searchBox = await shortSearch.boundingBox();
  check(
    searchBox.y >= 0 &&
      searchBox.y + searchBox.height <= 320 &&
      (await shortSearch.evaluate((e) => e === document.activeElement)),
    "clearing search does not scroll focused header off short sidebar",
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + "?mode=empty");
  await page
    .getByText("Belum ada menu yang dapat ditampilkan untuk akun ini.", {
      exact: true,
    })
    .waitFor();
  check(true, "empty permission menu is not reported as failed search");
  await a11y("empty menu");
  await page.goto(base + "?mode=emoji");
  check(
    !(
      await page.locator(".workspace-sidebar .user-avatar").textContent()
    ).includes("�"),
    "unicode avatar does not split surrogate pairs",
  );
  await page.goto(base + "?mode=blank-name");
  await page
    .locator(".workspace-sidebar .workspace-user")
    .getByText("qa-navigation", { exact: true })
    .first()
    .waitFor();
  check(
    (await page.locator(".workspace-sidebar .user-avatar").textContent()) ===
      "Q",
    "missing display name falls back to username",
  );
  await page.goto(base + "?mode=long");
  await page
    .getByText("Akhir konten panjang.", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
  const footer = await page.getByRole("contentinfo").boundingBox(),
    content = await page
      .getByText("Akhir konten panjang.", { exact: true })
      .boundingBox();
  check(
    footer.y >= content.y + content.height,
    "footer follows long content without overlay",
  );
  await a11y("long page");
  }
  check(errors.length === 0, "no JavaScript page errors");
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
} catch (error) {
  if (page) await writeFile(join(out, "page.html"), await page.content());
  await writeFile(
    join(out, "failure.json"),
    JSON.stringify(
      { error: String(error), checks, accessibility, errors },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
