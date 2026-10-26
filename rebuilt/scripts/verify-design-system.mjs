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
  process.env.DESIGN_SYSTEM_QA_OUTPUT ??
  join(root, "docs/verification/design-system");
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
  entryPoints: [join(root, "tests/ui/design-system-fixture.tsx")],
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
          path: join(root, "tests/ui/access-navigation-shim.ts"),
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
  page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  const button = (name) => page.getByRole("button", { name, exact: true });
  async function geometry(label) {
    check(
      await page
        .locator(".ds-actions button")
        .evaluateAll((nodes) =>
          nodes.every((e) => e.scrollWidth <= e.clientWidth + 1),
        ),
      label + " button labels stay within controls",
    );
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      label + " document overflow",
    );
    check(
      await page
        .locator(".ds-field-control")
        .evaluateAll((nodes) =>
          nodes.every((e) => e.getBoundingClientRect().height >= 44),
        ),
      label + " controls 44px",
    );
  }
  async function a11y(label) {
    await page.evaluate(axe);
    const r = await page.evaluate(() =>
      window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"],
        },
      }),
    );
    accessibility.push({
      label,
      violations: r.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    });
    check(!r.violations.length, label + " axe");
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base);
    await button("Periksa isian").waitFor();
    await geometry(String(width));
    await a11y("components " + width);
    await page.screenshot({
      path: join(out, "components-" + width + ".png"),
      fullPage: true,
    });
    check(await button("Sebelumnya").isDisabled(), "first boundary " + width);
    await button("Berikutnya").click();
    await button("Berikutnya").click();
    check(await button("Berikutnya").isDisabled(), "last boundary " + width);
    await page
      .getByRole("textbox", { name: "Nama", exact: true })
      .fill("isian dipertahankan");
    await button("Sebelumnya").click();
    check(
      (await page
        .getByRole("textbox", { name: "Nama", exact: true })
        .inputValue()) === "isian dipertahankan",
      "paging preserves caller form " + width,
    );
    const region = page.getByRole("region", { name: "Contoh tabel jadwal" });
    await region.focus();
    await page.keyboard.press("ArrowRight");
    check(
      await region.evaluate((e) => e === document.activeElement),
      "table keyboard focus " + width,
    );
    await button("Buka rincian").click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    const g = await dialog.boundingBox();
    check(
      g.x >= 0 &&
        g.x + g.width <= width + 1 &&
        g.y >= 0 &&
        g.y + g.height <= 901,
      "dialog viewport " + width,
    );
    await a11y("dialog " + width);
    await page.getByLabel("Catatan", { exact: true }).fill("draf uji");
    await page.keyboard.press("Escape");
    await dialog.waitFor({state:"hidden"});
    await page.waitForFunction(()=>document.activeElement?.tagName==="BUTTON" && document.activeElement?.textContent?.trim()==="Buka rincian");
    check(
      await button("Buka rincian").evaluate(
        (e) => e === document.activeElement,
      ),
      "dialog restores focus " + width,
    );
  }
  await page.goto(base);
  await button("Periksa isian").click();
  check(
    (await page
      .getByRole("textbox", { name: "Nama", exact: true })
      .getAttribute("aria-invalid")) === "true",
    "invalid field explicit",
  );
  check(
    await page
      .getByRole("textbox", { name: "Nama", exact: true })
      .evaluate((e) =>
        e
          .getAttribute("aria-describedby")
          .split(" ")
          .every((id) => !!document.getElementById(id)),
      ),
    "hint/error references exist",
  );
  await a11y("field error");
  await page
    .getByRole("textbox", { name: "Nama", exact: true })
    .fill("Nama benar");
  check(
    (await page.locator("#sample-name-error").count()) === 0,
    "error clears independently of value",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  check(
    (await page
      .locator(".skeleton")
      .evaluate((e) => getComputedStyle(e).animationName)) === "none",
    "reduced motion",
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await button("Buka rincian").click();
  await geometry("landscape");
  await page.getByRole("button", { name: "Selesai", exact: true }).click();
  check(
    await button("Buka rincian").isVisible(),
    "short viewport dialog scrolls to final action",
  );
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
