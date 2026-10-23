/** Actual Pekerjaan UI with isolated HTTP boundaries. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd();
const out =
  process.env.RECONCILIATION_QA_OUTPUT ??
  join(root, "docs/verification/reconciliation");
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
  entryPoints: [join(root, "tests/ui/reconciliation-fixture.tsx")],
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
        b.onResolve({ filter: /^next\/image$/ }, () => ({
          path: join(root, "tests/ui/settings-image-shim.ts"),
        }));
        b.onResolve({ filter: /^@\/lib\/supabase\/client$/ }, () => ({
          path: join(root, "tests/ui/promotions-storage-shim.ts"),
        }));
        b.onResolve({ filter: /^next\/navigation$/ }, () => ({
          path: join(root, "tests/ui/surveys-navigation-shim.ts"),
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rekonsiliasi QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const checks = [],
  errors = [],
  accessibility = [];
let browser, page;
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function check(ok, name) {
  checks.push({ name, passed: !!ok });
  assert.ok(ok, name);
}
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.UI_CHROMIUM_EXECUTABLE,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  page = await browser.newPage({ hasTouch: true });
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(String(e)));
  const accept = (d) => d.accept();
  page.on("dialog", accept);
  let mode = "ok",
    downloads = 0,
    reads = 0,
    lastUrl;
  const ExcelJS = req("exceljs");
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Ringkasan");
  sheet.addRow(["Metrik", "Nilai"]);
  sheet.addRow(["Saldo", 256000]);
  const bytes = Buffer.from(await book.xlsx.writeBuffer());
  await page.route("**/api/services/**", async (route) => {
    const r = route.request();
    check(r.method() === "GET", "read-only request");
    const url = new URL(r.url());
    lastUrl = url;
    await new Promise((r) => setTimeout(r, 150));
    if (mode === "network") return route.abort("failed");
    if (mode === "503" || mode === "403" || mode === "401")
      return route.fulfill({
        status: Number(mode),
        json: { message: "Layanan belum tersedia." },
      });
    if (
      url.pathname.endsWith("/exports") ||
      url.searchParams.get("format") === "xlsx"
    ) {
      downloads++;
      if (mode === "json")
        return route.fulfill({ status: 200, json: { message: "Unconfirmed" } });
      return route.fulfill({
        status: 200,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        body: mode === "invalid" ? Buffer.from("Invalid body") : bytes,
      });
    }
    reads++;
    const data = await page.evaluate(() => window.reconciliationFixture);
    data.extra.savingsBalance = 0;
    data.extra.pointSnapshots = 10;
    if (mode === "bad-snapshot") data.extra.tables = -1;
    if (mode === "removed") data.classes = [];
    return route.fulfill({ status: 200, json: { data } });
  });
  const pack = () =>
      page.getByRole("button", { name: "Unduh paket XLSX", exact: true }),
    summary = () =>
      page.getByRole("button", { name: "Unduh ringkasan XLSX", exact: true }),
    refresh = () =>
      page.getByRole("button", { name: "Muat ulang ringkasan", exact: true });
  const start = () => page.locator("#reconciliation-start"),
    end = () => page.locator("#reconciliation-end"),
    month = () => page.locator("#reconciliation-month"),
    classes = () => page.locator("#reconciliation-class");
  async function geometry(label) {
    const s = await page.evaluate(() => ({
      w: innerWidth,
      s: document.documentElement.scrollWidth,
    }));
    check(s.s <= s.w + 1, label + " no horizontal overflow");
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
  async function download(button) {
    const [file] = await Promise.all([
      page.waitForEvent("download"),
      button.click(),
    ]);
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await readFile(await file.path()));
    check(
      loaded.worksheets[0].getCell("B2").value === 256000,
      "downloaded real XLSX numeric content",
    );
    await page.getByText(/^File siap diunduh/).waitFor();
    await page.waitForFunction(
      () => !document.querySelector('[aria-busy="true"]'),
    );
    return file;
  }
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base);
    await pack().waitFor();
    await geometry("reconciliation " + width);
    await a11y("reconciliation " + width);
    await page.screenshot({
      path: join(out, "reconciliation-" + width + ".png"),
      fullPage: true,
      animations: "disabled",
    });
  }
  check(
    await page.getByText(/^Data sumber pembanding belum tersedia/).isVisible(),
    "source comparison limitation honest",
  );
  check(
    (await page.getByText("Belum ada data sesuai filter dan izin.").count()) ===
      0,
    "no false empty state when rows empty",
  );
  await start().fill("2026-07-01");
  await end().fill("2026-09-30");
  await month().fill("2026-09");
  await classes().selectOption(id(3));
  const file = await download(pack());
  check(
    file.suggestedFilename() === "rekonsiliasi-paket.xlsx",
    "package filename",
  );
  check(
    lastUrl.searchParams.get("month") === "2026-09-01",
    "month normalized to first day",
  );
  check(lastUrl.searchParams.get("classId") === id(3), "class forwarded");
  check(
    lastUrl.searchParams.get("start") === "2026-07-01" &&
      lastUrl.searchParams.get("end") === "2026-09-30",
    "date range forwarded",
  );
  check(
    lastUrl.searchParams.get("domains") ===
      "attendance,mentoring,fees,savings,discipline",
    "five legacy domains preserved",
  );
  const summaryFile = await download(summary());
  check(
    summaryFile.suggestedFilename() === "rekonsiliasi-ringkasan.xlsx",
    "summary filename",
  );
  check(
    lastUrl.pathname === "/api/services/reconciliation" &&
      lastUrl.searchParams.get("format") === "xlsx",
    "summary endpoint independent of filters",
  );
  const before = downloads;
  const got = page.waitForEvent("download");
  await pack().evaluate((e) => {
    e.click();
    e.click();
  });
  await got;
  await page.getByText(/^File siap diunduh/).waitFor();
  await page.waitForFunction(
    () => !document.querySelector('[aria-busy="true"]'),
  );
  check(downloads === before + 1, "synchronous download lock");
  const oldDownloads = downloads;
  await start().fill("2026-12-01");
  await page
    .locator("form")
    .evaluate((e) =>
      e.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
  await page
    .getByText("Tanggal akhir harus sama atau setelah tanggal awal.", {
      exact: true,
    })
    .waitFor();
  check(downloads === oldDownloads, "invalid range rejected without network");
  await start().fill("2026-07-01");
  await refresh().click();
  await page.getByText(/^Ringkasan diperbarui/).waitFor();
  check(
    (await start().inputValue()) === "2026-07-01" &&
      (await month().inputValue()) === "2026-09" &&
      (await classes().inputValue()) === id(3),
    "refresh preserves export draft",
  );
  check(reads === 1, "refresh loads once");
  const balance = page
    .locator("dl > div")
    .filter({ has: page.getByText("Saldo tabungan", { exact: true }) })
    .locator("dd");
  check(
    (await balance.innerText()).includes("0"),
    "zero saldo renders after refresh",
  );
  for (const failure of ["503", "403", "401", "network", "json", "invalid"]) {
    mode = failure;
    await pack().click();
    await page.getByRole("alert").waitFor();
    check(await pack().isEnabled(), failure + " allows manual read retry");
    check(
      (await start().inputValue()) === "2026-07-01",
      failure + " preserves draft",
    );
  }
  mode = "bad-snapshot";
  await refresh().click();
  await page.getByText(/^Ringkasan belum valid/).waitFor();
  check(
    (await balance.innerText()).includes("0"),
    "malformed reload does not replace snapshot",
  );
  mode = "ok";
  await refresh().click();
  await page.getByText(/^Ringkasan diperbarui/).waitFor();
  await classes().selectOption(id(3));
  mode = "removed";
  await refresh().click();
  await page.getByText(/^Ringkasan diperbarui/).waitFor();
  const staleDownloads = downloads;
  await pack().click();
  await page.getByText(/^Pilihan kelas berubah/).waitFor();
  check(
    downloads === staleDownloads,
    "stale class cannot silently widen export",
  );
  await classes().selectOption("");
  mode = "ok";
  await refresh().click();
  await page.getByText(/^Ringkasan diperbarui/).waitFor();
  await page.setViewportSize({ width: 320, height: 850 });
  const touchDownload = page.waitForEvent("download");
  await summary().tap();
  await touchDownload;
  await page.getByText(/^File siap diunduh/).waitFor();
  check(await summary().isEnabled(), "mobile touch download");
  await page.setViewportSize({ width: 844, height: 390 });
  await geometry("landscape");
  await start().focus();
  let reached = false;
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    if (await end().evaluate((e) => document.activeElement === e)) {
      reached = true;
      break;
    }
  }
  check(reached, "native date keyboard reaches next field");
  await a11y("landscape");
  await page.goto(base + "/?empty=1");
  await pack().waitFor();
  check(
    (await classes().locator("option").count()) === 1,
    "empty class catalog has explicit all option",
  );
  check(
    (await page.locator("dl").innerText()).includes("0"),
    "empty metrics retain legitimate zero",
  );
  await a11y("empty");
  check(!errors.length, "no JavaScript page errors");
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
