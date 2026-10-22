/** Login QA: real local production pages plus isolated component/API response fixtures. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const baseline = process.argv.includes("--baseline"),
  root = process.cwd(),
  out =
    process.env.RECOVERY_QA_OUTPUT ?? join(root, "docs/verification/recovery");
await mkdir(out, { recursive: true });
const req = createRequire(import.meta.url),
  runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { chromium } = runtime
  ? req(join(runtime, "playwright"))
  : req("playwright");
const qa = process.env.UI_TEST_TOOLS ?? join(root, "node_modules"),
  { build } = await import(pathToFileURL(join(qa, "esbuild/lib/main.js"))),
  axe = await readFile(join(qa, "axe-core/axe.min.js"), "utf8");
const temp = await mkdtemp(join(tmpdir(), "sim-recovery-"));
await build({
  entryPoints: [join(root, "tests/ui/recovery-fixture.tsx")],
  outfile: join(temp, "fixture.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  tsconfig: join(root, "tsconfig.json"),
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  plugins: [
    {
      name: "navigation",
      setup(b) {
        b.onResolve({ filter: /^next\/navigation$/ }, () => ({
          path: join(root, "tests/ui/login-navigation-shim.ts"),
        }));
      },
    },
  ],
});
const styles = [];
async function css(dir) {
  for (const f of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) await css(p);
    else if (p.endsWith(".css")) styles.push(await readFile(p, "utf8"));
  }
}
await css(join(root, ".next/static"));
try {
  styles.push(await readFile(join(temp, "fixture.css"), "utf8"));
} catch {}
const fixture = createServer(async (q, s) => {
  if (q.url === "/fixture.js") {
    s.setHeader("Content-Type", "text/javascript");
    s.end(await readFile(join(temp, "fixture.js")));
  } else if (q.url === "/fixture.css") {
    s.setHeader("Content-Type", "text/css");
    s.end(styles.join("\n"));
  } else {
    s.setHeader("Content-Type", "text/html");
    s.end(
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Login QA</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((r) => fixture.listen(0, "127.0.0.1", r));
const fixtureUrl = `http://127.0.0.1:${fixture.address().port}`;
const origin = "http://127.0.0.1:3294",
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3294",
    ],
    {
      cwd: root,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
let logs = "";
server.stdout.on("data", (x) => (logs += x));
server.stderr.on("data", (x) => (logs += x));
const checks = [],
  issues = [],
  views = [],
  errors = [];
let browser;
function check(ok, name, detail) {
  checks.push({ name, passed: !!ok, ...(detail ? { detail } : {}) });
  if (!ok) {
    issues.push(name);
    if (!baseline) assert.fail(name + " " + JSON.stringify(detail ?? ""));
  }
}
async function geometry(page, name) {
  const d = await page.evaluate(() => ({
    width: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  check(d.document <= d.width + 1, name + " no horizontal overflow", d);
  for (const x of await page
    .locator("main input,main select,main button,main a")
    .all()) {
    const b = await x.boundingBox();
    if (b)
      check(
        b.x >= -1 && b.x + b.width <= d.width + 1,
        name + " control fits",
        b,
      );
  }
  await page.locator("main").scrollIntoViewIfNeeded();
  const last = page.locator("main button").last();
  await last.scrollIntoViewIfNeeded();
  const b = await last.boundingBox();
  check(
    b &&
      b.y >= -1 &&
      b.y + b.height <= (await page.evaluate(() => innerHeight)) + 1,
    name + " last action reachable",
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
  views.push({ name, violations });
  check(!violations.length, name + " axe", violations);
}
try {
  let ready = false;
  for (let n = 0; n < 160; n++) {
    try {
      if ((await fetch(origin + "/api/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  assert.ok(ready, logs);
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.UI_CHROMIUM_EXECUTABLE,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
      reducedMotion: "reduce",
      hasTouch: true,
    }),
    page = await context.newPage();
  page.setDefaultTimeout(6000);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      !m.text().startsWith("Failed to load resource:")
    )
      errors.push(m.text());
  });
  for (const path of ["/recovery", "/recovery/email"]) {
    for (const [width, height] of [
      [320, 700],
      [375, 812],
      [768, 1024],
      [1440, 900],
      [812, 240],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(origin + path);
      await page.locator("main input").first().waitFor();
      await geometry(page, path + " " + width);
      if ([320, 1440].includes(width)) await a11y(page, path + " " + width);
      await page.screenshot({
        path: join(
          out,
          (baseline ? "baseline-" : "") +
            (path.endsWith("email") ? "email" : "manual") +
            "-" +
            width +
            ".png",
        ),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 320, height: 700 });
    for (const zoom of [200, 400]) {
      await page.goto(origin + path);
      await page.addStyleTag({ content: `html{font-size:${zoom}%!important}` });
      await geometry(page, path + " text " + zoom);
    }
    await page.goto(origin + path);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    check(
      await page.locator("main").evaluate((e) => document.activeElement === e),
      path + " skip link focuses main",
    );
    check(
      (await page
        .locator("input[autocomplete=username]")
        .getAttribute("autocapitalize")) === "none",
      path + " preserves case on mobile",
    );
  }
  if (baseline) {
    const nojs = await browser.newContext({ javaScriptEnabled: false });
    const p = await nojs.newPage();
    await p.goto(origin + "/recovery");
    await p.locator("input[name=username]").fill("Synthetic-Only");
    await p.locator("input[name=answer]").fill("SyntheticAnswer");
    let captured;
    await p.route("**/recovery?**", async (r) => {
      captured = {
        method: r.request().method(),
        answerInUrl: r.request().url().includes("SyntheticAnswer"),
      };
      await r.fulfill({ status: 200, body: "Synthetic interception" });
    });
    await p.getByRole("button", { name: "Minta bantuan Admin" }).click();
    await p.waitForTimeout(100);
    check(
      captured?.method === "POST" && !captured?.answerInUrl,
      "native submission never puts answer in URL",
      captured,
    );
    await nojs.close();
  } else {
    const nojs = await browser.newContext({ javaScriptEnabled: false });
    for (const path of ["/recovery", "/recovery/email"]) {
      const p = await nojs.newPage();
      await p.goto(origin + path);
      check(
        await p.getByText(/Aktifkan JavaScript/).isVisible(),
        path + " noJS help",
      );
      check(
        !(await p.locator("form").isVisible()),
        path + " noJS sensitive form hidden",
      );
      check(
        (await p.locator("form").getAttribute("method")) === "post",
        path + " explicit native POST",
      );
      await p.close();
    }
    await nojs.close();
  }
  if (!baseline) {
    await page.goto(origin + "/recovery");
    await page.locator("input[name=username]").fill("00-User");
    await page.locator("select[name=question]").selectOption("q3");
    check(
      (await page.locator("#recovery-question-help").innerText()) ===
        "Apa makanan favorit yang sering dimasak ibu saat Anda kecil?",
      "long selected question remains fully readable",
    );
    for (const [width, height] of [
      [320, 700],
      [812, 375],
      [375, 812],
    ]) {
      await page.setViewportSize({ width, height });
      await geometry(page, "resize/orientation " + width);
      check(
        (await page.locator("input[name=username]").inputValue()) ===
          "00-User" &&
          (await page.locator("select[name=question]").inputValue()) === "q3",
        "resize preserves form state",
      );
    }
  }
  let mode = "manual",
    calls = [],
    release;
  const id = "11111111-1111-4111-8111-111111111111";
  await page.route("**/api/auth/**", async (route) => {
    calls.push(route.request().postDataJSON());
    if (mode === "hold" || mode === "hold-reset") {
      await new Promise((r) => (release = r));
      return route.fulfill(
        mode === "hold-reset"
          ? {
              status: 200,
              json: {
                message: "Password berhasil diperbarui.",
                destination: "/login?password=changed",
              },
            }
          : {
              status: 202,
              json: {
                message:
                  "Jika akun sesuai, permintaan diteruskan kepada Admin.",
              },
            },
      );
    }
    if (mode === "invalid")
      return route.fulfill({
        status: 200,
        json: { message: "Unexpected success" },
      });
    if (mode === "offline") return route.abort();
    if (mode === "error")
      return route.fulfill({
        status: 429,
        json: { message: "Batas percobaan tercapai." },
      });
    if (mode === "reset")
      return route.fulfill({
        status: 200,
        json: {
          message: "Password berhasil diperbarui.",
          destination: "/login?password=changed",
        },
      });
    return route.fulfill({
      status: 202,
      json: {
        message: "Jika akun sesuai, permintaan diteruskan kepada Admin.",
        ...(mode === "email" ? { challengeId: id } : {}),
      },
    });
  });
  async function fixturePage(email = false) {
    calls = [];
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(fixtureUrl + (email ? "/?email" : "/"));
    await page.locator("input[name=username]").fill("00-User");
  }
  await fixturePage();
  await page.locator("input[type=checkbox]").check();
  mode = "hold";
  await page.locator("form").evaluate((f) => {
    f.requestSubmit();
    f.requestSubmit();
  });
  await page.waitForTimeout(100);
  check(calls.length === 1, "synchronous double submit sent once", {
    requests: calls.length,
  });
  check(
    await page
      .getByRole("button", { name: "Mengirim…", exact: true })
      .isDisabled(),
    "pending disables submit",
  );
  release();
  await page.waitForTimeout(100);
  check(
    calls[0].username === "00-User" && calls[0].method === "manual",
    "manual payload exact",
  );
  if (!baseline) {
    check(
      await page
        .getByText("Jika akun sesuai, permintaan diteruskan kepada Admin.")
        .isVisible(),
      "accepted manual status visible",
    );
    check(
      !(await page.locator("input[name=username]").count()),
      "accepted form cannot silently repeat",
    );
    await a11y(page, "manual accepted");
  }
  mode = "error";
  await fixturePage();
  await page.locator("input[name=answer]").fill("Synthetic answer");
  await page.locator("form").evaluate((f) => f.requestSubmit());
  await page.getByText("Batas percobaan tercapai.").waitFor();
  check(
    (await page.locator("input[name=username]").inputValue()) === "00-User",
    "known error retains input",
  );
  if (!baseline)
    check(
      await page
        .getByRole("alert")
        .evaluate(
          (e) =>
            e.contains(document.activeElement) ||
            e === document.activeElement ||
            e.parentElement === document.activeElement,
        ),
      "error receives focus",
    );
  mode = "email";
  await fixturePage(true);
  await page.locator("form").evaluate((f) => f.requestSubmit());
  await page.locator("input[name=code]").waitFor();
  await page.locator("input[name=code]").fill("001234");
  await page.locator("input[name=newPassword]").fill("Safe!Password83");
  await page.locator("input[name=confirmPassword]").fill("Safe!Password83");
  mode = "invalid";
  await page.locator("form").evaluate((f) => f.requestSubmit());
  await page.waitForTimeout(100);
  check(
    !(
      await page.evaluate(
        () => window.loginNavigation ?? window.recoveryNavigation ?? [],
      )
    ).length,
    "malformed reset success never redirects",
  );
  if (!baseline) {
    check(
      await page
        .getByRole("link", { name: "Periksa dengan login" })
        .isVisible(),
      "uncertain reset offers login check",
    );
    check(
      await page.locator("input[name=code]").isDisabled(),
      "uncertain reset locks consumed code",
    );
    await a11y(page, "uncertain reset");
    mode = "email";
    await fixturePage(true);
    await page.locator("form").evaluate((f) => f.requestSubmit());
    await page.locator("input[name=code]").waitFor();
    await page.locator("input[name=code]").fill("001234");
    await page.locator("input[name=newPassword]").fill("Safe!Password83");
    await page.locator("input[name=confirmPassword]").fill("Safe!Password83");
    mode = "reset";
    await page.locator("form").evaluate((f) => f.requestSubmit());
    await page
      .getByRole("link", { name: "Masuk dengan password baru" })
      .waitFor();
    check(
      (await page.evaluate(() => window.loginNavigation ?? [])).includes(
        "/login?password=changed",
      ),
      "confirmed reset fixed destination",
    );
    check(calls.at(-1).code === "001234", "OTP leading zeros retained");
    await a11y(page, "reset success");
    mode = "offline";
    await fixturePage();
    await page.locator("input[type=checkbox]").check();
    await page.locator("form").evaluate((f) => f.requestSubmit());
    await page.getByText(/belum dapat dipastikan/).waitFor();
    check(
      await page
        .getByRole("link", { name: "Hubungi Admin melalui permintaan baru" })
        .isVisible(),
      "uncertain manual has explicit recovery",
    );
    mode = "manual";
    await fixturePage();
    await page.locator("input[name=answer]").fill("Synthetic Answer");
    await page.locator("select[name=requestType]").selectOption("session");
    await page.locator("form").evaluate((f) => f.requestSubmit());
    await page.waitForTimeout(100);
    check(
      calls[0].method === "question" &&
        calls[0].answer === "Synthetic Answer" &&
        calls[0].requestType === "session",
      "question/session exact payload",
    );
    mode = "email";
    await fixturePage(true);
    await page.locator("form").evaluate((f) => f.requestSubmit());
    await page.locator("input[name=code]").waitFor();
    check(
      await page
        .locator("input[name=code]")
        .evaluate((e) => e === document.activeElement),
      "code step gets focus",
    );
    await page.locator("input[name=code]").fill("001234");
    await page.locator("input[name=newPassword]").fill("Safe!Password83");
    await page
      .locator("input[name=confirmPassword]")
      .fill("Different!Password73");
    await page.locator("form").evaluate((f) => f.requestSubmit());
    await page
      .getByText("Periksa kekuatan dan konfirmasi password sesuai ketentuan.")
      .waitFor();
    check(calls.length === 1, "confirmation mismatch never sends reset");
    await page.locator("input[name=confirmPassword]").fill("Safe!Password83");
    mode = "hold-reset";
    await page.locator("form").evaluate((f) => {
      f.requestSubmit();
      f.requestSubmit();
    });
    await page.waitForTimeout(100);
    check(calls.length === 2, "reset synchronous double submit once");
    await page.getByRole("button", { name: "Tutup formulir uji" }).click();
    release();
    await page.waitForTimeout(100);
    check(
      !(await page.evaluate(() => window.loginNavigation ?? [])).length,
      "late reset success after unmount never navigates",
    );
    mode = "email";
    await fixturePage(true);
    await page.locator("form").evaluate((f) => f.requestSubmit());
    await page.locator("input[name=code]").waitFor();
    await page
      .getByRole("button", { name: "Minta kode baru atau ganti username" })
      .click();
    check(
      await page.locator("input[name=username]").isVisible(),
      "resend returns to editable username",
    );
    check(
      !(await page.locator("input[name=code]").count()),
      "resend discards old challenge UI",
    );
    check(
      await page.evaluate(() => !localStorage.length && !sessionStorage.length),
      "no recovery data in browser storage",
    );
    await page.goto(origin + "/recovery");
    await page.emulateMedia({ forcedColors: "active" });
    await geometry(page, "forced colors");
    await a11y(page, "forced colors");
    await page.emulateMedia({ forcedColors: "none" });
    await page.goto(fixtureUrl + "/?view=loading");
    await page
      .getByRole("status", { name: "Memuat formulir bantuan akun" })
      .waitFor();
    check(
      (await page
        .getByRole("status", { name: "Memuat formulir bantuan akun" })
        .getAttribute("aria-busy")) === "true",
      "actual loading component busy",
    );
    await a11y(page, "loading");
    mode = "hold";
    await fixturePage();
    await page.locator("input[type=checkbox]").check();
    await page.clock.install();
    await page.locator("form").evaluate((f) => f.requestSubmit());
    await page.waitForTimeout(50);
    await page.clock.fastForward(30001);
    await page.getByText(/belum dapat dipastikan/).waitFor();
    check(
      await page.locator("input[name=username]").isDisabled(),
      "timeout never silently retries",
    );
    release();
  }
  check(!errors.length, "no JavaScript exceptions", errors);
  await context.close();
  const report = {
    status: issues.length ? "issues" : "passed",
    baseline,
    checks,
    issues,
    axe: views,
    errors,
    limitations: [
      "Synthetic API outcomes; no real email/password writes.",
      "Actual production pages for layout; actual client components in isolated fixture for controlled state transitions.",
    ],
  };
  await writeFile(
    join(out, baseline ? "baseline-results.json" : "browser-results.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      status: report.status,
      checks: checks.length,
      issues,
      axeViews: views.length,
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
  fixture.close();
  server.kill("SIGTERM");
}
