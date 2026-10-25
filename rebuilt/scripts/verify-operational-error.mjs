/** Actual P09 audit UI with isolated HTTP boundaries. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd();
const out =
  process.env.OPERATIONAL_QA_OUTPUT ??
  join(root, "docs/verification/operational-error");
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
  entryPoints: [join(root, "tests/ui/operational-error-fixture.tsx")],
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
  for (const width of [320, 390, 768, 1440])
    for (const variant of ["", "?root=1", "?bad=1"]) {
      await page.setViewportSize({ width, height: 850 });
      await page.goto(base + variant);
      await page.getByRole("heading", { level: 1 }).waitFor();
      const text = await page.locator("body").innerText();
      check(
        !text.includes("PRIVATE_"),
        "private error hidden " + width + variant,
      );
      check(
        text.includes("Kode laporan:") === !variant.includes("bad"),
        "valid digest only " + width + variant,
      );
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "no horizontal overflow " + width + variant,
      );
      await page
        .getByRole("button", { name: "Coba kembali", exact: true })
        .focus();
      await page.keyboard.press("Enter");
      await page.getByText("Percobaan ulang: 1", { exact: true }).waitFor();
      check(true, "keyboard retry " + width + variant);
      await page.addScriptTag({ content: axe });
      const result = await page.evaluate(() =>
        window.axe.run(document.body, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        }),
      );
      accessibility.push({
        label: width + variant,
        violations: result.violations,
      });
      check(!result.violations.length, "axe " + width + variant);
      if (!variant)
        await page.screenshot({
          path: join(out, "error-" + width + ".png"),
          fullPage: true,
        });
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
