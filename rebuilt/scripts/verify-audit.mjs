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
  process.env.AUDIT_QA_OUTPUT ?? join(root, "docs/verification/audit");
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
  entryPoints: [join(root, "tests/ui/audit-fixture.tsx")],
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
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const entry = (n) => ({
  id: id(n),
  at: "2026-10-25T00:00:00+00:00",
  actorId: id(100),
  actorLabel: "Admin QA",
  actorKind: "user",
  action: "grades.batch",
  entityType: "grades",
  entityId: id(200),
  requestId: id(300),
  metadata: {
    command: { type: "batch", classId: id(200), reasonProvided: true },
    before: {
      value: 0,
      scores: Array.from({ length: 25 }, (_, i) => ({
        student_id: id(1000 + i),
        value: i === 0 ? 0 : null,
      })),
    },
    after: {
      value: 82,
      scores: Array.from({ length: 25 }, (_, i) => ({
        student_id: id(1000 + i),
        value: 82,
      })),
    },
  },
});
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.UI_CHROMIUM_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({ hasTouch: true });
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  let outcome = "success",
    requests = 0,
    release;
  await page.route("**/api/audit?*", async (route) => {
    requests++;
    const url = new URL(route.request().url());
    check(route.request().method() === "GET", "read only");
    check(!url.searchParams.has("actor"), "no claimed actor");
    if (outcome === "hold") await new Promise((r) => (release = r));
    if (outcome === "offline") return route.abort();
    if (["401", "403", "503"].includes(outcome))
      return route.fulfill({
        status: Number(outcome),
        json: { message: "PRIVATE_SERVER" },
      });
    const domain = url.searchParams.get("domain"),
      second = url.searchParams.has("before"),
      rows =
        outcome === "empty"
          ? []
          : second
            ? [entry(26)]
            : Array.from({ length: 25 }, (_, i) => entry(i + 1));
    if (domain) for (const row of rows) row.action = domain + ".publish";
    const data = {
      version: 1,
      domain,
      rows,
      next:
        rows.length === 25 ? { at: rows.at(-1).at, id: rows.at(-1).id } : null,
    };
    if (outcome === "malformed")
      data.rows[0].metadata.command.password = "PRIVATE_SECRET";
    if (outcome === "wrong-scope") data.domain = domain ? "reports" : "grades";
    return route.fulfill({ json: { data } });
  });
  const button = () =>
    page.getByRole("button", { name: "Muat riwayat", exact: true });
  async function visit() {
    outcome = "success";
    requests = 0;
    await page.goto(base);
    await button().waitFor();
  }
  async function load() {
    await button().click();
    await page.getByRole("list", { name: "Daftar riwayat" }).waitFor();
  }
  async function axeCheck(label) {
    await page.addScriptTag({ content: axe });
    const result = await page.evaluate(() =>
      window.axe.run(document.body, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      }),
    );
    accessibility.push({ label, violations: result.violations });
    check(result.violations.length === 0, label + " axe");
  }
  async function overflow(label) {
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      label + " no page overflow",
    );
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    await visit();
    check(requests === 0, "no automatic request");
    await page
      .getByText("Aturan status dan koreksi data", { exact: true })
      .click();
    check(
      await page.getByText("Arsip terbit tetap.", { exact: false }).isVisible(),
      "archive rule",
    );
    await axeCheck("rules " + width);
    await load();
    await overflow("loaded " + width);
    await axeCheck("history " + width);
    const trigger = page.getByRole("button", { name: /Lihat rincian/ }).first();
    if (width === 320) await trigger.tap();
    else await trigger.click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    check((await dialog.getByText("0", { exact: true }).count()) > 0, "zero");
    check(
      (await dialog.getByText("Belum diisi", { exact: true }).count()) > 0,
      "null distinct",
    );
    check(
      await dialog
        .getByText("Alasan diisi pada transaksi sumber.", { exact: false })
        .isVisible(),
      "reason not duplicated",
    );
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      check(
        await dialog.evaluate((el) => el.contains(document.activeElement)),
        "focus contained",
      );
    }
    await overflow("dialog " + width);
    await axeCheck("dialog " + width);
    check(
      await dialog.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.left >= 0 &&
          r.right <= innerWidth + 1 &&
          r.top >= 0 &&
          r.bottom <= innerHeight + 1
        );
      }),
      "bounded dialog",
    );
    await dialog
      .getByRole("button", { name: "Nilai berikutnya", exact: true })
      .click();
    check(
      await dialog.getByText("Halaman 2 dari 3", { exact: true }).isVisible(),
      "score pagination",
    );
    await page.screenshot({
      path: join(out, `audit-${width}.png`),
      fullPage: false,
    });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    check(
      await trigger.evaluate((el) => el === document.activeElement),
      "return focus",
    );
    await page
      .getByRole("button", { name: "Riwayat berikutnya", exact: true })
      .click();
    await page.getByText("Halaman 2", { exact: true }).waitFor();
    check(
      (await page
        .getByRole("list", { name: "Daftar riwayat" })
        .locator("li")
        .count()) === 1,
      "next cursor",
    );
    await page
      .getByRole("button", { name: "Riwayat sebelumnya", exact: true })
      .click();
    await page.getByText("Halaman 1", { exact: true }).waitFor();
  }
  await page.setViewportSize({ width: 850, height: 390 });
  await visit();
  await load();
  await page
    .getByRole("button", { name: /Lihat rincian/ })
    .first()
    .click();
  await page.setViewportSize({ width: 390, height: 850 });
  await overflow("open portrait resize");
  await page.setViewportSize({ width: 850, height: 390 });
  await overflow("landscape");
  await axeCheck("landscape dialog");
  await page.keyboard.press("Escape");
  await visit();
  await load();
  await page.getByLabel("Modul riwayat").selectOption("reports");
  check(
    (await page.getByRole("list", { name: "Daftar riwayat" }).count()) === 0,
    "old scope cleared",
  );
  await load();
  check(
    (await page.getByText("Rapor · Terbitkan", { exact: true }).count()) === 25,
    "filter applied",
  );
  for (const mode of [
    "empty",
    "401",
    "403",
    "503",
    "offline",
    "malformed",
    "wrong-scope",
  ]) {
    await visit();
    outcome = mode;
    await button().click();
    if (mode === "empty")
      await page
        .getByText("Belum ada aktivitas tercatat untuk pilihan ini.", {
          exact: true,
        })
        .waitFor();
    else await page.getByRole("alert").waitFor();
    check(
      (await page.getByRole("list", { name: "Daftar riwayat" }).count()) === 0,
      mode + " no stale data",
    );
    check(
      !(await page.locator("body").innerText()).includes("PRIVATE_"),
      mode + " private error hidden",
    );
    await axeCheck(mode);
    await overflow(mode);
  }
  await visit();
  outcome = "hold";
  await button().click();
  await page
    .getByRole("button", { name: "Memuat riwayat…", exact: true })
    .waitFor();
  check(
    await page.getByLabel("Modul riwayat").isDisabled(),
    "pending scope lock",
  );
  check(requests === 1, "one pending");
  await axeCheck("loading");
  release();
  await page.getByRole("list", { name: "Daftar riwayat" }).waitFor();
  await visit();
  outcome = "hold";
  await button().click();
  await page.getByRole("alert").waitFor({ timeout: 15000 });
  check(await button().isEnabled(), "timeout releases controls");
  check(
    (await page.getByRole("list", { name: "Daftar riwayat" }).count()) === 0,
    "timeout no stale",
  );
  release();
  check(errors.length === 0, "no JavaScript errors");
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
  await writeFile(
    join(out, "failure.json"),
    JSON.stringify(
      { error: String(e), checks, accessibility, errors },
      null,
      2,
    ),
  );
  throw e;
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
