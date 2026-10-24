/** Isolated Committee browser regression suite. No real account, API mutation or production data. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd(),
  baseline = process.argv.includes("--baseline");
const out =
  process.env.SAVINGS_QA_OUTPUT ?? join(root, "docs/verification/savings");
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
  entryPoints: [join(root, "tests/ui/savings-fixture.tsx")],
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
        b.onResolve({ filter: /^next\/navigation$/ }, () => ({
          path: join(root, "tests/ui/savings-navigation-shim.ts"),
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Absensi QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const checks = [],
  issues = [],
  errors = [],
  axeResults = [];
let browser;
function check(ok, name, detail) {
  checks.push({ name, passed: !!ok, ...(detail ? { detail } : {}) });
  console.log(checks.length + " " + name);
  if (!ok) {
    issues.push(name);
    if (!baseline) assert.fail(name + " " + JSON.stringify(detail ?? ""));
  }
}
async function geometry(page, name) {
  const size = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  if (size.document > size.viewport + 1 && !baseline) {
    const nodes = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .map((e) => ({
          tag: e.tagName,
          class: e.className,
          text: e.textContent?.slice(0, 50),
          x: e.getBoundingClientRect().x,
          right: e.getBoundingClientRect().right,
          width: e.getBoundingClientRect().width,
        }))
        .filter((e) => e.right > innerWidth + 1 && e.x >= 0)
        .slice(0, 30),
    );
    await writeFile(
      join(out, "overflow-diagnostic.json"),
      JSON.stringify(nodes, null, 2),
    );
  }
  check(
    size.document <= size.viewport + 1,
    name + " no horizontal overflow",
    size,
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
  axeResults.push({ name, violations });
  check(!violations.length, name + " axe", violations);
}
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.UI_CHROMIUM_EXECUTABLE,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const page = await browser.newPage({ hasTouch: true });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => d.accept());
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const posts = [];
  let outcome = "success",
    feeZero = false,
    readFailure = false;
  await page.route("**/api/operations/savings?*", async (route) => {
    const data = await page.evaluate(() => window.savingsFixture);
    if (route.request().method() === "POST") {
      const b = route.request().postDataJSON();
      posts.push(b);
      if (outcome === "uncertain")
        return route.fulfill({
          status: 503,
          json: { message: "Hasil belum pasti" },
        });
      if (outcome === "insufficient")
        return route.fulfill({
          status: 409,
          json: { code: "insufficient", message: "Saldo tidak mencukupi." },
        });
      data.revision = route.request().postDataJSON().revision + 1;
      if (b.command.type === "void") {
        data.rows = data.rows.filter((r) => r.id !== b.command.id);
        data.total = data.rows.length;
      }

      if (b.command.type === "account")
        data.extra.catalogAccounts = [
          ...data.extra.accounts,
          {
            id: id(399),
            owner_id: b.command.ownerId,
            name: "Rekening baru",
            category: b.command.category,
            balance: 0,
          },
        ];
      await page.evaluate((d) => (window.savingsFixture = d), data);
      return route.fulfill({
        json: {
          code: "saved",
          result: { code: "saved" },
          message: "Perubahan tersimpan.",
          data,
        },
      });
    }
    if (readFailure)
      return route.fulfill({ status: 503, json: { message: "Unavailable" } });
    if (new URL(route.request().url()).searchParams.get("studentId"))
      data.extra.accounts = data.extra.accounts.slice(0, 1);
    return route.fulfill({ json: { data } });
  });
  await page.route("**/api/slips/quote?*", (route) => {
    const q = new URL(route.request().url()).searchParams,
      amount = Number(q.get("amount")),
      applied = q.get("apply") === "true";
    return route.fulfill({
      json: {
        quote: {
          applied,
          bracket: null,
          raw: 1230,
          fee: applied ? 1000 : 0,
          cash: amount - (applied ? 1000 : 0),
          policy: "FEE-1.0",
          matched: false,
        },
      },
    });
  });
  await page.route("**/api/slips/*", async (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/quote"))
      return route.fallback();
    if (route.request().method() === "POST")
      return route.fulfill({
        status: 503,
        json: { status: "ambiguous", message: "Status belum pasti" },
      });
    return route.fulfill({
      json: {
        slip: {
          reversed: false,
          snapshot: {
            transaction: { id: id(400), account_id: id(300), amount: 123000 },
            fee: {
              applied: true,
              bracket: null,
              raw: feeZero ? 0 : 1230,
              fee: feeZero ? 0 : 1000,
              cash: feeZero ? 123000 : 122000,
              policy: "FEE-1.0",
              matched: false,
            },
          },
          deliveries: [
            {
              email: "verified@example.test",
              status: "ambiguous",
              attempts: 1,
            },
          ],
        },
      },
    });
  });
  const visit = async (mode = "normal", width = 375) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(base + "/?mode=" + mode);
    await page.locator("#main-content").waitFor();
  };
  for (const width of [320, 375, 768, 1440]) {
    await visit("normal", width);
    await page
      .getByRole("button", { name: "Input transaksi", exact: true })
      .waitFor();
    await geometry(page, "normal " + width);
    if (width === 320 || width === 1440) await a11y(page, "normal " + width);
  }
  for (const mode of ["empty", "large", "readonly", "loading", "error"]) {
    await visit(mode, 320);
    await geometry(page, mode + " 320");
    if (["empty", "large", "readonly"].includes(mode)) await a11y(page, mode);
    if (mode === "readonly")
      check(
        (await page
          .getByRole("button", { name: "Input transaksi", exact: true })
          .count()) === 0,
        "readonly has no transaction mutation",
      );
  }
  await visit();
  const dialog = page.getByRole("dialog");
  await page
    .getByRole("button", { name: "Input transaksi", exact: true })
    .click();
  check(
    (await dialog
      .getByRole("checkbox", { name: "Terapkan biaya penarikan" })
      .count()) === 0,
    "deposit hides withdrawal fee",
  );
  await dialog
    .getByRole("combobox", { name: "Rekening", exact: true })
    .selectOption(id(300));
  await dialog
    .getByRole("combobox", { name: /^Jenis transaksi/ })
    .selectOption("withdrawal");
  await dialog.getByLabel("Nominal (Rp)", { exact: true }).fill("123000");
  await dialog
    .getByRole("checkbox", { name: "Terapkan biaya penarikan" })
    .check();
  await dialog.getByRole("button", { name: "Hitung biaya di server" }).click();
  await dialog.getByText(/Biaya Rp1.000/).waitFor();
  check(true, "server quote renders fee and net cash");
  await dialog.getByLabel("Nominal (Rp)", { exact: true }).fill("124000");
  check(
    (await dialog.getByText(/Biaya Rp1.000/).count()) === 0,
    "changed amount hides stale quote",
  );
  await geometry(page, "transaction modal 375");
  await a11y(page, "transaction modal");
  await dialog
    .getByLabel("Keterangan / alasan transaksi", { exact: true })
    .fill("Pengambilan uang");
  await dialog.getByRole("button", { name: "Simpan transaksi" }).click();
  await dialog.waitFor({ state: "hidden" });
  check(
    posts.at(-1).command.amount === 124000 &&
      posts.at(-1).command.feeApplied === true,
    "withdrawal submits exact gross amount and fee flag",
  );
  await page
    .getByRole("button", { name: "Buka rekening", exact: true })
    .click();
  await dialog
    .getByRole("combobox", { name: "Pemilik rekening", exact: true })
    .selectOption(id(12));
  await dialog.getByRole("button", { name: "Simpan rekening" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Input transaksi", exact: true })
    .click();
  check(
    (await dialog
      .getByRole("combobox", { name: "Rekening", exact: true })
      .locator('option[value="' + id(399) + '"]')
      .count()) === 1,
    "new account available without reload",
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  feeZero = true;
  await page
    .getByRole("button", { name: /Koreksi/ })
    .first()
    .click();
  await dialog
    .getByRole("button", { name: "Simpan koreksi" })
    .waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.querySelector("input[type=checkbox]")?.checked === true,
  );
  check(
    await dialog
      .getByRole("checkbox", { name: "Terapkan biaya penarikan" })
      .isChecked(),
    "correction preserves applied true even when original fee is zero",
  );
  check(
    (await dialog
      .getByRole("combobox", { name: "Rekening", exact: true })
      .locator("option")
      .count()) === 1,
    "correction cannot change original account",
  );
  check(
    (
      await dialog
        .getByLabel("Keterangan / alasan transaksi", { exact: true })
        .inputValue()
    ).startsWith("Catatan"),
    "correction prefills existing note",
  );
  await page.setViewportSize({ width: 768, height: 375 });
  await geometry(page, "landscape modal");
  await dialog
    .getByRole("button", { name: "Simpan koreksi" })
    .scrollIntoViewIfNeeded();
  check(
    await dialog.getByRole("button", { name: "Simpan koreksi" }).isVisible(),
    "short landscape modal submit reachable",
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await visit();
  await page
    .getByRole("button", { name: /Ubah tarif/ })
    .first()
    .click();
  check(
    (await dialog
      .getByLabel("Persentase (%)", { exact: true })
      .inputValue()) === "1.25",
    "bracket precision prefills",
  );
  check(
    !(await dialog.getByRole("checkbox", { name: "Tarif aktif" }).isChecked()),
    "inactive bracket remains inactive",
  );
  await dialog
    .getByLabel("Alasan perubahan tarif", { exact: true })
    .fill("Penyesuaian tarif");
  await dialog.getByRole("button", { name: "Simpan tarif" }).click();
  await dialog.waitFor({ state: "hidden" });
  check(
    posts.at(-1).command.active === false &&
      posts.at(-1).command.reason === "Penyesuaian tarif",
    "bracket correction preserves status and reason",
  );
  await page.getByRole("button", { name: /Kirim/ }).first().click();
  await page
    .getByText(/Hasil pengiriman belum dapat dipastikan/)
    .first()
    .waitFor();
  check(
    await page.getByRole("button", { name: /Kirim/ }).first().isDisabled(),
    "ambiguous email send blocks blind retry",
  );
  await visit("large");
  await page
    .getByRole("button", { name: "Rekening berikutnya", exact: true })
    .click();
  check(
    await page
      .getByText("Halaman rekening 2 dari 4", { exact: true })
      .isVisible(),
    "account pagination advances",
  );
  await page
    .getByLabel("Cari rekening", { exact: true })
    .fill("Tidak ditemukan");
  check(
    await page
      .getByText("Halaman rekening 1 dari 1", { exact: true })
      .isVisible(),
    "search resets account pagination",
  );
  check(
    await page
      .getByText("Belum ada rekening sesuai pilihan dan hak akses.", {
        exact: true,
      })
      .isVisible(),
    "account search empty state",
  );
  await visit();
  await page
    .getByRole("combobox", { name: "Pemilik rekening", exact: true })
    .selectOption(id(10));
  await page
    .getByRole("button", { name: "Terapkan filter", exact: true })
    .click();
  await page.getByText("Data tabungan diperbarui.", { exact: true }).waitFor();
  check(
    await page
      .getByRole("heading", { name: "Daftar rekening (1)", exact: true })
      .isVisible(),
    "owner filter narrows displayed accounts",
  );
  await page
    .getByRole("button", { name: "Input transaksi", exact: true })
    .click();
  check(
    (await dialog
      .getByRole("combobox", { name: "Rekening", exact: true })
      .locator("option")
      .count()) === 3,
    "history filter retains full input catalog",
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  check(
    await page
      .getByRole("button", { name: "Input transaksi", exact: true })
      .evaluate((e) => e === document.activeElement),
    "Escape returns focus to trigger",
  );
  readFailure = true;
  await page
    .getByRole("button", { name: "Terapkan filter", exact: true })
    .click();
  await page.getByText(/Data belum dapat dimuat/).waitFor();
  check(
    await page
      .getByRole("heading", { name: "Daftar rekening (1)", exact: true })
      .isVisible(),
    "read failure preserves previous snapshot",
  );
  readFailure = false;
  await visit();
  outcome = "insufficient";
  await page
    .getByRole("button", { name: "Input transaksi", exact: true })
    .click();
  await dialog
    .getByRole("combobox", { name: "Rekening", exact: true })
    .selectOption(id(300));
  await dialog.getByLabel("Nominal (Rp)", { exact: true }).fill("1001");
  await dialog
    .getByLabel("Keterangan / alasan transaksi", { exact: true })
    .fill("Setoran baru");
  const before = posts.length;
  await dialog.getByRole("button", { name: "Simpan transaksi" }).click();
  check(
    posts.length === before,
    "native amount step validation prevents request",
  );
  await dialog.getByLabel("Nominal (Rp)", { exact: true }).fill("1000");
  await dialog.getByRole("button", { name: "Simpan transaksi" }).click();
  await dialog.getByText("Saldo tidak mencukupi.", { exact: true }).waitFor();
  check(
    (await dialog.isVisible()) &&
      (await dialog
        .getByRole("button", { name: "Simpan transaksi" })
        .isEnabled()),
    "definitive insufficient keeps editable draft",
  );
  check(
    (await dialog.getByLabel("Nominal (Rp)", { exact: true }).inputValue()) ===
      "1000",
    "failed command preserves amount",
  );
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.dismiss());
  await page.keyboard.press("Escape");
  check(await dialog.isVisible(), "dirty close cancellation retains dialog");
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.accept());
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  outcome = "success";
  await page
    .getByRole("button", { name: "Koreksi", exact: true })
    .first()
    .click();
  await dialog.getByRole("button", { name: "Simpan koreksi" }).waitFor();
  await page.waitForFunction(
    () => document.querySelector("input[type=checkbox]")?.checked === true,
  );
  await dialog
    .getByRole("button", { name: "Batalkan transaksi", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  check(
    posts.at(-1).command.type === "void" &&
      posts.at(-1).command.reason.startsWith("Catatan"),
    "void sends only existing reference and reason",
  );
  check(
    await page
      .locator("#savings-filter")
      .evaluate((e) => e === document.activeElement),
    "removed row restores fallback focus",
  );
  await visit("normal", 320);
  await page.screenshot({ path: join(out, "savings-mobile.png") });
  await visit("normal", 1440);
  await page.screenshot({ path: join(out, "savings-desktop.png") });
  await visit();
  outcome = "uncertain";
  await page
    .getByRole("button", { name: "Input transaksi", exact: true })
    .click();
  await dialog
    .getByRole("combobox", { name: "Rekening", exact: true })
    .selectOption(id(300));
  await dialog.getByLabel("Nominal (Rp)", { exact: true }).fill("1000");
  await dialog
    .getByLabel("Keterangan / alasan transaksi", { exact: true })
    .fill("Setoran baru");
  await dialog.getByRole("button", { name: "Simpan transaksi" }).click();
  await page
    .getByText(/belum dapat dipastikan|belum pasti/)
    .first()
    .waitFor();
  check(await dialog.isVisible(), "uncertain write retains form");
  check(
    await dialog.getByRole("button", { name: "Simpan transaksi" }).isDisabled(),
    "uncertain write blocks new command",
  );
  check(!errors.length, "no uncaught JavaScript errors", errors);
  await writeFile(
    join(out, "browser-results.json"),
    JSON.stringify(
      {
        status: "passed",
        checks,
        axe: axeResults,
        errors,
        limits: [
          "Synthetic fixtures and intercepted writes, not authenticated production role UAT or physical-device testing.",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      status: "passed",
      checks: checks.length,
      axe: axeResults.length,
    }),
  );
} catch (error) {
  await writeFile(
    join(out, "failure.json"),
    JSON.stringify(
      { error: String(error), checks, errors, axe: axeResults },
      null,
      2,
    ),
  );
  throw error;
} finally {
  if (browser) await browser.close();
  server.close();
}
