/** Actual Keamanan akun UI with isolated HTTP boundaries. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd();
const out =
  process.env.SECURITY_QA_OUTPUT ??
  join(root, "docs/verification/account-security");
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
  entryPoints: [join(root, "tests/ui/account-security-fixture.tsx")],
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
          path: join(root, "tests/ui/account-security-navigation-shim.ts"),
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Keamanan akun QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
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
    readMode = "ok",
    writes = 0,
    lastInput;
  const stored = {
    gate: "ready",
    destination: "/account",
    question_code: "q3",
    role: "admin",
    can_set_question: true,
  };
  await page.route("**/api/auth/security", async (route) => {
    const r = route.request();
    await new Promise((r) => setTimeout(r, 120));
    if (r.method() === "GET") {
      if (readMode === "401")
        return route.fulfill({ status: 401, body: "not JSON" });
      if (readMode === "network") return route.abort();
      return route.fulfill({ json: stored });
    }
    writes++;
    lastInput = r.postDataJSON();
    if (mode === "network") return route.abort();
    if (mode === "401") return route.fulfill({ status: 401, body: "not JSON" });
    if (mode === "pending-password")
      return route.fulfill({
        status: 503,
        json: { signed_out: true, message: "Konfirmasi belum selesai." },
      });
    if (mode === "saved-no-state")
      return route.fulfill({ json: { saved: true, state: null } });
    if (mode === "malformed")
      return route.fulfill({ json: { message: "Unconfirmed" } });
    if (mode === "503" || mode === "429")
      return route.fulfill({
        status: Number(mode),
        json: { message: "Layanan belum tersedia." },
      });
    if (lastInput.action === "password")
      return route.fulfill({
        json: { signed_out: true, message: "Password berubah." },
      });
    return route.fulfill({ json: { state: stored, message: "Tersimpan" } });
  });
  const button = (name) => page.getByRole("button", { name, exact: true });
  const fresh = async (path = "") => {
    mode = "ok";
    readMode = "ok";
    writes = 0;
    await page.goto(base + "/" + path);
    await page.getByRole("heading", { level: 1 }).waitFor();
  };
  const idle = () =>
    page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  const answer = async () => {
    await page.locator("#security-answer").fill("Jawaban uji");
    await page.locator("#question-current").fill("Old!Secret92");
  };
  const password = async () => {
    await page.locator("#password-current").fill("Old!Secret92");
    await page.locator("#password-new").fill("New!Secret73");
    await page.locator("#password-confirm").fill("New!Secret73");
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
        .locator(
          "main input:not([hidden]):not([type=checkbox]),main select,main button",
        )
        .evaluateAll((es) =>
          es.every((e) => {
            const r = e.getBoundingClientRect();
            return (
              r.width === 0 ||
              (r.left >= 0 && r.right <= innerWidth && r.height >= 44)
            );
          }),
        ),
      name + " fields and touch targets fit",
    );
  }
  async function a11y(name) {
    await page.addScriptTag({ content: axe });
    const r = await page.evaluate(() =>
      window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      }),
    );
    accessibility.push({ name, violations: r.violations });
    check(!r.violations.length, name + " axe");
  }
  for (const [width, height] of [
    [320, 850],
    [390, 844],
    [768, 1024],
    [1440, 1000],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await fresh("?long=1");
    await geometry(String(width));
    await a11y(String(width));
    await page.screenshot({
      path: join(out, "security-" + width + ".png"),
      fullPage: true,
    });
  }
  await fresh();
  await button("Simpan password baru").click();
  check(writes === 0, "empty password rejected locally");
  check(
    (await page.locator("#password-current").getAttribute("aria-invalid")) ===
      "true",
    "required error bound to field",
  );
  check(
    await page.getByRole("alert").evaluate((e) => document.activeElement === e),
    "error summary receives focus",
  );
  await password();
  await page.locator("#password-confirm").fill("Different!93");
  await button("Simpan password baru").click();
  check(writes === 0, "confirmation mismatch rejected");
  check(
    (await page.locator("#password-confirm").getAttribute("aria-invalid")) ===
      "true",
    "confirmation error associated",
  );
  check(
    await page.getByRole("alert").evaluate((e) => document.activeElement === e),
    "repeated validation refocuses error summary",
  );
  await page.getByLabel("Tampilkan password", { exact: true }).check();
  check(
    (await page.locator("#password-new").getAttribute("type")) === "text",
    "password visibility toggle",
  );
  await fresh();
  await answer();
  await page.locator("#security-question").selectOption("q3");
  await button("Simpan pertanyaan keamanan").click();
  await idle();
  check(
    writes === 1 && lastInput.question === "q3",
    "question command submitted once",
  );
  check(
    (await page.locator("#security-answer").inputValue()) === "",
    "secret cleared on acknowledged success",
  );
  check(
    (await page.locator("#security-question").inputValue()) === "q3",
    "saved question remains selected",
  );
  await fresh();
  await answer();
  await page
    .locator("form")
    .filter({ has: page.locator("#security-answer") })
    .evaluate((f) => {
      f.requestSubmit();
      f.requestSubmit();
    });
  await idle();
  check(writes === 1, "same tick duplicate blocked");
  for (const failure of ["network", "malformed", "503"]) {
    await fresh();
    mode = failure;
    await answer();
    await button("Simpan pertanyaan keamanan").click();
    await idle();
    check(
      await button("Simpan pertanyaan keamanan").isDisabled(),
      failure + " blocks blind retry",
    );
    check(
      (await page.locator("#security-answer").inputValue()) === "Jawaban uji",
      failure + " retains draft",
    );
    await button("Muat ulang status").click();
    await idle();
    check(
      await button("Simpan pertanyaan keamanan").isEnabled(),
      failure + " can recover with GET",
    );
  }
  await fresh();
  await password();
  await answer();
  await page.evaluate(() => {
    const forms = [...document.querySelectorAll("form")];
    forms[0].requestSubmit();
    forms[1].requestSubmit();
  });
  await idle();
  check(writes === 1, "concurrent forms share lock");
  await fresh();
  mode = "pending-password";
  await password();
  await button("Simpan password baru").click();
  await idle();
  check(
    (await page.locator("html").getAttribute("data-destination")) ===
      "/login?password=pending",
    "partial password completion redirects safely",
  );
  await fresh();
  mode = "network";
  await answer();
  await button("Simpan pertanyaan keamanan").click();
  await idle();
  readMode = "network";
  await button("Muat ulang status").click();
  await idle();
  check(
    await button("Simpan pertanyaan keamanan").isDisabled(),
    "failed read keeps uncertain writes blocked",
  );
  readMode = "401";
  await button("Muat ulang status").click();
  await idle();
  check(
    (await page.locator("html").getAttribute("data-destination")) ===
      "/login?expired=1",
    "read 401 redirects before parsing",
  );
  await fresh();
  mode = "saved-no-state";
  await answer();
  await button("Simpan pertanyaan keamanan").click();
  await idle();
  check(
    (await page.locator("#security-answer").inputValue()) === "",
    "acknowledged write clears secret despite missing status",
  );
  check(
    await button("Simpan pertanyaan keamanan").isDisabled(),
    "acknowledged write waits for status sync",
  );
  await fresh();
  mode = "429";
  await answer();
  await button("Simpan pertanyaan keamanan").click();
  await idle();
  check(
    await button("Simpan pertanyaan keamanan").isEnabled(),
    "rate limited failure retains editable fields",
  );
  await fresh();
  mode = "401";
  await answer();
  await button("Simpan pertanyaan keamanan").click();
  await idle();
  check(
    (await page.locator("html").getAttribute("data-destination")) ===
      "/login?expired=1",
    "nonJSON 401 redirects",
  );
  await fresh();
  await password();
  await button("Simpan password baru").click();
  await idle();
  check(
    (await page.locator("html").getAttribute("data-destination")) ===
      "/login?password=changed",
    "password success signs out",
  );
  check(
    (await page.locator("#password-new").inputValue()) === "",
    "password cleared after success",
  );
  await fresh();
  await answer();
  const completed = page.waitForResponse((r) =>
    r.url().endsWith("/api/auth/security"),
  );
  await button("Simpan pertanyaan keamanan").click();
  await page.evaluate(() => window.unmountSecurity());
  await completed;
  check(
    (await page.locator("html").getAttribute("data-refreshes")) === null,
    "late response after unmount ignored",
  );
  for (const gate of [
    "password",
    "profile_pending",
    "security_question",
    "email_pending",
    "survey_pending",
    "account_pending",
    "ready",
  ]) {
    await fresh("?gate=" + gate);
    check(
      (await page.locator("#security-answer").count()) ===
        (["ready", "security_question", "email_pending"].includes(gate)
          ? 1
          : 0),
      gate + " preserves question gate",
    );
    await geometry(gate);
  }
  await page.setViewportSize({ width: 320, height: 850 });
  await fresh();
  await answer();
  await button("Simpan pertanyaan keamanan").tap();
  await idle();
  check(writes === 1, "mobile touch saves");
  await page.setViewportSize({ width: 844, height: 390 });
  await geometry("orientation");
  await page.locator("#password-current").focus();
  await page.keyboard.press("Tab");
  check(
    await page
      .locator("#password-new")
      .evaluate((e) => document.activeElement === e),
    "keyboard form order",
  );
  for (const scenario of ["loading", "error"]) {
    await fresh("?" + scenario + "=1");
    await geometry(scenario);
    await a11y(scenario);
    if (scenario === "error") {
      check(
        !(await page.content()).includes("private detail"),
        "error hides private details",
      );
      await button("Coba lagi").click();
      check(
        (await page.locator("html").getAttribute("data-retried")) === "true",
        "retry boundary works",
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
