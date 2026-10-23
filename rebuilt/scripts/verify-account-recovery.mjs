/** Actual Survei UI with isolated Auth/HTTP/Storage boundaries. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd();
const out =
  process.env.ACCOUNT_RECOVERY_QA_OUTPUT ??
  join(root, "docs/verification/account-recovery");
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
  entryPoints: [join(root, "tests/ui/account-recovery-fixture.tsx")],
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Account recovery QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
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
  let writes = 0,
    mode = "ok",
    lastCommand;
  const secret = "Synthetic!TemporaryPassword9";
  await page.route("**/api/account/recovery", async (route) => {
    const request = route.request();
    let data = await page.evaluate(() => window.recoveryFixture);
    if (request.method() === "POST") {
      writes++;
      lastCommand = request.postDataJSON();
      await new Promise((r) => setTimeout(r, 200));
      const target = data.find((x) => x.id === lastCommand.requestId);
      const outcome =
        lastCommand.action === "reject" ? "rejected" : target.request_type;
      if (mode === "network") return route.abort("failed");
      if (mode === "bad")
        return route.fulfill({ status: 200, json: { message: "Saved" } });
      if (mode === "deny")
        return route.fulfill({
          status: 400,
          json: { message: "Wrong password" },
        });
      if (mode === "conflict")
        return route.fulfill({ status: 409, json: { message: "Changed" } });
      if (mode === "uncertain")
        return route.fulfill({ status: 503, json: { message: "Unavailable" } });
      data = data.filter((x) => x.id !== target.id);
      await page.evaluate((d) => (window.recoveryFixture = d), data);
      return route.fulfill({
        status: 200,
        json: {
          code: "resolved",
          requestId: target.id,
          outcome,
          message: "Permintaan selesai.",
          ...(outcome === "password" ? { temporaryPassword: secret } : {}),
        },
      });
    }
    return route.fulfill({
      status: mode === "get-error" ? 503 : 200,
      json: { requests: data },
    });
  });
  const approve = () =>
    page.getByRole("button", { name: "Setujui dan pulihkan", exact: true });
  const reload = () =>
    page.getByRole("button", { name: "Muat ulang antrean", exact: true });
  const select = () => page.locator("#recovery-request");
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
  async function fill(n = 1) {
    await select().selectOption(id(n));
    await page
      .getByLabel("Referensi pemeriksaan identitas")
      .fill("BA-2026-0001");
    await page.getByRole("checkbox").check();
    await page
      .getByLabel("Password Admin saat ini", { exact: true })
      .fill("SyntheticAdmin9!");
  }
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base);
    await select().waitFor();
    await geometry("queue " + width);
    await a11y("queue " + width);
    if (width === 320) {
      await page
        .getByRole("button", {
          name: "Tinjau permintaan @student-1",
          exact: true,
        })
        .tap();
      check((await select().inputValue()) === id(1), "touch review action");
    }
    await select().selectOption(id(1));
    await geometry("selected " + width);
    await page.screenshot({
      path: join(out, "account-recovery-" + width + ".png"),
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.getByRole("button", { name: "Berikutnya", exact: true }).click();
  check(
    await page.getByText("25 hasil · Halaman 2 dari 3").isVisible(),
    "pagination",
  );
  await page.getByLabel("Cari nama atau username").fill("student-24");
  check((await page.locator("li").count()) === 1, "search username");
  await page.getByLabel("Cari nama atau username").fill("missing");
  check(
    await page
      .getByText("Tidak ada permintaan yang sesuai pencarian.")
      .isVisible(),
    "search empty",
  );
  await page.getByLabel("Cari nama atau username").fill("");
  await page.getByLabel("Jenis permintaan").selectOption("session");
  check(
    await page.getByText("12 hasil · Halaman 1 dari 2").isVisible(),
    "type filter",
  );
  await page.getByLabel("Jenis permintaan").selectOption("all");
  check(
    await select()
      .locator('option[value="' + id(25) + '"]')
      .evaluate((e) => e.disabled),
    "own account unavailable",
  );
  await page
    .getByRole("button", { name: "Tinjau permintaan @student-1", exact: true })
    .click();
  check(
    (await select().inputValue()) === id(1),
    "review action selects request",
  );
  check(
    await select().evaluate((e) => document.activeElement === e),
    "review focus",
  );
  await fill();
  await select().selectOption(id(2));
  check(
    !(await page.getByRole("checkbox").isChecked()),
    "changing target clears identity proof",
  );
  check(
    (await page
      .getByLabel("Password Admin saat ini", { exact: true })
      .inputValue()) === "",
    "changing target clears Admin password",
  );
  await fill();
  page.off("dialog", accept);
  page.once("dialog", (d) => d.dismiss());
  const beforeCancel = writes;
  await approve().click();
  check(writes === beforeCancel, "cancel confirmation does not write");
  page.on("dialog", accept);
  mode = "deny";
  await approve().click();
  await page
    .getByText(
      "Password Admin tidak sesuai atau isian tidak valid. Periksa kembali.",
    )
    .waitFor();
  check(
    (await page
      .getByLabel("Password Admin saat ini", { exact: true })
      .inputValue()) === "",
    "Admin password cleared after refusal",
  );
  check(
    (await page.getByLabel("Referensi pemeriksaan identitas").inputValue()) ===
      "BA-2026-0001",
    "evidence preserved on error",
  );
  mode = "ok";
  await fill();
  const before = writes;
  await approve().evaluate((e) => {
    e.click();
    e.click();
  });
  await page.getByLabel("Password baru", { exact: true }).waitFor();
  check(writes === before + 1, "double click sends one write");
  check(
    lastCommand.requestId === id(1) && lastCommand.action === "approve",
    "correct request and action",
  );
  check(
    (await page.getByLabel("Password baru", { exact: true }).inputValue()) ===
      secret,
    "temporary password displayed",
  );
  check(await reload().isDisabled(), "refresh cannot discard password");
  check(
    await approve().isDisabled(),
    "mutations blocked while password displayed",
  );
  check(
    await page.evaluate(
      () =>
        Object.keys(localStorage).length === 0 &&
        Object.keys(sessionStorage).length === 0,
    ),
    "no password browser storage",
  );
  await geometry("temporary password");
  await a11y("temporary password");
  await page
    .getByRole("button", { name: "Selesai menyerahkan, hapus tampilan" })
    .click();
  check(
    (await page.getByLabel("Password baru", { exact: true }).count()) === 0,
    "password cleared explicitly",
  );
  await fill(2);
  await approve().click();
  await page.getByText("Permintaan selesai.", { exact: true }).waitFor();
  check(
    (await page.getByLabel("Password baru", { exact: true }).count()) === 0,
    "session recovery has no password",
  );
  await fill(3);
  await page
    .getByRole("button", { name: "Tolak permintaan", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      !document.querySelector(
        'option[value="00000000-0000-4000-8000-000000000003"]',
      ),
  );
  check(lastCommand.action === "reject", "rejection keeps explicit action");
  mode = "bad";
  await fill(4);
  await approve().click();
  await page.getByText(/^Hasil pemulihan belum dapat dipastikan/).waitFor();
  check(
    await approve().isDisabled(),
    "unknown 200 acknowledgement locks actions",
  );
  const badWrites = writes;
  mode = "ok";
  await reload().click();
  await page.getByText(/^Antrean diperbarui/).waitFor();
  check(writes === badWrites, "refresh never replays write");
  mode = "uncertain";
  await fill(4);
  await approve().click();
  await page.getByText(/^Hasil pemulihan belum dapat dipastikan/).waitFor();
  check(await approve().isDisabled(), "503 locks mutations");
  mode = "get-error";
  await reload().click();
  await page.getByText(/^Antrean belum dapat dimuat/).waitFor();
  check(await approve().isDisabled(), "GET failure retains lock");
  mode = "ok";
  await reload().click();
  await page.getByText(/^Antrean diperbarui/).waitFor();
  mode = "network";
  await fill(4);
  await approve().click();
  await page.getByText(/^Hasil pemulihan belum dapat dipastikan/).waitFor();
  check(await approve().isDisabled(), "network failure locks mutation");
  mode = "ok";
  await reload().click();
  await page.getByText(/^Antrean diperbarui/).waitFor();
  mode = "conflict";
  await fill(4);
  await approve().click();
  await page.getByText(/^Permintaan berubah/).waitFor();
  check(await approve().isDisabled(), "stale conflict requires reload");
  mode = "ok";
  await reload().click();
  await page.getByText(/^Antrean diperbarui/).waitFor();
  await page.setViewportSize({ width: 844, height: 390 });
  await geometry("landscape");
  await select().focus();
  await page.keyboard.press("Tab");
  check(
    await page
      .getByLabel("Referensi pemeriksaan identitas")
      .evaluate((e) => document.activeElement === e),
    "keyboard order",
  );
  await page.goto(base + "/?expired=1");
  await select().waitFor();
  await page.waitForTimeout(1100);
  check(
    await select()
      .locator('option[value="' + id(1) + '"]')
      .evaluate((e) => e.disabled),
    "expired request disabled after clock tick",
  );
  await page.goto(base + "/?empty=1");
  await reload().waitFor();
  check(
    await page.getByText(/^Tidak ada permintaan aktif/).isVisible(),
    "empty queue",
  );
  check((await approve().count()) === 0, "no empty queue mutation form");
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
