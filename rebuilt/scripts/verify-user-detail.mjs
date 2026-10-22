/** Isolated Directory browser regression suite. No real account, API mutation or production data. */
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
  process.env.USER_DETAIL_QA_OUTPUT ??
  join(root, "docs/verification/user-detail");
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
  entryPoints: [join(root, "tests/ui/user-detail-fixture.tsx")],
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
          path: join(root, "tests/ui/user-detail-navigation-shim.ts"),
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Direktori QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
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
  for (const link of await page.locator("main a,main button").all()) {
    const b = await link.boundingBox();
    if (b)
      check(
        b.x >= -1 && b.x + b.width <= size.viewport + 1,
        name + " action fits",
        b,
      );
  }
  await page.locator("footer").scrollIntoViewIfNeeded();
  const b = await page.locator("footer").boundingBox();
  check(
    b &&
      b.y >= -1 &&
      b.y + b.height <= (await page.evaluate(() => innerHeight)) + 1,
    name + " footer reachable",
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
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.UI_CHROMIUM_EXECUTABLE,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const context = await browser.newContext({
      hasTouch: true,
      reducedMotion: "reduce",
    }),
    page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  async function visit(scenario = "teacher", width = 375, height = 812) {
    await page.setViewportSize({ width, height });
    await page.goto(base + "/?scenario=" + scenario);
    await page.locator("main h1").waitFor();
  }
  for (const [w, h] of [
    [320, 700],
    [360, 800],
    [375, 812],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1280, 900],
    [1440, 900],
    [812, 375],
    [812, 240],
  ]) {
    await visit("long", w, h);
    await geometry(page, "long " + w + "x" + h);
    if ([320, 768, 1440].includes(w)) await a11y(page, "long " + w);
    if ([320, 1440].includes(w))
      await page.screenshot({
        path: join(out, (baseline ? "baseline-" : "") + "detail-" + w + ".png"),
        fullPage: true,
      });
  }
  for (const width of [320, 1280])
    for (const zoom of [200, 400]) {
      await visit("long", width, 800);
      await page.addStyleTag({ content: `html{font-size:${zoom}%!important}` });
      await geometry(page, width + " text " + zoom);
    }
  for (const width of [320, 1440]) {
    await visit("teacher", width, 900);
    await page.screenshot({
      path: join(out, "detail-normal-" + width + ".png"),
      fullPage: true,
    });
  }
  await visit();
  check(
    await page
      .getByRole("navigation", { name: "Breadcrumb" })
      .innerText()
      .then((t) => t.includes("Detail pengguna")),
    "breadcrumb identifies detail page",
  );
  check(
    (await page.getByText("Senin · 07:00–08:35").count()) === 1,
    "schedule day and time unchanged",
  );
  check(
    (await page.getByText("2 JTM + istirahat 15 menit").count()) === 1,
    "schedule duration preserved",
  );
  check(
    (await page.getByText("Belum berlaku", { exact: true }).count()) === 1,
    "future assignment distinguished",
  );
  check(
    (await page.getByText("Berakhir", { exact: true }).count()) === 1,
    "expired assignment distinguished",
  );
  check(
    !(await page.locator('time[datetime="2026-02-31"]').count()),
    "impossible calendar date never rendered as valid time",
  );
  for (const scenario of [
    "student",
    "parent",
    "restricted",
    "empty",
    "empty-teacher",
    "admin",
    "customer",
    "applicant",
    "alumni",
    "inactive",
    "many",
  ]) {
    await visit(scenario, 320, 700);
    await geometry(page, scenario);
    await a11y(page, scenario);
    if (scenario === "student") {
      check(
        (await page.locator('main a[href^="/account/biodata/"]').count()) === 1,
        "authorized biodata target retained",
      );
      check(
        !(await page
          .locator("main")
          .innerText()
          .then((t) => t.includes("synthetic-sensitive"))),
        "private raw student fields not rendered",
      );
    }
    if (scenario === "parent")
      check(
        (await page.locator('main a[href^="/account/directory/"]').count()) ===
          1,
        "related child detail link retained",
      );
    if (scenario === "restricted" || scenario === "empty") {
      check(
        !(await page
          .locator("main")
          .innerText()
          .then((t) => t.includes("Kontak dan profil"))),
        "restricted contact remains absent",
      );
      check(
        (await page
          .getByText("Belum ada riwayat kelas yang dapat ditampilkan.")
          .count()) === 1,
        "empty history explained",
      );
    }
    if (scenario === "many")
      check(
        (await page.locator("main li").count()) === 300,
        "large dataset retains all records",
      );
  }
  for (const scenario of ["loading", "error", "unavailable"]) {
    await visit(scenario, 320, 700);
    await geometry(page, scenario);
    await a11y(page, scenario);
    for (const zoom of [200, 400]) {
      await page.addStyleTag({ content: `html{font-size:${zoom}%!important}` });
      await geometry(page, scenario + " text " + zoom);
    }
    await visit(scenario, 320, 700);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    check(
      await page.locator("main").evaluate((e) => e === document.activeElement),
      scenario + " skip link focus",
    );
    if (scenario === "loading")
      check(
        (await page.locator("main h1").innerText()) ===
          "Memuat detail pengguna",
        "loading uses detail context",
      );
    if (scenario === "error") {
      check(
        !(await page
          .locator("main")
          .innerText()
          .then((t) => t.includes("private"))),
        "error hides internal details",
      );
      await page.getByRole("button", { name: "Coba kembali" }).click();
      check(
        await page.evaluate(
          () => document.documentElement.dataset.retried === "true",
        ),
        "error reset action runs",
      );
    }
  }
  await visit("student", 375, 812);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  check(
    await page.locator("main").evaluate((e) => e === document.activeElement),
    "detail skip focus",
  );
  await page
    .getByRole("link", { name: "Buka biodata dan dokumen sesuai izin" })
    .focus();
  check(
    await page
      .getByRole("link", { name: "Buka biodata dan dokumen sesuai izin" })
      .evaluate((e) => e === document.activeElement),
    "record link keyboard reachable",
  );
  await page.getByRole("button", { name: "Buka navigasi" }).click();
  check(await page.getByRole("dialog").isVisible(), "mobile navigation opens");
  await page.keyboard.press("Escape");
  check(
    !(await page.getByRole("dialog").count()),
    "mobile navigation closes with Escape",
  );
  check(
    await page
      .getByRole("button", { name: "Buka navigasi" })
      .evaluate((e) => e === document.activeElement),
    "navigation restores focus",
  );
  for (const [w, h] of [
    [812, 375],
    [1280, 900],
    [375, 812],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await geometry(page, "orientation " + w);
    check(
      (await page.locator("main h1").innerText()) === "Pengguna Detail",
      "orientation keeps record",
    );
  }
  await page.emulateMedia({ forcedColors: "active" });
  await geometry(page, "forced colors");
  await a11y(page, "forced colors");
  check(!errors.length, "no JavaScript/console errors", errors);
  await context.close();
  const result = {
    status: issues.length ? "issues" : "passed",
    baseline,
    checks,
    issues,
    axe: axeResults,
    errors,
    limitations: [
      "Actual components with synthetic role-scoped data in isolated workspace fixture.",
      "Server/API and SQL authorization are tested separately; not live role UAT.",
    ],
  };
  await writeFile(
    join(out, baseline ? "baseline-results.json" : "browser-results.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      status: result.status,
      checks: checks.length,
      issues,
      axeViews: axeResults.length,
    }),
  );
} catch (e) {
  await writeFile(
    join(out, baseline ? "baseline-failure.json" : "failure.json"),
    JSON.stringify({ error: e.message, checks, issues, errors }, null, 2),
  );
  throw e;
} finally {
  await browser?.close();
  server.close();
}
