/** Actual help component, isolated local browser; not human UAT. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd();
const out = process.env.HELP_QA_OUTPUT ?? join(root, "docs/verification/help");
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
  entryPoints: [join(root, "tests/ui/help-fixture.tsx")],
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
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto(base);
    const summary = page.locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "Layanan akademik" }).waitFor();
    check(true, "keyboard disclosure " + width);
    const input = page.getByLabel("Kode laporan (opsional)");
    await input.fill("PRIVATE_PASSWORD_EMAIL");
    check(
      await page
        .getByRole("button", { name: "Salin templat laporan" })
        .isDisabled(),
      "reject private text " + width,
    );
    check(
      !(
        await page.getByLabel("Templat laporan untuk disalin").inputValue()
      ).includes("PRIVATE_"),
      "no private text in report " + width,
    );
    await input.fill("1234567890");
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw Error("denied");
          },
        },
      }),
    );
    await page.getByRole("button", { name: "Salin templat laporan" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Belum dapat menyalin" })
      .waitFor();
    check(true, "clipboard denied manual fallback " + width);
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text) => {
            window.copied = text;
          },
        },
      }),
    );
    await page.getByRole("button", { name: "Salin templat laporan" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Templat disalin" })
      .waitFor();
    check(
      (await page.evaluate(() => window.copied)).includes("1234567890"),
      "explicit copy " + width,
    );
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "no overflow " + width,
    );
    await page.addScriptTag({ content: axe });
    const result = await page.evaluate(() =>
      window.axe.run(document.body, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      }),
    );
    accessibility.push({ label: width, violations: result.violations });
    check(!result.violations.length, "axe " + width);
    await page.getByRole("button", { name: "Ganti konteks" }).click();
    await page.locator("summary").click();
    check(
      (await page.getByLabel("Kode laporan (opsional)").inputValue()) === "",
      "navigation clears report code " + width,
    );
    check(
      await page.getByRole("heading", { name: "Transaksi siswa" }).isVisible(),
      "context updates " + width,
    );
    await page.setViewportSize({ width: 850, height: 390 });
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "landscape " + width,
    );
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
