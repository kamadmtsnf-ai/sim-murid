/** Actual help component, isolated local browser; not human UAT. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd();
const out =
  process.env.MODAL_FEEDBACK_QA_OUTPUT ??
  join(root, "docs/verification/modal-feedback");
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
  entryPoints: [join(root, "tests/ui/modal-feedback-fixture.tsx")],
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
const results = [],
  errors = [];
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.UI_CHROMIUM_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(base);
    const opener = page.getByRole("button", {
      name: "Buka formulir",
      exact: true,
    });
    await opener.click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    const generatedControl = await page.getByRole("button", {name:"Buka formulir",exact:true,includeHidden:true}).getAttribute("aria-controls");
    assert.ok(generatedControl && generatedControl === await dialog.getAttribute("id"), "default Radix trigger retains generated content ID");
    await page.getByLabel("Nama", { exact: true }).fill("Isian milik pengguna");
    await page
      .getByRole("button", { name: "Mulai proses", exact: true })
      .click();
    await page.keyboard.press("Escape");
    assert.ok(await dialog.isVisible());
    assert.ok(
      await page
        .getByRole("button", { name: "Tutup dialog", exact: true })
        .isDisabled(),
    );
    await page.getByText("Perubahan tersimpan", { exact: true }).waitFor();
    await page.getByLabel("Status feedback").selectOption("uncertain");
    await page
      .getByText("Hasil belum terkonfirmasi", { exact: true })
      .waitFor();
    assert.equal(
      await page.getByLabel("Nama", { exact: true }).inputValue(),
      "Isian milik pengguna",
    );
    assert.ok(
      await page
        .getByText("Jangan kirim ulang sekarang.", { exact: false })
        .isVisible(),
    );
    await page.screenshot({ path: join(out, `feedback-${width}.png`) });
    await page.getByLabel("Status feedback").selectOption("blocked");
    await page.getByText("Tindakan dihentikan", { exact: true }).waitFor();
    await page.getByLabel("Status feedback").selectOption("error");
    await page.getByRole("alert").waitFor();
    const last = page.getByRole("button", {
      name: "Tindakan dengan label panjang",
      exact: false,
    });
    await last.scrollIntoViewIfNeeded();
    assert.ok(await last.isVisible());
    const bounds = await last.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.addScriptTag({ content: axe });
    const scan = await page.evaluate(() =>
      window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      }),
    );
    assert.equal(scan.violations.length, 0, JSON.stringify(scan.violations));
    await page.screenshot({ path: join(out, `modal-${width}.png`) });
    await page.setViewportSize({width:800,height:360});
    await last.scrollIntoViewIfNeeded();
    assert.ok((await page.getByRole("button",{name:"Tutup dialog",exact:true}).boundingBox()).y>=0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"landscape overflow");
    await page.setViewportSize({width,height:800});
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction(
      () => document.activeElement?.textContent === "Buka formulir",
    );
    assert.equal(
      await opener.evaluate((e) => e === document.activeElement),
      true,
    );
    await page
      .getByRole("button", { name: "Uji konfirmasi", exact: true })
      .click();
    const confirm = page.getByRole("alertdialog");
    await confirm.getByRole("button", { name: "Batal", exact: true }).click();
    assert.equal(
      await page.getByText("Perubahan: 0", { exact: true }).count(),
      1,
    );
    await page
      .getByRole("button", { name: "Uji konfirmasi", exact: true })
      .click();
    await confirm
      .getByRole("button", { name: "Hapus catatan", exact: true })
      .click();
    await page.getByText("Perubahan: 1", { exact: true }).waitFor();
    results.push({
      width,
      generatedIdPreserved: true,
      busyEscapeBlocked: true,
      draftPreserved: true,
      focusRestored: true,
      uncertainGuidance: true,
      confirmationOnce: true,
      noOverflow: true,
      axeViolations: 0,
    });
    await page.close();
  }
  for (const variant of [
    "classes-dialog",
    "schedules-dialog",
    "duty-dialog",
    "attendance-dialog",
    "mentoring-dialog",
    "committee-dialog",
    "savings-dialog",
    "discipline-dialog",
    "grades-dialog",
    "reports-dialog",
    "promotions-dialog",
    "books-dialog",
  ]) {
    const page = await browser.newPage({
      viewport: { width: 320, height: 568 },
    });
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(base + "/?variant=" + variant);
    await page
      .getByRole("button", { name: "Buka formulir", exact: true })
      .click();
    const close = page.getByRole("button", {
      name: "Tutup dialog",
      exact: true,
    });
    const before = await close.boundingBox();
    await page
      .getByRole("button", {
        name: "Tindakan dengan label panjang",
        exact: false,
      })
      .scrollIntoViewIfNeeded();
    const after = await close.boundingBox();
    assert.ok(Math.abs(before.y - after.y) < 2, variant + " stable header");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await close.click();
    results.push({ variant, headerStable: true, noOverflow: true });
    await page.close();
  }
  assert.equal(errors.length, 0);
  await writeFile(
    join(out, "results.json"),
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(JSON.stringify({ results, errors }));
} finally {
  await browser?.close();
  server.close();
}
