/** Actual Sesi dan perangkat UI with isolated HTTP boundaries. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd();
const out =
  process.env.SESSIONS_QA_OUTPUT ?? join(root, "docs/verification/sessions");
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
  entryPoints: [join(root, "tests/ui/sessions-fixture.tsx")],
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
          path: join(root, "tests/ui/sessions-navigation-shim.ts"),
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sesi dan perangkat QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
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
    revokes = 0,
    reads = 0,
    lastInput,
    delay = 100;
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const make = (username = "qa-sessions", count = 3, long = false) => ({
    username,
    serverTime: new Date().toISOString(),
    sessions: Array.from({ length: count }, (_, i) => ({
      id: id(i + 1),
      device: long
        ? "Perangkat-" + "panjang".repeat(90)
        : i
          ? "Firefox · Android"
          : "Chrome · Windows",
      issued_at: new Date(Date.now() - 100000).toISOString(),
      last_seen_at: new Date(Date.now() - 2000).toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      remember: i % 2 === 0,
      current: username === "qa-sessions" && i === 0,
      status: i === 0 ? "active" : i === 1 ? "revoked" : "expired",
    })),
  });
  let stored = make();
  await page.route("**/api/auth/sessions", async (route) => {
    const r = route.request(),
      command = r.method() === "GET" ? { action: "list" } : r.postDataJSON();
    if (command.action === "list") {
      reads++;
      const snapshot = structuredClone(stored),
        owner = command.username ?? "qa-sessions";
      snapshot.username = owner;
      snapshot.sessions.forEach(
        (s) => (s.current = owner === "qa-sessions" && s.id === id(1)),
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (readMode === "network") return route.abort();
      if (readMode === "401")
        return route.fulfill({ status: 401, body: "not JSON" });
      if (readMode === "gate")
        return route.fulfill({
          status: 403,
          json: { destination: "/account/security" },
        });
      if (readMode === "bad")
        return route.fulfill({
          json: { ...snapshot, sessions: [{ bad: true }] },
        });
      if (readMode === "owner") snapshot.username = "wrong-owner";
      snapshot.serverTime = new Date().toISOString();
      return route.fulfill({ json: snapshot });
    }
    revokes++;
    lastInput = command;
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (mode === "network") return route.abort();
    if (mode === "401") return route.fulfill({ status: 401, body: "not JSON" });
    if (mode === "gate")
      return route.fulfill({
        status: 403,
        json: { destination: "/account/security" },
      });
    if (mode === "503")
      return route.fulfill({ status: 503, json: { message: "unavailable" } });
    if (mode === "malformed")
      return route.fulfill({ json: { message: "unconfirmed" } });
    if (mode === "zero")
      return route.fulfill({ json: { revoked: 0, signed_out: false } });
    stored.sessions.forEach((s) => {
      if (command.scope === "all" || s.id === command.sessionId)
        s.status = "revoked";
    });
    return route.fulfill({ json: { revoked: 1, signed_out: mode === "self" } });
  });
  const button = (name) => (name === "Akun saya" ? page.locator("main") : page).getByRole("button", { name, exact: true }),
    dialog = () => page.getByRole("dialog");
  const idle = () =>
    page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  const fresh = async (params = "", custom) => {
    mode = "ok";
    readMode = "ok";
    delay = 100;
    revokes = 0;
    reads = 0;
    stored = custom ?? make();
    await page.goto(base + "/" + params);
    await page.getByRole("heading", { level: 1 }).waitFor();
    if (!params.includes("loading")) await idle();
  };
  const search = async (username) => {
    await page.getByLabel("Username", { exact: true }).fill(username);
    await button("Cari sesi").click();
    await idle();
  };
  const open = async () => {
    await button("Cabut seluruh sesi").click();
    await dialog().waitFor();
  };
  async function geometry(name) {
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      name + " no horizontal overflow",
    );
    check(
      await page.locator("main button,main input").evaluateAll((es) =>
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
  async function modalGeometry(name) {
    check(
      await dialog().evaluate((e) => {
        const r = e.getBoundingClientRect();
        return (
          r.left >= 0 &&
          r.right <= innerWidth &&
          r.top >= 0 &&
          r.bottom <= innerHeight
        );
      }),
      name + " dialog within viewport",
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
    await fresh("", make("qa-sessions", 20, true));
    await geometry(String(width));
    await a11y(String(width));
    check(
      (await page.locator("main h3").count()) === 20,
      "twenty records " + width,
    );
    await page.screenshot({
      path: join(out, "sessions-" + width + ".png"),
      fullPage: true,
    });
    await open();
    await modalGeometry(String(width));
    await a11y("dialog-" + width);
    await button("Batal").click();
    check(
      await button("Cabut seluruh sesi").evaluate(
        (e) => document.activeElement === e,
      ),
      "dialog returns focus " + width,
    );
  }
  await fresh();
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await geometry("normal-" + width);
    await page.screenshot({
      path: join(out, "sessions-normal-" + width + ".png"),
      fullPage: true,
    });
  }
  await fresh("?regular=1");
  check(
    (await page.locator("#session-username").count()) === 0,
    "regular role has no foreign search",
  );
  await open();
  check(
    (await dialog()
      .getByText("Sesi Anda saat ini juga akan dicabut.", { exact: false })
      .count()) === 1,
    "own all warns signout",
  );
  await page.keyboard.press("Escape");
  check((await dialog().count()) === 0, "escape closes dialog");
  check(revokes === 0, "cancel never revokes");
  await fresh("", make("qa-sessions", 0));
  check(
    await page
      .getByRole("heading", { name: "Belum ada riwayat sesi" })
      .isVisible(),
    "empty state",
  );
  check(await button("Cabut seluruh sesi").isDisabled(), "empty cannot revoke");
  await a11y("empty");
  await fresh();
  await button("Cari sesi").click();
  check(await page.getByRole("alert").isVisible(), "empty search validated");
  check(reads === 1, "empty search does not fetch");
  check(
    await page
      .getByLabel("Username", { exact: true })
      .evaluate((e) => document.activeElement === e),
    "invalid search focuses username",
  );
  await search("0006-user");
  await page.getByLabel("Username", { exact: true }).fill("draft-other");
  check(
    await page
      .getByRole("heading", { name: "Akun: 0006-user", exact: true })
      .isVisible(),
    "exact username search",
  );
  await open();
  check(
    !(await dialog().innerText()).includes("Sesi Anda saat ini juga"),
    "foreign revoke does not warn own logout",
  );
  await button("Ya, cabut akses").click();
  await idle();
  check(
    revokes === 1 &&
      lastInput.username === "0006-user" &&
      lastInput.scope === "all",
    "all revoke bound to displayed owner",
  );
  check(
    (await page
      .getByRole("status")
      .filter({ hasText: "1 sesi berhasil dicabut" })
      .count()) === 1,
    "acknowledged revoke feedback",
  );
  check(
    await page
      .getByRole("status")
      .filter({ hasText: "1 sesi berhasil dicabut" })
      .evaluate((e) => document.activeElement === e),
    "success returns focus to feedback",
  );
  await button("Akun saya").click();
  await idle();
  check(
    await page
      .getByRole("heading", { name: "Akun: qa-sessions", exact: true })
      .isVisible(),
    "return own account",
  );
  await fresh();
  await button("Cabut sesi Anda saat ini").click();
  await dialog().waitFor();
  await button("Ya, cabut akses").evaluate((e) => {
    e.click();
    e.click();
  });
  await idle();
  check(
    revokes === 1 && lastInput.sessionId === id(1) && lastInput.scope === "one",
    "same tick one-session double click locked",
  );
  for (const failure of ["network", "malformed", "503"]) {
    await fresh();
    mode = failure;
    await open();
    await button("Ya, cabut akses").click();
    await idle();
    check(
      await button("Cabut seluruh sesi").isDisabled(),
      failure + " requires sync",
    );
    check(
      await page.getByRole("alert").isVisible(),
      failure + " explicit error",
    );
    await button("Muat ulang").click();
    await idle();
    check(
      await button("Cabut seluruh sesi").isEnabled(),
      failure + " GET recovers",
    );
    check(revokes === 1, failure + " no blind retry");
  }
  await fresh();
  readMode = "network";
  await open();
  await button("Ya, cabut akses").click();
  await idle();
  check(
    (await page
      .getByRole("alert")
      .filter({ hasText: "1 sesi berhasil dicabut." })
      .count()) === 1,
    "acknowledged revoke survives followup read failure",
  );
  check(
    await button("Cabut seluruh sesi").isDisabled(),
    "followup failure blocks stale action",
  );
  readMode = "ok";
  await button("Muat ulang").click();
  await idle();
  check(revokes === 1, "followup recovery never resends revoke");
  await fresh();
  delay = 400;
  await open();
  await button("Ya, cabut akses").click();
  check(await button("Batal").isDisabled(), "cancel disabled while revoking");
  check(
    await button("Tutup dialog").isDisabled(),
    "close disabled while revoking",
  );
  await idle();
  await fresh();
  mode = "zero";
  await open();
  await button("Ya, cabut akses").click();
  await idle();
  check(
    (await page
      .getByRole("status")
      .filter({ hasText: "Tidak ada sesi baru" })
      .count()) === 1,
    "zero result honest feedback",
  );
  await fresh();
  mode = "self";
  await open();
  await button("Ya, cabut akses").click();
  await idle();
  check(
    (await page.locator("html").getAttribute("data-destination")) ===
      "/login?logout=1",
    "self revoke redirects logout",
  );
  for (const failure of ["401", "gate"]) {
    await fresh();
    mode = failure;
    await open();
    await button("Ya, cabut akses").click();
    await idle();
    check(
      (await page.locator("html").getAttribute("data-destination")) ===
        (failure === "401" ? "/login?expired=1" : "/account/security"),
      failure + " mutation redirect",
    );
    await fresh();
    readMode = failure;
    await button("Muat ulang").click();
    await idle();
    check(
      (await page.locator("html").getAttribute("data-destination")) ===
        (failure === "401" ? "/login?expired=1" : "/account/security"),
      failure + " read redirect",
    );
  }
  for (const failure of ["bad", "owner", "network"]) {
    await fresh();
    readMode = failure;
    await button("Muat ulang").click();
    await idle();
    check(
      await button("Cabut seluruh sesi").isDisabled(),
      failure + " invalid read denies stale actions",
    );
    readMode = "ok";
    await button("Muat ulang").click();
    await idle();
    check(
      await button("Cabut seluruh sesi").isEnabled(),
      failure + " valid read recovers",
    );
  }
  await fresh();
  delay = 400;
  await page.getByLabel("Username", { exact: true }).fill("older");
  await button("Cari sesi").click();
  await page.getByLabel("Username", { exact: true }).fill("newer");
  await button("Cari sesi").click();
  await idle();
  check(
    await page
      .getByRole("heading", { name: "Akun: newer", exact: true })
      .isVisible(),
    "latest owner wins overlapping requests",
  );
  await fresh();
  await open();
  const before = reads;
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await page.waitForTimeout(200);
  check(reads === before, "poll paused during confirmation");
  await button("Batal").click();
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await page.waitForFunction(() =>
    document.querySelector('[aria-busy="true"]'),
  );
  await idle();
  check(reads > before, "visibility refresh resumes");
  await fresh();
  await open();
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/auth/sessions") &&
      r.request().postDataJSON()?.action === "revoke",
  );
  mode = "self";
  await button("Ya, cabut akses").click();
  await page.evaluate(() => window.unmountSessions());
  await response;
  check(
    (await page.locator("html").getAttribute("data-destination")) === null,
    "late mutation after unmount does not redirect",
  );
  await fresh();
  stored.sessions[0].expires_at = new Date(Date.now() + 1500).toISOString();
  await button("Muat ulang").click();
  await idle();
  await page.waitForTimeout(2200);
  check(
    await button("Cabut seluruh sesi").isDisabled(),
    "expiry disables revoke without reload",
  );
  await fresh();
  stored.sessions[0].expires_at = new Date(Date.now() + 1500).toISOString();
  await button("Muat ulang").click();
  await idle();
  await open();
  await page.waitForTimeout(2200);
  await button("Ya, cabut akses").click();
  await idle();
  check(
    revokes === 0,
    "expired session cannot be revoked from an older open dialog",
  );
  check(
    await page.getByRole("alert").isVisible(),
    "expired confirmation explains required refresh",
  );
  await page.addInitScript(() => {
    const original = Date.now;
    Date.now = () => original() + 86400000;
  });
  await fresh();
  check(
    await button("Cabut seluruh sesi").isEnabled(),
    "server clock offset handles incorrect device clock",
  );
  await fresh();
  await page.setViewportSize({ width: 320, height: 850 });
  await button("Cabut seluruh sesi").tap();
  await modalGeometry("touch");
  await page.setViewportSize({ width: 844, height: 390 });
  await modalGeometry("orientation");
  await button("Batal").click();
  await page.getByLabel("Username", { exact: true }).focus();
  await page.keyboard.press("Tab");
  check(
    await button("Cari sesi").evaluate((e) => document.activeElement === e),
    "keyboard search order",
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
