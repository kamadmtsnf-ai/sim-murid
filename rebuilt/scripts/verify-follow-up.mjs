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
  process.env.FOLLOW_UP_QA_OUTPUT ?? join(root, "docs/verification/follow-up");
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
  entryPoints: [join(root, "tests/ui/follow-up-fixture.tsx")],
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
  const context = await browser.newContext({ hasTouch: true });
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  let outcome = "success",
    requests = 0,
    release;
  await page.route("**/api/account/follow-up", async (route) => {
    requests++;
    check(
      route.request().method() === "GET" &&
        !new URL(route.request().url()).search,
      "read-only request, no claimed actor/scope",
    );
    if (outcome === "hold" || outcome === "timeout")
      await new Promise((r) => (release = r));
    if (outcome === "offline") return route.abort();
    if (["401", "403"].includes(outcome))
      return route.fulfill({ status: Number(outcome), body: "not-json" });
    if (outcome === "503")
      return route.fulfill({
        status: 503,
        json: { message: "private diagnostics" },
      });
    if (outcome === "malformed")
      return route.fulfill({ json: { followUp: { items: [] } } });
    const data = await page.evaluate(() => window.followUpFixture);
    if (outcome === "wrong-owner")
      data.subject = "00000000-0000-4000-8000-000000000088";
    if (outcome === "complete") {
      for (const i of data.items.filter((i) => i.source === "plans")) {
        i.status = "done";
        i.urgency = "info";
        i.required = false;
      }
    }
    return route.fulfill({ json: { followUp: data } });
  });
  const tab = () =>
    page.getByRole("tab", { name: "Tindak lanjut", exact: true });
  const button = () =>
    page.getByRole("button", { name: /^(Muat|Perbarui) tindak lanjut$/ });
  async function visit(query = "") {
    outcome = "success";
    requests = 0;
    await page.goto(base + "/?" + query);
    await tab().click();
    await button().waitFor();
  }
  async function load() {
    await button().click();
    await page.getByRole("heading", { name: /Daftar tindak lanjut/ }).waitFor();
    await page
      .getByRole("button", { name: "Perbarui tindak lanjut", exact: true })
      .waitFor();
  }
  async function axeCheck(label) {
    await page.addScriptTag({ content: axe });
    const result = await page.evaluate(() =>
      window.axe.run(document.querySelector("main"), {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      }),
    );
    accessibility.push({ label, violations: result.violations });
    check(result.violations.length === 0, label + " axe");
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    await visit("mode=long");
    await load();
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      width + " no horizontal overflow",
    );
    check(
      (await page.getByText("Lewat target", { exact: false }).count()) > 0,
      width + " actual overdue visible",
    );
    await axeCheck("loaded " + width);
    await page.screenshot({
      path: join(out, `follow-up-${width}.png`),
      fullPage: true,
    });
    await page
      .getByLabel("Tampilkan informasi opsional dan riwayat selesai")
      .uncheck();
    check(
      (await page.getByText("Lewat target", { exact: false }).count()) > 0,
      width + " required remains after preference",
    );
  }
  for (const role of [
    "teacher",
    "student",
    "parent",
    "customer",
    "alumni",
    "applicant",
  ]) {
    await visit("role=" + role);
    await load();
    check(
      (await page.getByText("Petugas QA", { exact: true }).count()) === 0,
      role + " no plan disclosure",
    );
  }
  for (const mode of ["empty", "partial", "unavailable", "many"]) {
    await visit("mode=" + mode);
    await load();
    await axeCheck(mode);
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      mode + " no overflow",
    );
  }
  await page
    .getByLabel("Tampilkan informasi opsional dan riwayat selesai")
    .check();
  await page
    .getByRole("combobox", { name: /^Modul sumber/ })
    .selectOption("plans");
  check(
    (await page
      .getByRole("navigation", { name: "Halaman tindak lanjut" })
      .count()) === 1,
    "many plans paginated",
  );
  await page.getByRole("button", { name: "Berikutnya", exact: true }).click();
  check(
    (await page.getByText("Halaman 2 dari 4", { exact: false }).count()) === 1,
    "pagination advances",
  );
  await page.getByLabel("Cari tindak lanjut").fill("not-found");
  check(
    (await page
      .getByText("Tidak ada butir yang sesuai", { exact: false })
      .count()) === 1,
    "search empty state",
  );
  await visit();
  outcome = "hold";
  await button().click();
  await page.waitForFunction(() => document.querySelector("button:disabled"));
  await page.evaluate(() => document.querySelector("button:disabled")?.click());
  check(requests === 1, "double submit lock");
  release();
  await page.getByRole("heading", { name: /Daftar tindak lanjut/ }).waitFor();
  outcome = "complete";
  await load();
  await page
    .getByLabel("Tampilkan informasi opsional dan riwayat selesai")
    .check();
  await page
    .getByRole("combobox", { name: /^Modul sumber/ })
    .selectOption("plans");
  await page
    .getByRole("combobox", { name: /^Status pekerjaan/ })
    .selectOption("done");
  check(
    (await page
      .locator("dd")
      .getByText("Selesai di sumber", { exact: true })
      .count()) === 3,
    "completion follows refreshed source",
  );
  for (const state of ["offline", "503", "malformed"]) {
    outcome = state;
    await button().click();
    await page
      .getByText("Tindak lanjut belum dapat diperbarui.", { exact: false })
      .waitFor();
    check(
      (await page
        .getByRole("heading", { name: /Daftar tindak lanjut/ })
        .count()) === 1,
      state + " previous snapshot marked stale",
    );
    check(
      !(await page.locator("body").innerText()).includes("private diagnostics"),
      state + " private error redacted",
    );
  }
  for (const state of ["401", "403", "wrong-owner"]) {
    await visit();
    await load();
    outcome = state;
    await button().click();
    await page.getByRole("alert").waitFor();
    check(
      (await page
        .getByRole("heading", { name: /Daftar tindak lanjut/ })
        .count()) === 0,
      state + " clears private snapshot",
    );
  }
  await visit();
  await load();
  await page.evaluate(() => window.changeFollowUpAccount());
  check(
    (await page
      .getByRole("heading", { name: /Daftar tindak lanjut/ })
      .count()) === 0,
    "account remount clears old data",
  );
  await visit();
  await page
    .getByLabel("Tampilkan informasi opsional dan riwayat selesai")
    .uncheck();
  await page.reload();
  await tab().click();
  check(
    !(await page
      .getByLabel("Tampilkan informasi opsional dan riwayat selesai")
      .isChecked()),
    "preference restored per account",
  );
  const secondTab = await page.context().newPage();
  await secondTab.goto(base);
  await secondTab
    .getByRole("tab", { name: "Tindak lanjut", exact: true })
    .click();
  await secondTab
    .getByLabel("Tampilkan informasi opsional dan riwayat selesai")
    .check();
  await page.waitForFunction(
    () => document.querySelector('input[type="checkbox"]')?.checked === true,
  );
  check(true, "other tab preference sync");
  await secondTab.close();
  check(
    await page.evaluate(() =>
      Object.values(localStorage).every(
        (v) => !v.includes("Petugas") && !v.includes("items"),
      ),
    ),
    "storage contains no operational snapshots",
  );
  await visit();
  outcome = "timeout";
  await page.clock.install();
  await button().click();
  await page.waitForFunction(() => document.querySelector("button:disabled"));
  await page.clock.fastForward(21000);
  await page
    .getByText("Tindak lanjut belum dapat diperbarui.", { exact: false })
    .waitFor();
  check(requests === 1, "timeout never retries");
  release();
  await page.clock.resume();
  await visit();
  outcome = "hold";
  await button().click();
  await page.waitForFunction(() => document.querySelector("button:disabled"));
  await page.evaluate(() => window.unmountFollowUp());
  release();
  await page.waitForTimeout(100);
  check(
    (await page
      .getByRole("heading", { name: /Daftar tindak lanjut/ })
      .count()) === 0,
    "unmount ignores late response",
  );
  await visit();
  await page.getByRole("tab", { name: "Kotak masuk", exact: true }).click();
  check(
    (await page
      .getByRole("heading", { name: "Kotak masuk Anda", exact: true })
      .count()) === 1,
    "inbox unchanged and independently accessible",
  );
  await page.getByRole("tab", { name: "Kotak masuk", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(()=>document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.includes("Tindak lanjut"));
  check(
    (await tab().getAttribute("data-state")) === "active",
    "keyboard tab activation",
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await visit();
  await load();
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "landscape no horizontal overflow",
  );
  await page
    .getByRole("combobox", { name: /^Urgensi/ })
    .selectOption("overdue");
  check(
    (await page.getByRole("listitem").count()) === 1,
    "urgency filter isolates overdue source",
  );
  check(
    await page.evaluate(
      () =>
        document.activeElement?.id === "follow-up-results" ||
        document.activeElement?.tagName === "SELECT",
    ),
    "keyboard result focus remains usable",
  );
  await page.evaluate(() => {
    Object.defineProperty(Storage.prototype, "setItem", {
      value: () => {
        throw Error("blocked");
      },
      configurable: true,
    });
  });
  await page
    .getByLabel("Tampilkan informasi opsional dan riwayat selesai")
    .uncheck();
  await page
    .getByText("Preferensi berlaku sementara", { exact: false })
    .waitFor();
  check(true, "blocked storage uses temporary preference");
  await visit();
  await page.getByRole("tab", { name: "Kotak masuk", exact: true }).click();
  let notifyWrites = 0,
    notifyRelease;
  await page.route("**/api/services/notifications", async (route) => {
    if (route.request().method() === "POST") {
      notifyWrites++;
      await new Promise((r) => (notifyRelease = r));
      return route.fulfill({ json: { result: { code: "saved" } } });
    }
    const data = await page.evaluate(() => window.notificationFixture);
    data.extra.unread = 0;
    data.rows[0].read_at = "2026-10-24T02:00:00Z";
    return route.fulfill({ json: { data } });
  });
  await page
    .getByRole("button", { name: "Tandai dibaca: Pesan sintetis", exact: true })
    .click();
  await page.waitForFunction(() => document.querySelector("button:disabled"));
  for(let i=0;!notifyRelease&&i<100;i++) await page.waitForTimeout(10);
  check(typeof notifyRelease === "function", "inbox request reached handler");
  await tab().click();
  notifyRelease();
  await page.getByRole("tab", { name: "Kotak masuk", exact: true }).click();
  await page
    .locator("article")
    .getByText("Sudah dibaca", { exact: true })
    .waitFor();
  check(
    notifyWrites === 1,
    "tab switching preserves pending inbox write without duplicate submission",
  );
  await tab().click();
  await load();
  check(
    (await page
      .locator("dd")
      .getByText("Selesai di sumber", { exact: true })
      .count()) === 1,
    "read acknowledgement does not complete source tasks",
  );
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
