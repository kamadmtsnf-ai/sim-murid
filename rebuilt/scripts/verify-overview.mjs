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
  process.env.OVERVIEW_QA_OUTPUT ?? join(root, "docs/verification/overview");
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
  entryPoints: [join(root, "tests/ui/overview-fixture.tsx")],
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
  let outcome = "success",
    release,
    requests = 0,
    discard = true;
  page.on("dialog", (d) => (discard ? d.accept() : d.dismiss()));
  await page.route("**/api/account/overview", async (route) => {
    requests++;
    check(
      route.request().method() === "GET" &&
        !new URL(route.request().url()).search,
      "refresh is read only without actor/scope parameters",
    );
    if (outcome === "hold" || outcome === "timeout")
      await new Promise((r) => (release = r));
    if (outcome === "offline") return route.abort();
    if (outcome === "401" || outcome === "403")
      return route.fulfill({ status: Number(outcome), body: "not json" });
    if (outcome === "500")
      return route.fulfill({
        status: 503,
        json: { message: "private database detail" },
      });
    if (outcome === "malformed")
      return route.fulfill({ json: { overview: { value: 99 } } });
    const data = await page.evaluate(() => window.overviewFixture);
    if (outcome === "wrong-owner")
      data.subject = "00000000-0000-4000-8000-000000000002";
    data.loadedAt = "2026-10-24T02:00:00.000Z";
    const n = data.metrics.find((m) => m.id === "notifications");
    if (n) n.value = 17;
    try {
      await route.fulfill({ json: { overview: data } });
    } catch {
      /* timeout/unmount intentionally aborts the request */
    }
  });
  const button = () =>
    page.getByRole("button", { name: "Perbarui ringkasan", exact: true });
  async function visit(
    role = "teacher",
    mode = "normal",
    width = 1440,
    height = 900,
  ) {
    outcome = "success";
    requests = 0;
    await page.setViewportSize({ width, height });
    await page.goto(base + "?role=" + role + "&mode=" + mode);
    await page
      .getByRole("heading", {
        name: "Ringkasan pekerjaan hari ini",
        exact: true,
      })
      .waitFor();
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
    const ids = await page
      .locator("[data-overview-source]")
      .evaluateAll((nodes) => nodes.map((n) => n.dataset.overviewSource));
    check(
      ids.includes("jobs") === (role === "admin"),
      role + " administrator-only job source",
    );
    check(
      ids.includes("schedule") ===
        ["admin", "teacher", "student", "parent"].includes(role),
      role + " relevant academic source",
    );
    check(
      !(await page.getByText(/PRIVATE/).count()),
      role + " raw source identities and bodies not rendered",
    );
    await a11y(role);
  }
  for (const mode of [
    "normal",
    "long",
    "partial",
    "empty",
    "unavailable",
    "holiday",
    "multi",
    "unknown-fee",
    "no-grants",
  ]) {
    await visit(mode === "unknown-fee" ? "parent" : "teacher", mode, 320, 700);
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      mode + " mobile overflow",
    );
    await a11y(mode + " mobile");
    if (mode === "partial") {
      check(
        (await page
          .locator("[data-overview-source=attendance]")
          .getByText("Belum tersedia", { exact: true })
          .count()) === 1,
        "unavailable source is not a false zero",
      );
      check(
        (await page
          .locator("[data-overview-source=notifications]")
          .getByText("205", { exact: true })
          .count()) === 1,
        "valid source survives partial failure",
      );
    }
    if (mode === "holiday")
      check(
        (await page
          .locator("[data-overview-source=schedule]")
          .getByText("Hari libur", { exact: true })
          .count()) === 1 &&
          !(await page
            .getByText("Periksa jadwal berikutnya", { exact: true })
            .count()),
        "holiday suppresses lesson priority",
      );
    if (mode === "unknown-fee")
      check(
        (await page
          .getByText("Tarif belum lengkap", { exact: true })
          .count()) === 1,
        "unknown tariff is not a false paid/zero value",
      );
    for (const [width, height] of [
      [390, 844],
      [768, 900],
      [1440, 900],
      [844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        mode + " overflow " + width + "x" + height,
      );
    }
  }
  for (const width of [320, 390, 768, 1440]) {
    await visit("teacher", "multi", width);
    await a11y("multi " + width);
    check(
      await button().evaluate((e) => e.getBoundingClientRect().height >= 44),
      "refresh touch target " + width,
    );
    await page.screenshot({
      path: join(out, "overview-" + width + ".png"),
      fullPage: true,
    });
  }
  await visit();
  outcome = "hold";
  await button().evaluate((b) => {
    b.click();
    b.click();
  });
  await page
    .getByRole("button", { name: "Memperbarui…", exact: true })
    .waitFor();
  check(requests === 1, "double refresh sends one request");
  release();
  await page
    .getByText("Ringkasan berhasil diperbarui.", { exact: true })
    .waitFor();
  check(
    (await page
      .locator("[data-overview-source=notifications]")
      .getByText("17", { exact: true })
      .count()) === 1,
    "confirmed refresh replaces snapshot",
  );
  await page.waitForFunction(
    () =>
      document.activeElement?.getAttribute("role") === "status" &&
      document.activeElement.textContent.includes(
        "Ringkasan berhasil diperbarui.",
      ),
  );
  check(true, "refresh feedback receives keyboard focus");
  for (const failure of ["offline", "500", "malformed"]) {
    await visit();
    outcome = failure;
    await button().click();
    await page
      .getByText("Ringkasan belum dapat diperbarui.", { exact: false })
      .waitFor();
    check(
      (await page
        .locator("[data-overview-source=notifications]")
        .getByText("205", { exact: true })
        .count()) === 1,
      failure + " keeps timestamped last snapshot",
    );
    check(
      requests === 1 &&
        !(await page.getByText("private database detail").count()),
      failure + " no automatic replay or raw errors",
    );
  }
  for (const failure of ["401", "403", "wrong-owner"]) {
    await visit();
    outcome = failure;
    await button().click();
    await page.waitForFunction(
      () => !document.querySelector("[data-overview-source]"),
    );
    check(
      !(await page.locator("[data-overview-source]").count()),
      failure + " clears previous private summary",
    );
  }
  await visit();
  await page.evaluate(() => {
    const old = window.overviewFixture;
    window.replaceOverview({
      ...old,
      subject: "00000000-0000-4000-8000-000000000002",
      loadedAt: "2026-10-24T03:00:00.000Z",
      role: "applicant",
      metrics: [],
      tasks: [],
      agenda: [],
      agendaCount: 0,
    });
  });
  await page.waitForFunction(
    () => !document.querySelector("[data-overview-source]"),
  );
  check(true, "new server account context remounts old private summary");
  await visit();
  outcome = "hold";
  await button().click();
  await page
    .getByRole("button", { name: "Memperbarui…", exact: true })
    .waitFor();
  await page.evaluate(() => window.unmountOverview());
  release();
  await page.waitForTimeout(100);
  check(
    !(await page
      .getByText("Ringkasan berhasil diperbarui.", { exact: true })
      .count()),
    "unmount ignores late response",
  );
  await visit();
  await page.clock.install();
  outcome = "timeout";
  await button().click();
  await page.waitForFunction(() => document.querySelector("button:disabled"));
  await page.clock.fastForward(13000);
  await page
    .getByText("Ringkasan belum dapat diperbarui.", { exact: false })
    .waitFor();
  check(requests === 1, "read timeout never repeats request");
  release();
  await page.clock.resume();
  check(
    !(await page.evaluate(() =>
      Object.values(localStorage).some(
        (v) => v.includes("205") || v.includes("123000"),
      ),
    )),
    "operational snapshot not stored in browser drafts",
  );
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
