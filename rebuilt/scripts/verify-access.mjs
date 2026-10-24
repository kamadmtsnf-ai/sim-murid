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
  process.env.ACCESS_QA_OUTPUT ?? join(root, "docs/verification/access");
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
  entryPoints: [join(root, "tests/ui/access-fixture.tsx")],
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hak akses saya QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
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
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  page = await browser.newPage({ hasTouch: true });
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(String(e)));
  let mode = "ok",
    reads = 0,
    stored,
    delay = 120;
  await page.route("**/api/auth/access", async (route) => {
    reads++;
    await new Promise((r) => setTimeout(r, delay));
    if (mode === "network") return route.abort();
    if (mode === "401") return route.fulfill({ status: 401, body: "not JSON" });
    if (mode === "gate")
      return route.fulfill({
        status: 403,
        json: { destination: "/account/security" },
      });
    if (mode === "503")
      return route.fulfill({ status: 503, json: { message: "unavailable" } });
    if (mode === "json") return route.fulfill({ body: "not JSON" });
    if (mode === "bad") return route.fulfill({ json: { role: "teacher" } });
    if (mode === "foreign")
      return route.fulfill({
        json: { ...stored, user_id: "00000000-0000-4000-8000-000000000099" },
      });
    return route.fulfill({ json: stored });
  });
  const button = (name) => page.getByRole("button", { name, exact: true });
  const idle = () =>
    page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  const fresh = async (params = "") => {
    mode = "ok";
    reads = 0;
    delay = 120;
    await page.goto(base + "/" + params);
    await page.getByRole("heading", { level: 1 }).waitFor();
    if (!params.includes("loading")) await idle();
    stored = await page.evaluate(() => window.accessFixture);
  };
  async function geometry(name) {
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      name + " no horizontal overflow",
    );
    check(
      await page
        .locator("main button,main input,main select,main summary")
        .evaluateAll((es) =>
          es.every((e) => {
            const r = e.getBoundingClientRect();
            return (
              r.width === 0 ||
              (r.left >= 0 && r.right <= innerWidth && r.height >= 44)
            );
          }),
        ),
      name + " controls fit and touch44",
    );
  }
  async function a11y(name) {
    await page.addScriptTag({ content: axe });
    const result = await page.evaluate(() =>
      window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      }),
    );
    accessibility.push({ name, violations: result.violations });
    check(!result.violations.length, name + " axe");
  }
  for (const [width, height] of [
    [320, 850],
    [390, 844],
    [768, 1024],
    [1440, 1000],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await fresh("?many=1&long=1");
    await geometry(String(width));
    await a11y(String(width));
    check(
      (await page
        .getByRole("list", { name: "Daftar izin", exact: true })
        .locator(":scope > li")
        .count()) === 10,
      "bounded page " + width,
    );
    await page.screenshot({
      path: join(out, "access-stress-" + width + ".png"),
      fullPage: true,
    });
    await page
      .getByText("Penugasan yang masih berlaku (3)", { exact: true })
      .click();
    await geometry("assignments-" + width);
    check(
      await page.getByRole("list", { name: "Penugasan aktif" }).isVisible(),
      "assignment disclosure " + width,
    );
  }
  await fresh();
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      path: join(out, "access-normal-" + width + ".png"),
      fullPage: true,
    });
  }
  await button("Berikutnya").click();
  check(
    await page.getByText("Halaman 2 dari 2", { exact: true }).isVisible(),
    "pagination next",
  );
  check(
    await page
      .getByRole("heading", { name: "Cakupan izin", exact: true })
      .evaluate((e) => document.activeElement === e),
    "pagination focuses heading",
  );
  await button("Sebelumnya").click();
  check(
    await page.getByText("Halaman 1 dari 2", { exact: true }).isVisible(),
    "pagination previous",
  );
  await page.getByLabel("Cari izin", { exact: true }).fill("profil");
  check(
    (await page
      .getByRole("list", { name: "Daftar izin", exact: true })
      .locator(":scope > li")
      .count()) === 1,
    "search filters labels",
  );
  check(
    await page
      .getByRole("heading", { name: "Lihat Profil", exact: true })
      .isVisible(),
    "search result",
  );
  await page.getByLabel("Layanan", { exact: true }).selectOption("classes");
  check(
    await page
      .getByRole("heading", { name: "Tidak ada izin yang cocok" })
      .isVisible(),
    "filters intersect",
  );
  await button("Reset filter").click();
  check(
    (await page.getByLabel("Cari izin", { exact: true }).inputValue()) === "",
    "reset search",
  );
  await page.getByLabel("Cakupan", { exact: true }).selectOption("class");
  check(
    (await page
      .getByRole("list", { name: "Daftar izin", exact: true })
      .locator(":scope > li")
      .count()) === 1,
    "class scope filter",
  );
  check(
    (await page
      .getByRole("list", { name: "Daftar izin", exact: true })
      .getByText("Kelas 7 · A · 2026/2027", { exact: true })
      .count()) === 1 &&
      (await page
        .getByRole("list", { name: "Daftar izin", exact: true })
        .getByText("Kelas 7 · B · 2026/2027", { exact: true })
        .count()) === 1,
    "different class scopes remain visible",
  );
  await button("Reset filter").click();
  await fresh("?empty=1");
  check(
    await page
      .getByRole("heading", { name: "Belum ada izin untuk ditampilkan" })
      .isVisible(),
    "empty grants explicit",
  );
  await page
    .getByText("Penugasan yang masih berlaku (0)", { exact: true })
    .click();
  check(
    await page
      .getByText("Belum ada penugasan aktif.", { exact: false })
      .isVisible(),
    "empty assignments",
  );
  await a11y("empty");
  await fresh("?missing=1");
  check(
    await page
      .getByText("Nama beberapa kelas belum dapat dimuat.", { exact: false })
      .isVisible(),
    "metadata warning",
  );
  await page.getByLabel("Cakupan", { exact: true }).selectOption("class");
  check(
    await page
      .getByRole("list", { name: "Daftar izin", exact: true })
      .getByText("Kelas rujukan 00000000-0000-4000-8000-000000000011", {
        exact: true,
      })
      .isVisible(),
    "missing names retain exact class reference",
  );
  await geometry("missing metadata");
  for (const [role, label] of [
    ["admin", "Administrator"],
    ["teacher", "Guru"],
    ["student", "Siswa"],
    ["parent", "Orang tua"],
    ["applicant", "Calon siswa"],
    ["customer", "Nasabah"],
    ["alumni", "Alumni"],
  ]) {
    await fresh("?role=" + role);
    check(
      await page.getByText(label, { exact: true }).isVisible(),
      "role label " + role,
    );
  }
  for (const failure of ["network", "503", "bad", "json", "foreign"]) {
    await fresh();
    mode = failure;
    await button("Muat ulang hak akses").click();
    await idle();
    check(
      await page.getByRole("alert").isVisible(),
      failure + " explicit error",
    );
    check(
      await page
        .getByRole("alert")
        .evaluate((e) => document.activeElement === e),
      failure + " focus error",
    );
    check(
      await page.getByText("Guru", { exact: true }).isVisible(),
      failure + " retains marked snapshot",
    );
    mode = "ok";
    await button("Muat ulang hak akses").click();
    await idle();
    check(
      (await page
        .getByRole("status")
        .filter({ hasText: "Hak akses berhasil diperbarui." })
        .count()) === 1,
      failure + " recovery",
    );
    check(
      (await page.getByRole("alert").count()) === 0,
      failure + " clears stale error",
    );
  }
  await fresh();
  stored.role = "admin";
  stored.grants = [];
  await button("Muat ulang hak akses").click();
  await idle();
  check(
    await page.getByText("Administrator", { exact: true }).isVisible(),
    "role change refreshes state",
  );
  check(
    await page
      .getByRole("heading", { name: "Belum ada izin untuk ditampilkan" })
      .isVisible(),
    "removed grants disappear",
  );
  await fresh();
  await button("Muat ulang hak akses").evaluate((e) => {
    e.click();
    e.click();
  });
  await idle();
  check(reads === 1, "same tick duplicate refresh locked");
  for (const failure of ["401", "gate"]) {
    await fresh();
    mode = failure;
    await button("Muat ulang hak akses").click();
    await idle();
    check(
      (await page.locator("html").getAttribute("data-destination")) ===
        (failure === "401" ? "/login?expired=1" : "/account/security"),
      failure + " redirects safely",
    );
    check(
      (await page
        .getByRole("heading", { name: "Peran akun", exact: true })
        .count()) === 0,
      failure + " clears snapshot",
    );
  }
  await fresh();
  mode = "401";
  const complete = page.waitForResponse((r) =>
    r.url().endsWith("/api/auth/access"),
  );
  await button("Muat ulang hak akses").click();
  await page.evaluate(() => window.unmountAccess());
  await complete;
  check(
    (await page.locator("html").getAttribute("data-destination")) === null,
    "late response after unmount ignored",
  );
  await fresh();
  await page.setViewportSize({ width: 320, height: 850 });
  await button("Muat ulang hak akses").tap();
  await idle();
  check(reads === 1, "touch refresh");
  await page.setViewportSize({ width: 844, height: 390 });
  await geometry("orientation");
  await page.getByLabel("Cari izin", { exact: true }).focus();
  await page.keyboard.press("Tab");
  check(
    await page
      .getByLabel("Layanan", { exact: true })
      .evaluate((e) => document.activeElement === e),
    "keyboard filter order",
  );
  for (const scenario of ["loading", "error"]) {
    await fresh("?" + scenario + "=1");
    await geometry(scenario);
    await a11y(scenario);
    if (scenario === "error") {
      check(
        !(await page.content()).includes("private detail"),
        "error hides details",
      );
      await button("Coba lagi").click();
      check(
        (await page.locator("html").getAttribute("data-retried")) === "true",
        "error retry",
      );
    }
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
