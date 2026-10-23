/** Actual Verifikasi email UI with isolated HTTP boundaries. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd();
const out =
  process.env.EMAIL_VERIFICATION_QA_OUTPUT ??
  join(root, "docs/verification/email-verification");
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
  entryPoints: [join(root, "tests/ui/email-verification-fixture.tsx")],
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
          path: join(root, "tests/ui/email-verification-navigation-shim.ts"),
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verifikasi email QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
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
    stored,
    writes = 0,
    reads = 0,
    lastInput,
    sequence = 10;
  page.on("dialog", (d) => d.accept());
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  await page.route("**/api/account/email", async (route) => {
    const r = route.request();
    stored ??= await page.evaluate(() =>
      structuredClone(window.emailVerificationFixture),
    );
    await new Promise((r) => setTimeout(r, 150));
    if (r.method() === "GET") {
      reads++;
      if (readMode === "network") return route.abort();
      if (readMode === "malformed")
        return route.fulfill({ json: { state: { bad: true } } });
      if (readMode === "401")
        return route.fulfill({ status: 401, body: "not JSON" });
      return route.fulfill({
        json: { state: stored, serverTime: new Date().toISOString() },
      });
    }
    writes++;
    lastInput = r.postDataJSON();
    if (mode === "network") return route.abort();
    if (mode === "401") return route.fulfill({ status: 401, body: "not JSON" });
    if (mode === "json") return route.fulfill({ body: "invalid JSON" });
    if (mode === "503" || mode === "403")
      return route.fulfill({
        status: Number(mode),
        json: { message: "Permintaan gagal " + mode },
      });
    if (mode === "429")
      return route.fulfill({
        status: 429,
        json: { message: "Tunggu 45 detik", retry_after: 45 },
      });
    if (mode === "malformed")
      return route.fulfill({ json: { message: "unconfirmed response" } });
    if (lastInput.action === "send") {
      stored.sent_today++;
      stored.challenge = {
        id: id(sequence++),
        expires_at: new Date(Date.now() + 600000).toISOString(),
        retry_at: new Date(Date.now() + 60000).toISOString(),
        status: mode === "delivery-failed" ? "superseded" : "pending",
        delivery_state:
          mode === "queued"
            ? "queued"
            : mode === "delivery-failed"
              ? "failed"
              : "accepted",
        attempts_remaining: 5,
      };
      return route.fulfill({
        status: mode === "delivery-failed" ? 503 : 200,
        json: {
          message:
            mode === "delivery-failed"
              ? "Pengiriman belum terkonfirmasi."
              : "Kode diterima layanan pengiriman. Periksa kotak masuk dan spam.",
          challengeId: stored.challenge.id,
          expires_at: stored.challenge.expires_at,
        },
      });
    }
    if (mode === "wrong") {
      stored.challenge.attempts_remaining--;
      if (stored.challenge.attempts_remaining === 0)
        stored.challenge.status = "locked";
      return route.fulfill({
        status: 400,
        json: { message: "Kode tidak sesuai." },
      });
    }
    stored.verified = true;
    stored.challenge.status = "verified";
    if (mode === "committed") return route.abort();
    return route.fulfill({
      json: {
        message: "Email berhasil diverifikasi.",
        state: { gate: "ready", destination: "/account" },
      },
    });
  });
  const button = (name) => page.getByRole("button", { name, exact: true }),
    send = () =>
      page.getByRole("button", {
        name: /^Kirim (kode verifikasi|ulang dalam)/,
      }),
    verify = () => button("Verifikasi email"),
    refresh = () => button("Muat ulang status"),
    otp = () => page.locator("#email-otp");
  async function idle() {
    await page.waitForFunction(
      () => !document.querySelector('[aria-busy="true"]'),
    );
  }
  async function fresh(query = "") {
    mode = "ok";
    readMode = "ok";
    stored = null;
    await page.goto(base + query);
    await refresh().waitFor();
    await page.waitForTimeout(30);
  }
  async function geometry(label) {
    const g = await page.evaluate(() => ({
      w: innerWidth,
      s: document.documentElement.scrollWidth,
    }));
    check(g.s <= g.w + 1, label + " no horizontal overflow");
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
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await fresh("/?long=1");
    await geometry("long email " + width);
    await a11y("email " + width);
    await page.screenshot({
      path: join(out, "email-" + width + ".png"),
      fullPage: true,
    });
  }
  await fresh();
  let before = writes;
  await otp().fill("12a456");
  await verify().click();
  check(writes === before, "invalid OTP rejected without request");
  check(
    (await otp().getAttribute("aria-invalid")) === "true",
    "OTP field error explicit",
  );
  check(
    await otp().evaluate((e) => document.activeElement === e),
    "OTP error focus",
  );
  await otp().evaluate((e) => {
    const data = new DataTransfer();
    data.setData("text", " 001234 ");
    e.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      }),
    );
  });
  await page.waitForFunction(
    () => document.querySelector("#email-otp")?.value === "001234",
  );
  check(
    (await otp().inputValue()) === "001234",
    "paste trims outer whitespace without dropping OTP zeros",
  );
  await otp().fill("001234");
  mode = "wrong";
  await verify().evaluate((e) => {
    e.click();
    e.click();
  });
  await idle();
  check(writes === before + 1, "synchronous verify lock");
  check(lastInput.code === "001234", "OTP leading zero retained");
  check((await otp().inputValue()) === "001234", "wrong OTP not erased");
  check(
    await page.getByText(/Sisa percobaan: 4/).isVisible(),
    "wrong attempt updates count",
  );
  await refresh().click();
  await idle();
  check(
    (await otp().inputValue()) === "001234",
    "same challenge refresh retains input",
  );
  for (let i = 0; i < 4; i++) {
    await verify().click();
    await idle();
  }
  check(reads > 0, "mutations reconcile via read-only status");
  check(await verify().isDisabled(), "fifth wrong attempt blocks verify");
  check(
    await page.getByText(/Batas percobaan kode ini tercapai/).isVisible(),
    "locked guidance",
  );
  await fresh("/?none=1");
  check((await otp().count()) === 0, "no challenge has no OTP form");
  before = writes;
  await send().evaluate((e) => {
    e.click();
    e.click();
  });
  await idle();
  check(writes === before + 1, "synchronous send lock");
  check(await otp().isEnabled(), "accepted send enables OTP");
  check(
    await otp().evaluate((e) => document.activeElement === e),
    "new OTP receives focus",
  );
  check(await send().isDisabled(), "resend cooldown after send");
  await a11y("accepted send");
  await otp().fill("001234");
  await verify().click();
  await idle();
  check(
    (await page.locator("html").getAttribute("data-destination")) ===
      "/account",
    "verified snapshot permits navigation",
  );
  check((await otp().count()) === 0, "verified state removes OTP");
  await fresh();
  mode = "malformed";
  await otp().fill("001234");
  await verify().click();
  await idle();
  check(
    (await page.locator("html").getAttribute("data-destination")) === null,
    "200 without verified snapshot never navigates",
  );
  check(
    (await otp().inputValue()) === "001234",
    "unconfirmed verification retains OTP",
  );
  check(
    await verify().isDisabled(),
    "unconfirmed verification requires status check",
  );
  for (const failure of ["network", "json"]) {
    await fresh();
    mode = failure;
    await otp().fill("001234");
    await verify().click();
    await idle();
    check((await otp().inputValue()) === "001234", failure + " preserves OTP");
    check(
      await verify().isDisabled(),
      failure + " blocks resend until synchronized",
    );
    mode = "ok";
    await refresh().click();
    await idle();
    check(
      await verify().isEnabled(),
      failure + " read refresh restores controls",
    );
  }
  await fresh();
  mode = "committed";
  await otp().fill("001234");
  await verify().click();
  await idle();
  mode = "ok";
  await refresh().click();
  await idle();
  check(
    await page
      .getByText("Email sudah terverifikasi", { exact: true })
      .isVisible(),
    "lost verification reply recovered by GET",
  );
  await fresh();
  await otp().fill("123456");
  for (const failure of ["network", "malformed"]) {
    readMode = failure;
    await refresh().click();
    await idle();
    check(
      (await otp().inputValue()) === "123456",
      failure + " failed refresh retains code",
    );
    check(
      await verify().isDisabled(),
      failure + " failed refresh prevents stale verify",
    );
  }
  readMode = "ok";
  await refresh().click();
  await idle();
  check(await verify().isEnabled(), "valid refresh recovers state");
  await fresh();
  mode = "429";
  await send().click();
  await idle();
  check(
    await send().isDisabled(),
    "server Retry-After disables resend even if snapshot has older verify challenge",
  );
  check(
    (await send().innerText()).includes("detik"),
    "server cooldown displayed",
  );
  await fresh("/?none=1");
  mode = "queued";
  await send().click();
  await idle();
  check(await verify().isDisabled(), "unconfirmed delivery cannot verify");
  check(
    await page
      .getByText(/Pengiriman belum terkonfirmasi/)
      .first()
      .isVisible(),
    "queued guidance honest",
  );
  await fresh("/?none=1");
  mode = "delivery-failed";
  await send().click();
  await idle();
  check(await verify().isDisabled(), "failed delivery cannot verify");
  check(
    await send().isDisabled(),
    "failed delivery respects consumed cooldown",
  );
  for (const scenario of [
    "expired",
    "locked",
    "queued",
    "failed",
    "superseded",
  ]) {
    await fresh("/?" + scenario + "=1");
    check(await verify().isDisabled(), scenario + " code disabled");
    await geometry(scenario);
  }
  await fresh();
  await refresh().click();
  await idle();
  await otp().fill("001234");
  stored.email = "updated@example.org";
  stored.challenge.status = "superseded";
  await refresh().click();
  await idle();
  check((await otp().inputValue()) === "", "changed email clears old OTP");
  check(
    await verify().isDisabled(),
    "changed email invalidates old challenge controls",
  );
  await fresh("/?limit=1");
  check(await send().isDisabled(), "daily limit disables send");
  check(
    await verify().isEnabled(),
    "daily send limit does not block existing valid OTP",
  );
  await a11y("daily limit");
  await fresh("/?empty=1");
  check(await send().isDisabled(), "empty contact cannot send");
  check(
    await page.getByText(/Isi email kontak yang valid/).isVisible(),
    "missing contact guidance",
  );
  await a11y("empty");
  await fresh("/?verified=1");
  check(
    (await send().count()) === 0 && (await otp().count()) === 0,
    "verified state avoids redundant send",
  );
  await a11y("verified");
  await fresh("/?short-cooldown=1");
  check(await send().isDisabled(), "cooldown initially active");
  await send().waitFor({ state: "visible" });
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll("button")).some(
      (e) => e.textContent === "Kirim kode verifikasi" && !e.disabled,
    ),
  );
  check(await send().isEnabled(), "cooldown expires without reload");
  await fresh("/?expiring=1");
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll("button")).some(
      (e) => e.textContent === "Verifikasi email" && e.disabled,
    ),
  );
  check(
    await verify().isDisabled(),
    "expiry disables active form without reload",
  );
  await fresh();
  mode = "401";
  await otp().fill("001234");
  await verify().click();
  await idle();
  check(
    (await page.locator("html").getAttribute("data-destination")) ===
      "/login?expired=1",
    "401 redirects before parsing invalid JSON",
  );
  await fresh();
  readMode = "401";
  await refresh().click();
  await idle();
  check(
    (await page.locator("html").getAttribute("data-destination")) ===
      "/login?expired=1",
    "read 401 redirects",
  );
  await fresh("/?none=1");
  await page.setViewportSize({ width: 320, height: 850 });
  await send().tap();
  await idle();
  check(await otp().isEnabled(), "mobile touch send works");
  await page.setViewportSize({ width: 844, height: 390 });
  await otp().focus();
  await page.keyboard.press("Tab");
  check(
    await verify().evaluate((e) => document.activeElement === e),
    "keyboard OTP to verify",
  );
  await geometry("landscape");
  await a11y("landscape");
  await fresh();
  mode = "401";
  await otp().fill("001234");
  const completed = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/account/email") && r.request().method() === "POST",
  );
  await verify().click();
  await page.evaluate(() => window.unmountEmailVerification());
  await completed;
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  check(
    (await page.locator("html").getAttribute("data-destination")) === null,
    "late response after unmount does not redirect another page",
  );
  for (const scenario of ["loading", "error"]) {
    await page.goto(base + "/?" + scenario + "=1");
    await page.getByRole("heading", { level: 1 }).waitFor();
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
        "error retry works",
      );
    }
  }
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
