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
  process.env.COMMITTEE_QA_OUTPUT ?? join(root, "docs/verification/committee");
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
  entryPoints: [join(root, "tests/ui/committee-fixture.tsx")],
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
          path: join(root, "tests/ui/committee-navigation-shim.ts"),
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
  let posts = [],
    gets = [],
    reply = "success",
    contextReply = "success";
  await page.route("**/api/operations/fees?*", async (route) => {
    const request = route.request(),
      data = await page.evaluate(() => window.committeeFixture),
      q = new URL(request.url()).searchParams;
    if (request.method() === "GET") {
      gets.push(request.url());
      if (q.get("view") === "payment") {
        if (contextReply === "error")
          return route.fulfill({
            status: 503,
            json: { message: "Unavailable" },
          });
        if (contextReply === "slow")
          await new Promise((r) => setTimeout(r, 700));
        const year = Number(q.get("year")),
          student = q.get("studentId");
        data.rows = [];
        data.total = 0;
        data.people = data.people.filter((p) => p.id === student);
        data.summary.cashReceived = 0;
        data.extra.months = Array.from({ length: 12 }, (_, i) => {
          const paid =
              (year === 2026 && i === 0) || (year === 2025 && i === 11),
            waived = year === 2026 && i === 1,
            unknown = i === 3;
          return {
            student_id: student,
            name: "Siswa",
            month: year + "-" + String(i + 1).padStart(2, "0") + "-01",
            status: paid ? "paid" : waived ? "waived" : "unpaid",
            amount: paid ? (year === 2025 ? 50000 : 60000) : 0,
            waiverSources: waived ? 1 : 0,
            tariff: unknown ? null : 50000,
            outstanding: paid || waived ? 0 : unknown ? null : 50000,
          };
        });
        if (contextReply === "incomplete") data.extra.months.pop();
        if (contextReply === "stale") data.revision++;
        return route.fulfill({ json: { data } });
      }
      if (reply === "read-error")
        return route.fulfill({ status: 503, json: { message: "Unavailable" } });
      data.page = Number(q.get("page") ?? 1);
      data.people = [];
      if (q.get("studentId"))
        data.extra.months = data.extra.months.filter(
          (m) => m.student_id === q.get("studentId"),
        );
      return route.fulfill({ json: { data } });
    }
    posts.push(request.postDataJSON());
    if (reply === "network") return route.abort();
    if (reply === "hang") return;
    if (reply === "slow") await new Promise((r) => setTimeout(r, 700));
    if (["stale", "denied", "invalid", "duplicate"].includes(reply))
      return route.fulfill({
        status: reply === "denied" ? 403 : 409,
        json: {
          code: reply,
          result: { code: reply },
          message: "Perubahan ditolak: " + reply,
        },
      });
    if (reply === "malformed")
      return route.fulfill({
        json: { result: { code: "saved" }, data: { revision: -1 } },
      });
    if (reply === "removed") {
      data.rows = [];
      data.total = 0;
    }
    data.revision++;
    await page.evaluate(next => {window.committeeFixture=next;},data);
    return route.fulfill({
      json: {
        result: { code: "saved" },
        code: "saved",
        data,
        message: "Perubahan berhasil disimpan.",
      },
    });
  });
  async function visit(mode = "normal", width = 375, height = 812) {
    reply = "success";
    contextReply = "success";
    posts = [];
    gets = [];
    await page.setViewportSize({ width, height });
    await page.goto(base + "/?mode=" + mode);
    await page.getByRole("heading", { level: 1 }).waitFor();
  }
  const dialog = () => page.getByRole("dialog"),
    history = () => page.getByRole("region", { name: "Filter iuran" });
  async function openPayment() {
    await page
      .getByRole("button", { name: "Input pembayaran", exact: true })
      .tap();
    await dialog()
      .getByRole("combobox", { name: "Siswa", exact: true })
      .selectOption(id(10));
    await dialog().getByText("Bulan iuran 2026", { exact: true }).waitFor();
  }
  async function prepare() {
    await openPayment();
    await dialog()
      .getByRole("checkbox", { name: "Maret 2026", exact: true })
      .check();
  }
  async function correction() {
    await page
      .getByRole("button", { name: "Koreksi", exact: true })
      .first()
      .click();
    await dialog().getByText("Bulan iuran 2025", { exact: true }).waitFor();
    await dialog()
      .getByRole("button", { name: "Simpan koreksi", exact: true })
      .waitFor({ state: "visible" });
    await page.waitForFunction(
      () => !document.querySelector("[role=dialog] fieldset")?.disabled,
    );
  }
  async function bounds(name) {
    const r = await dialog().evaluate((e) => {
      const b = e.getBoundingClientRect();
      return {
        x: b.x,
        y: b.y,
        right: b.right,
        bottom: b.bottom,
        vw: innerWidth,
        vh: innerHeight,
        scroll: e.scrollWidth,
        client: e.clientWidth,
      };
    });
    check(
      r.x >= -1 &&
        r.y >= -1 &&
        r.right <= r.vw + 1 &&
        r.bottom <= r.vh + 1 &&
        r.scroll <= r.client + 1,
      name + " dialog contained",
      r,
    );
  }
  for (const mode of [
    "normal",
    "empty",
    "large",
    "readonly",
    "loading",
    "error",
  ]) {
    await visit(mode, 320, 568);
    await geometry(page, mode + " mobile");
    if (!["loading", "error"].includes(mode))
      await a11y(page, mode + " mobile");
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await geometry(page, mode + " " + width);
    }
    if (mode === "readonly")
      check(
        (await page
          .getByRole("button", { name: "Input pembayaran", exact: true })
          .count()) === 0,
        "readonly cannot input",
      );
  }
  // Context is separate from history; locked paid/waived months, unknown tariff validation, cross-year selections.
  await visit();
  await history()
    .getByRole("combobox", { name: "Siswa", exact: true })
    .selectOption(id(10));
  await history().getByRole("button", { name: "Terapkan filter" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Data iuran diperbarui" })
    .waitFor();
  check(
    (
      await page
        .getByRole("link", { name: "Ekspor Excel" })
        .getAttribute("href")
    ).includes("studentId=" + id(10)),
    "export retains history filter",
  );
  await openPayment();
  check(
    (await dialog()
      .getByRole("combobox", { name: "Siswa", exact: true })
      .locator("option")
      .count()) === 4,
    "history filtering does not narrow input catalog",
  );
  check(
    await dialog()
      .getByRole("checkbox", { name: "Januari 2026", exact: true })
      .isDisabled(),
    "paid month locked",
  );
  check(
    await dialog()
      .getByRole("checkbox", { name: "Februari 2026", exact: true })
      .isDisabled(),
    "sibling waived month locked",
  );
  await dialog()
    .getByRole("checkbox", { name: "Maret 2026", exact: true })
    .check();
  check(
    (await dialog()
      .getByLabel("Nominal 2026-03 (Rp)", { exact: true })
      .inputValue()) === "50000",
    "known positive tariff prefills amount",
  );
  await dialog()
    .getByRole("checkbox", { name: "April 2026", exact: true })
    .check();
  await dialog()
    .getByRole("button", { name: "Simpan pembayaran", exact: true })
    .click();
  check(posts.length === 0, "unknown tariff requires explicit positive amount");
  await dialog()
    .getByLabel("Nominal 2026-04 (Rp)", { exact: true })
    .fill("60000");
  await dialog()
    .getByRole("combobox", { name: "Tahun bulan iuran", exact: true })
    .selectOption("2027");
  await dialog().getByText("Bulan iuran 2027", { exact: true }).waitFor();
  check(
    (await dialog()
      .getByRole("region", { name: "Bulan terpilih" })
      .getByText("2026-03 · Rp50.000", { exact: true })
      .count()) === 1,
    "year switch retains previous selections",
  );
  await dialog()
    .getByRole("checkbox", { name: "Januari 2027", exact: true })
    .check();
  await dialog()
    .getByRole("button", { name: "Simpan pembayaran", exact: true })
    .dblclick();
  await dialog().waitFor({ state: "hidden" });
  check(posts.length === 1, "double submission locked");
  check(
    posts[0].command.allocations.length === 3 &&
      posts[0].command.allocations.some((a) => a.month === "2027-01-01"),
    "payment payload preserves cross-year allocations",
  );
  // Correction must preserve all original allocations even when history year is different.
  await visit();
  await correction();
  check(
    gets.filter((url) => url.includes("view=payment")).length === 2,
    "cross-year correction fetches both full monthly contexts",
  );
  check(
    await dialog()
      .getByRole("checkbox", { name: "Desember 2025", exact: true })
      .isChecked(),
    "previous-year allocation prefilled",
  );
  await dialog()
    .getByRole("combobox", { name: "Tahun bulan iuran", exact: true })
    .selectOption("2026");
  await dialog().getByText("Bulan iuran 2026", { exact: true }).waitFor();
  check(
    await dialog()
      .getByRole("checkbox", { name: "Januari 2026", exact: true })
      .isChecked(),
    "current-year allocation retained",
  );
  check(
    (await dialog()
      .getByRole("checkbox", { name: "Januari 2026", exact: true })
      .isDisabled()) === false,
    "own original paid month remains editable",
  );
  await dialog()
    .getByRole("button", { name: "Simpan koreksi", exact: true })
    .click();
  check(posts.length === 0, "correction requires reason");
  await dialog()
    .getByLabel("Alasan koreksi / pembatalan")
    .fill("Koreksi diperiksa");
  await dialog()
    .getByRole("button", { name: "Simpan koreksi", exact: true })
    .click();
  await dialog().waitFor({ state: "hidden" });
  check(
    posts[0].command.allocations.length === 2 &&
      posts[0].command.allocations.some((a) => a.month === "2025-12-01"),
    "correction does not drop original previous-year month",
  );
  check(
    posts[0].command.allocations.reduce((n, a) => n + a.amount, 0) === 110000,
    "correction preserves exact cash total",
  );
  await correction();
  await dialog().getByLabel("Alasan koreksi / pembatalan").fill("Data ganda");
  reply = "removed";
  await dialog()
    .getByRole("button", { name: "Batalkan pembayaran", exact: true })
    .click();
  await dialog().waitFor({ state: "hidden" });
  check(posts.at(-1).command.type === "void", "void retains contract");
  check(
    await page
      .locator("#committee-filter")
      .evaluate((e) => e === document.activeElement),
    "removed row returns stable focus",
  );
  // Context outages, incomplete data and revision mismatch must never enable a blind payment.
  for (const failure of ["error", "incomplete", "stale"]) {
    await visit();
    contextReply = failure;
    await page
      .getByRole("button", { name: "Input pembayaran", exact: true })
      .click();
    await dialog()
      .getByRole("combobox", { name: "Siswa", exact: true })
      .selectOption(id(10));
    await dialog().getByRole("alert").waitFor();
    check(
      await dialog()
        .getByRole("button", { name: "Simpan pembayaran", exact: true })
        .isDisabled(),
      failure + " context blocks save",
    );
    if (failure !== "stale") {
      contextReply = "success";
      await dialog()
        .getByRole("button", { name: "Muat status kembali", exact: true })
        .click();
      await dialog().getByText("Bulan iuran 2026", { exact: true }).waitFor();
      check(
        await dialog()
          .getByRole("button", { name: "Simpan pembayaran", exact: true })
          .isEnabled(),
        failure + " context retry recovers",
      );
    }
  }
  // Positive/zero tariff, explicit overwrite confirmation and modal geometry/focus.
  await visit();
  const tariffTrigger = page.getByRole("button", {
    name: "Atur tarif bulanan",
    exact: true,
  });
  await tariffTrigger.click();
  await dialog()
    .getByRole("combobox", { name: "Kelas", exact: true })
    .selectOption(id(300));
  await dialog().getByLabel("Tarif (Rp)", { exact: true }).fill("0");
  await a11y(page, "tariff modal");
  await bounds("tariff mobile");
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.dismiss());
  await dialog()
    .getByRole("button", { name: "Simpan tarif", exact: true })
    .click();
  check(posts.length === 0, "declined tariff overwrite never writes");
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.accept());
  await dialog()
    .getByRole("button", { name: "Simpan tarif", exact: true })
    .click();
  await dialog().waitFor({ state: "hidden" });
  check(
    posts[0].command.type === "tariff" && posts[0].command.amount === 0,
    "zero tariff accepted distinctly from unknown tariff",
  );
  await visit();
  await prepare();
  await a11y(page, "payment modal");
  await bounds("payment mobile");
  await page.setViewportSize({ width: 812, height: 375 });
  await bounds("landscape");
  await page.setViewportSize({ width: 1440, height: 900 });
  await bounds("desktop resize");
  await page.screenshot({ path: join(out, "committee-desktop.png") });
  await page.setViewportSize({ width: 320, height: 568 });
  await bounds("short mobile");
  const close = dialog().getByRole("button", { name: "Tutup", exact: true });
  await close.scrollIntoViewIfNeeded();
  const box = await close.boundingBox();
  check(
    box.y >= 0 && box.y + box.height <= 568,
    "short modal footer reachable",
  );
  await page.screenshot({ path: join(out, "committee-mobile.png") });
  await page.keyboard.press("Tab");
  check(
    await dialog().evaluate((e) => e.contains(document.activeElement)),
    "keyboard focus trapped",
  );
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.dismiss());
  await page.keyboard.press("Escape");
  check((await dialog().count()) === 1, "declined dirty close retains dialog");
  check(
    (await dialog()
      .getByLabel("Nominal 2026-03 (Rp)", { exact: true })
      .inputValue()) === "50000",
    "declined close retains amount",
  );
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.accept());
  await page.keyboard.press("Escape");
  await dialog().waitFor({ state: "hidden" });
  check(
    await page
      .getByRole("button", { name: "Input pembayaran", exact: true })
      .evaluate((e) => e === document.activeElement),
    "Escape returns trigger focus",
  );
  // Retry policy, pending dismissal, read failures and paging of both history and monthly recap.
  for (const failure of [
    "invalid",
    "duplicate",
    "stale",
    "denied",
    "network",
    "malformed",
  ]) {
    await visit();
    await prepare();
    reply = failure;
    await dialog()
      .getByRole("button", { name: "Simpan pembayaran", exact: true })
      .click();
    await dialog().getByRole("alert").waitFor();
    check(
      (await dialog()
        .getByRole("button", { name: "Simpan pembayaran", exact: true })
        .isDisabled()) ===
        ["stale", "denied", "network", "malformed"].includes(failure),
      failure + " retry policy",
    );
    check(
      (await dialog()
        .getByLabel("Nominal 2026-03 (Rp)", { exact: true })
        .inputValue()) === "50000",
      failure + " retains amount",
    );
  }
  await visit();
  await prepare();
  reply = "slow";
  await dialog()
    .getByRole("button", { name: "Simpan pembayaran", exact: true })
    .click();
  await page.keyboard.press("Escape");
  check((await dialog().count()) === 1, "pending save cannot close");
  await dialog().waitFor({ state: "hidden" });
  await visit("large");
  check(
    (await page
      .getByRole("region", { name: "Status bulanan siswa" })
      .locator("tbody tr")
      .count()) === 50,
    "recap renders bounded page of large data",
  );
  await page
    .getByRole("button", { name: "Rekap berikutnya", exact: true })
    .click();
  check(
    (await page
      .getByText("Halaman rekap 2 dari 20", { exact: true })
      .count()) === 1,
    "monthly recap paginates",
  );
  await page
    .getByLabel("Cari pada rekap", { exact: true })
    .fill("Pembebasan saudara");
  check(
    (await page
      .getByText("Halaman rekap 1 dari 2", { exact: true })
      .count()) === 1,
    "recap search resets independent page",
  );
  await page
    .getByRole("button", { name: "Riwayat berikutnya", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Data iuran diperbarui" })
    .waitFor();
  check(
    (await page.getByText("Halaman 2 dari 3", { exact: true }).count()) === 1,
    "history pagination advances",
  );
  reply = "read-error";
  await page
    .getByRole("button", { name: "Riwayat sebelumnya", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Data belum dapat dimuat" })
    .waitFor();
  check(
    (await page.getByText("Halaman 2 dari 3", { exact: true }).count()) === 1,
    "failed read retains prior page",
  );
  await visit();
  await prepare();
  await page.clock.install();
  reply = "hang";
  await dialog()
    .getByRole("button", { name: "Simpan pembayaran", exact: true })
    .click();
  await page.clock.fastForward(31000);
  await page.clock.resume();
  await dialog()
    .getByRole("alert")
    .filter({ hasText: "Hasil penyimpanan" })
    .waitFor();
  check(
    await dialog()
      .getByRole("button", { name: "Simpan pembayaran", exact: true })
      .isDisabled(),
    "30 second timeout blocks blind retry",
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
