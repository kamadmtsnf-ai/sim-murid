import {installConfirmDriver,settleConfirmation} from "./confirm-driver.mjs";
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
  process.env.FORMS_QA_OUTPUT ?? join(root, "docs/verification/forms");
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
  entryPoints: [join(root, "tests/ui/forms-fixture.tsx")],
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
  let discard = false,
    mode = "saved",
    posts = [],
    release,
    stored = { revision: 1, label: "awal" };
  await installConfirmDriver(page,()=>discard);
  page.on("dialog", (dialog) =>
    dialog.type() === "beforeunload" || discard
      ? dialog.accept()
      : dialog.dismiss(),
  );
  await page.route("**/qa/mutation", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: stored });
    const body = route.request().postDataJSON();
    posts.push(body);
    if (mode === "hold" || mode === "timeout")
      await new Promise((r) => (release = r));
    if (mode === "offline" || mode === "committed-abort") {
      if (mode === "committed-abort")
        stored = { revision: body.revision + 1, label: body.command.label };
      return route.abort();
    }
    if (mode === "401" || mode === "403")
      return route.fulfill({ status: Number(mode), body: "unauthorized" });
    if (mode === "invalid" || mode === "stale")
      return route.fulfill({
        status: 409,
        json: { code: mode, message: mode },
      });
    if (mode === "500")
      return route.fulfill({
        status: 500,
        headers: { "X-Request-ID": "00000000-0000-4000-8000-000000000123" },
        json: { code: "invalid" },
      });
    if (mode === "malformed") return route.fulfill({ body: "{" });
    const next = {
      revision: mode === "unadvanced" ? body.revision : body.revision + 1,
      label: body.command.label,
    };
    stored = next;
    const data = {
      classes: next,
      ...(mode === "noack" ? {} : { code: "saved" }),
      ...(mode === "mixed" ? { result: { code: "stale" } } : {}),
    };
    try {
      await route.fulfill({ json: data });
    } catch {
      /* aborted by unmount or timeout */
    }
  });
  const button = (name) => page.getByRole("button", { name, exact: true });
  const phase = (value) =>
    page.locator("#probe-phase").getByText(value, { exact: true }).waitFor();
  async function fresh(next = "saved") {
    mode = next;
    discard = false;
    posts = [];
    await page.goto(base);
    await page.locator("#probe-value").waitFor();
  }
  async function force() {
    await page.evaluate(() => {
      void window.forceFormsSave();
    });
  }
  await fresh();
  await page.locator("#probe-value").fill("");
  await button("Simpan isian uji").click();
  await settleConfirmation(page);
  await phase("error");
  check(posts.length === 0, "invalid draft never reaches HTTP");
  await fresh("hold");
  await page.evaluate(() => {
    window.forceFormsSave();
    window.forceFormsSave();
  });
  await phase("pending");
  check(posts.length === 1, "same-tick double submit sends one request");
  check(
    posts[0].revision === 1 && /^[\da-f-]{36}$/i.test(posts[0].requestId),
    "safe revision and UUID envelope",
  );
  await page
    .getByRole("link", { name: "Kelas dan siswa", exact: true })
    .click();
    await settleConfirmation(page);
  await page.getByText(/Tunggu proses pada halaman/).waitFor();
  check(
    new URL(page.url()).pathname === "/",
    "pending sidebar navigation is blocked",
  );
  await page.setViewportSize({ width: 320, height: 700 });
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "pending notice wraps on mobile",
  );
  await page.screenshot({
    path: join(out, "pending-notice-320.png"),
    fullPage: true,
  });
  await button("Tutup pemberitahuan").click();
  await settleConfirmation(page);
  check(
    (await page.locator("#probe-phase").innerText()) === "pending" &&
      posts.length === 1,
    "dismissing notice does not unlock or repeat a write",
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  release();
  await phase("success");
  check(
    (await page.evaluate(() => window.formsSaved)) === 1,
    "one confirmed callback",
  );
  for (const outcome of [
    "offline",
    "committed-abort",
    "500",
    "noack",
    "mixed",
    "unadvanced",
    "malformed",
  ]) {
    await fresh(outcome);
    await force();
    await phase("uncertain");
    if (mode === "500")
      check(
        (await page.locator("main").innerText()).includes(
          "00000000-0000-4000-8000-000000000123",
        ),
        "P10 response reference visible without retrying the uncertain write",
      );
    check(
      (await page.locator("#probe-value").inputValue()) === "data-uji",
      outcome + " retains draft",
    );
    await button("Ubah pesan validasi").click();
    await settleConfirmation(page);
    await button("Bersihkan pesan").click();
    await settleConfirmation(page);
    await force();
    check(
      (await page.locator("#probe-phase").innerText()) === "uncertain" &&
        posts.length === 1,
      outcome + " cannot clear lock or replay",
    );
    check(
      !(await page.evaluate(() => window.formsSaved)),
      outcome + " no false success",
    );
    if (outcome === "committed-abort") {
      await button("Periksa data tersimpan").click();
      await settleConfirmation(page);
      await page
        .locator("#probe-inspected")
        .getByText("data-uji", { exact: true })
        .waitFor();
      check(posts.length === 1, "read-only inspection never retries write");
    }
  }
  for (const outcome of ["401", "403", "stale"]) {
    await fresh(outcome);
    await force();
    await phase("blocked");
    await force();
    check(posts.length === 1, outcome + " blocks replay");
  }
  await fresh("invalid");
  await force();
  await phase("error");
  const oldId = posts[0].requestId;
  mode = "saved";
  await page.locator("#probe-value").fill("koreksi");
  await force();
  await phase("success");
  check(
    posts.length === 2 && posts[1].requestId !== oldId,
    "explicit correction gets a new request",
  );
  await fresh();
  await page
    .getByRole("link", { name: "Kelas dan siswa", exact: true })
    .click();
    await settleConfirmation(page);
  check(
    new URL(page.url()).pathname === "/" &&
      (await page.locator("#probe-value").inputValue()) === "data-uji",
    "cancelled sidebar preserves draft",
  );
  await button("Keluar dari akun").click();
  await settleConfirmation(page);
  check(
    new URL(page.url()).pathname === "/" &&
      (await page.locator("#probe-value").inputValue()) === "data-uji",
    "cancelled logout preserves draft",
  );
  discard = true;
  await page
    .getByRole("link", { name: "Kelas dan siswa", exact: true })
    .click();
    await settleConfirmation(page);
  await page.waitForURL("**/account/classes");
  check(true, "explicit discard permits navigation");
  await fresh("hold");
  await force();
  await phase("pending");
  await button("Lepas probe").click();
  await settleConfirmation(page);
  release();
  await page.waitForTimeout(100);
  check(
    !(await page.evaluate(() => window.formsSaved)),
    "unmount ignores late response",
  );
  await fresh("timeout");
  await page.clock.install();
  await page.evaluate(() => {
    void window.forceFormsSave();
  });
  await phase("pending");
  await page.clock.fastForward(31000);
  await phase("uncertain");
  check(posts.length === 1, "timeout retains lock without retry");
  release();
  await page.clock.resume();
  await page.goto(base + "?profile=1");
  await page
    .getByRole("textbox", { name: "Nama lengkap", exact: true })
    .fill("Nama belum disimpan");
  await page
    .getByRole("link", { name: "Kelas dan siswa", exact: true })
    .click();
    await settleConfirmation(page);
  check(
    (await page
      .getByRole("textbox", { name: "Nama lengkap", exact: true })
      .inputValue()) === "Nama belum disimpan",
    "real profile reuses dirty navigation guard",
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await fresh();
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "no page overflow " + width,
    );
    await page.evaluate(axe);
    const r = await page.evaluate(() =>
      window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"],
        },
      }),
    );
    accessibility.push({ width, violations: r.violations.map((v) => v.id) });
    check(!r.violations.length, "axe " + width);
    await page.screenshot({
      path: join(out, "forms-" + width + ".png"),
      fullPage: true,
    });
  }
  check(
    !(await page.evaluate(() =>
      Object.values(localStorage).some(
        (v) => v.includes("data-uji") || v.includes("Nama belum disimpan"),
      ),
    )),
    "personal drafts not cached generically",
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
