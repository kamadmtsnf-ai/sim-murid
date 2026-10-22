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
  process.env.POINTS_QA_OUTPUT ?? join(root, "docs/verification/points");
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
  entryPoints: [join(root, "tests/ui/points-fixture.tsx")],
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
          path: join(root, "tests/ui/points-navigation-shim.ts"),
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
  const posts = [],
    reads = [];
  let outcome = "success",
    readError = false,
    release;
  await page.route("**/api/services/discipline?*", async (route) => {
    const data = await page.evaluate(() => window.pointsFixture),
      req = route.request(),
      q = new URL(req.url()).searchParams;
    if (req.method() === "POST") {
      const body = req.postDataJSON();
      posts.push(body);
      if (outcome === "hang") return;
      if (outcome === "slow") await new Promise((r) => (release = r));
      if (outcome === "uncertain")
        return route.fulfill({
          status: 503,
          json: { message: "Hasil belum pasti" },
        });
      if (outcome === "archived")
        return route.fulfill({
          status: 409,
          json: {
            code: "archived",
            message: "Bulan sudah diarsipkan. Riwayat dipertahankan.",
          },
        });
      data.revision++;
      if (body.command.type === "catalog") {
        const c = body.command;
        data.extra.catalog = data.extra.catalog.filter(
          (x) => x.code !== c.code,
        );
        data.extra.catalog.push({ ...c });
      }
      if (body.command.type === "settings")
        data.extra.settings = {
          email_enabled: body.command.email,
          whatsapp_enabled: body.command.whatsapp,
          point_threshold: body.command.threshold,
          affective_subject_id: body.command.subjectId,
        };
      if (body.command.type === "cancel")
        for (const row of data.rows)
          row.snapshot.events = row.snapshot.events.filter(
            (e) => e.id !== body.command.id,
          );
      await page.evaluate((d) => (window.pointsFixture = d), data);
      return route.fulfill({
        json: {
          code: "saved",
          result: { code: "saved" },
          message: "Perubahan disimpan.",
          data,
        },
      });
    }
    reads.push(req.url());
    if (readError)
      return route.fulfill({ status: 503, json: { message: "Unavailable" } });
    if (q.get("classId"))
      data.rows = data.rows.filter((r) => r.class_id === q.get("classId"));
    if (q.get("month")) {
      if (data.month !== q.get("month"))
        data.extra.recordingStudents.push({
          student_id: id(99),
          class_id: id(300),
          class_name: "7A",
          name: "Siswa periode terpilih",
        });
      data.month = q.get("month");
      for (const r of data.rows) {
        r.snapshot.month = data.month;
        r.snapshot.events = [];
      }
    }
    return route.fulfill({ json: { data } });
  });
  const visit = async (mode = "normal", width = 375) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(base + "/?mode=" + mode);
    await page.locator("#main-content").waitFor();
  };
  const dialog = page.getByRole("dialog");
  for (const width of [320, 375, 768, 1440]) {
    await visit("normal", width);
    await page
      .getByRole("button", { name: "Catat kejadian", exact: true })
      .waitFor();
    await geometry(page, "normal " + width);
    if (width === 320 || width === 1440) await a11y(page, "normal " + width);
  }
  for (const mode of [
    "empty",
    "large",
    "readonly",
    "teacher",
    "loading",
    "error",
  ]) {
    await visit(mode, 320);
    await geometry(page, mode + " 320");
    if (["empty", "large", "readonly", "teacher"].includes(mode))
      await a11y(page, mode);
    if (mode === "readonly")
      check(
        (await page
          .getByRole("button", { name: "Catat kejadian", exact: true })
          .count()) === 0,
        "readonly has no recording controls",
      );
  }
  await visit("normal", 320);
  await page.locator("summary").first().click();
  await geometry(page, "expanded history 320");
  await a11y(page, "expanded history 320");
  check(
    await page.getByRole("table").first().isVisible(),
    "history table remains readable on mobile",
  );
  await visit("teacher");
  await page.locator("summary").first().click();
  check(
    (await page
      .getByRole("button", { name: "Batalkan kejadian", exact: true })
      .count()) === 1,
    "teacher can cancel own active event",
  );
  await page.locator("summary").nth(1).click();
  check(
    (await page
      .getByRole("button", { name: "Batalkan kejadian", exact: true })
      .count()) === 1,
    "archived event has no cancel action",
  );
  await page.locator("summary").nth(2).click();
  check(
    (await page
      .getByRole("button", { name: "Batalkan kejadian", exact: true })
      .count()) === 1,
    "teacher cannot cancel another author event",
  );
  await visit();
  await page
    .getByRole("button", { name: "Catat kejadian", exact: true })
    .click();
  check(
    (await dialog
      .getByRole("combobox", { name: /^Siswa/ })
      .locator("option")
      .count()) === 4,
    "recording student catalog complete",
  );
  check(
    (await dialog
      .getByRole("combobox", { name: /^Kode kejadian/ })
      .locator("option")
      .count()) === 2,
    "inactive code excluded from event input",
  );
  await dialog.getByRole("combobox", { name: /^Siswa/ }).selectOption(id(10));
  await dialog.getByLabel("Keterangan", { exact: true }).fill("Catatan baru");
  await geometry(page, "event modal 375");
  await a11y(page, "event modal");
  const before = posts.length;
  await dialog
    .getByRole("button", { name: "Simpan", exact: true })
    .evaluate((e) => {
      e.click();
      e.click();
    });
  await dialog.waitFor({ state: "hidden" });
  check(posts.length === before + 1, "double click creates one request");
  check(
    posts.at(-1).command.type === "event" &&
      posts.at(-1).command.code === "A01",
    "event payload preserves catalog code and date",
  );
  await page.getByRole("button", { name: "Ubah F01", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 568 });
  await geometry(page, "catalog modal 320x568");
  await page.setViewportSize({ width: 812, height: 375 });
  await geometry(page, "catalog landscape");
  await dialog
    .getByRole("button", { name: "Simpan", exact: true })
    .scrollIntoViewIfNeeded();
  check(
    await dialog
      .getByRole("button", { name: "Simpan", exact: true })
      .evaluate((e) => {
        const r = e.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight;
      }),
    "long catalog modal footer reachable",
  );
  await page.keyboard.press("Tab");
  check(
    await dialog.evaluate((e) => e.contains(document.activeElement)),
    "keyboard focus stays inside dialog",
  );
  await page.setViewportSize({ width: 375, height: 800 });

  check(
    (await dialog.getByLabel("Poin dasar", { exact: true }).inputValue()) ===
      "5",
    "catalog restores positive points",
  );
  check(
    !(await dialog.getByRole("checkbox", { name: "Kode aktif" }).isChecked()),
    "catalog restores inactive flag",
  );
  check(
    (await dialog
      .getByLabel("Kode", { exact: true })
      .getAttribute("readonly")) !== null,
    "catalog correction keeps original code",
  );
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  check(
    posts.at(-1).command.active === false,
    "saving inactive catalog does not activate it",
  );
  await page.getByRole("button", { name: "Ubah A01", exact: true }).click();
  check(
    (await dialog.getByLabel("Poin dasar", { exact: true }).inputValue()) ===
      "-2",
    "negative catalog points prefilled",
  );
  await dialog.getByLabel("Poin dasar", { exact: true }).fill("-101");
  const invalidBefore = posts.length;
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  check(posts.length === invalidBefore, "native point range blocks request");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Pengaturan poin", exact: true })
    .click();
  check(
    (await dialog
      .getByLabel("Ambang tingkat notifikasi", { exact: true })
      .inputValue()) === "3",
    "settings threshold prefilled",
  );
  check(
    (await dialog
      .getByRole("combobox", { name: /^Mapel nilai afektif/ })
      .inputValue()) === id(600),
    "settings subject prefilled",
  );
  await dialog
    .getByLabel("Ambang tingkat notifikasi", { exact: true })
    .fill("2");
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  check(
    posts.at(-1).command.subjectId === id(600) &&
      posts.at(-1).command.threshold === 2,
    "settings payload preserves subject",
  );
  await page
    .getByRole("button", { name: "Arsip dan nilai afektif", exact: true })
    .click();
  await dialog.getByLabel("Bulan sumber", { exact: true }).fill("2026-10");
  await dialog.getByRole("button", { name: "Jalankan tindakan" }).click();
  await dialog
    .getByText("Pilih bulan yang sudah berakhir untuk diarsipkan.", {
      exact: true,
    })
    .waitFor();
  check(true, "current month cannot be archived");
  await dialog.getByLabel("Bulan sumber", { exact: true }).fill("2026-09");
  await dialog.getByRole("button", { name: "Jalankan tindakan" }).click();
  await dialog.waitFor({ state: "hidden" });
  check(
    posts.at(-1).command.month === "2026-09-01" &&
      posts.at(-1).command.type === "reset",
    "archive sends exact first-of-month",
  );
  await page
    .getByRole("button", { name: "Arsip dan nilai afektif", exact: true })
    .click();
  await dialog
    .getByRole("combobox", { name: /^Tindakan/ })
    .selectOption("affective");
  await dialog.getByLabel("Bulan sumber", { exact: true }).fill("2026-09");
  await dialog.getByRole("button", { name: "Jalankan tindakan" }).click();
  await dialog.waitFor({ state: "hidden" });
  check(
    posts.at(-1).command.type === "affective",
    "affective uses existing dedicated action",
  );
  await page.getByRole("combobox", { name: /^Kelas/ }).selectOption(id(301));
  await page.getByRole("button", { name: "Tampilkan", exact: true }).click();
  await page.getByText("Data poin diperbarui.", { exact: true }).waitFor();
  check(
    (await page.locator("article").count()) === 1,
    "class filter narrows displayed rows",
  );
  await page
    .getByRole("button", { name: "Catat kejadian", exact: true })
    .click();
  check(
    (await dialog
      .getByRole("combobox", { name: /^Siswa/ })
      .locator("option")
      .count()) === 4,
    "class filter never narrows recording catalog",
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  check(
    await page
      .getByRole("button", { name: "Catat kejadian", exact: true })
      .evaluate((e) => e === document.activeElement),
    "Escape returns focus to trigger",
  );
  await page.getByLabel("Bulan laporan", { exact: true }).fill("2026-09");
  await page.getByRole("button", { name: "Tampilkan", exact: true }).click();
  await page.getByText("Data poin diperbarui.", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Catat kejadian", exact: true })
    .click();
  check(
    (await dialog
      .getByRole("combobox", { name: /^Siswa/ })
      .locator('option[value="' + id(99) + '"]')
      .count()) === 1,
    "month change refreshes recording students outside initial month",
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  readError = true;
  await page.getByRole("button", { name: "Tampilkan", exact: true }).click();
  await page.getByText(/Data belum dapat dimuat/).waitFor();
  check(
    (await page.locator("article").count()) === 1,
    "failed read retains previous snapshot",
  );
  readError = false;
  await visit("large");
  await page
    .getByRole("button", { name: "Siswa berikutnya", exact: true })
    .click();
  check(
    await page.getByText("Halaman 2 dari 8", { exact: true }).isVisible(),
    "student pagination works",
  );
  await page
    .getByLabel("Cari nama atau kelas", { exact: true })
    .fill("Tidak ditemukan");
  check(
    await page.getByText("Halaman 1 dari 1", { exact: true }).isVisible(),
    "search resets page",
  );
  check(
    await page.getByText(/Belum ada siswa sesuai/).isVisible(),
    "search empty state",
  );
  await visit();
  await page.locator("summary").first().click();
  await page
    .getByRole("button", { name: "Batalkan kejadian", exact: true })
    .first()
    .click();
  await dialog
    .getByLabel("Alasan pembatalan", { exact: true })
    .fill("Koreksi kejadian");
  await page.setViewportSize({ width: 768, height: 375 });
  await geometry(page, "cancel landscape");
  await dialog
    .getByRole("button", { name: "Konfirmasi pembatalan" })
    .scrollIntoViewIfNeeded();
  await dialog.getByRole("button", { name: "Konfirmasi pembatalan" }).click();
  await dialog.waitFor({ state: "hidden" });
  check(
    posts.at(-1).command.type === "cancel",
    "cancellation sends reason and immutable ID",
  );
  check(
    await page
      .locator("#discipline-filter")
      .evaluate((e) => e === document.activeElement),
    "mutation restores stable fallback focus",
  );
  await visit("inactive-subject");
  await page
    .getByRole("button", { name: "Pengaturan poin", exact: true })
    .click();
  check(
    (await dialog
      .getByRole("combobox", { name: /^Mapel nilai afektif/ })
      .inputValue()) === id(600),
    "inactive stored subject remains selected",
  );
  await dialog
    .getByLabel("Ambang tingkat notifikasi", { exact: true })
    .fill("4");
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  check(
    posts.at(-1).command.subjectId === id(600),
    "unrelated settings update never clears inactive subject",
  );
  await visit();
  outcome = "archived";
  await page
    .getByRole("button", { name: "Catat kejadian", exact: true })
    .click();
  await dialog.getByRole("combobox", { name: /^Siswa/ }).selectOption(id(10));
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await dialog
    .getByText("Bulan sudah diarsipkan. Riwayat dipertahankan.", {
      exact: true,
    })
    .waitFor();
  check(
    (await dialog.isVisible()) &&
      (await dialog
        .getByRole("button", { name: "Simpan", exact: true })
        .isEnabled()),
    "archived error retains draft",
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await visit();
  outcome = "slow";
  await page
    .getByRole("button", { name: "Catat kejadian", exact: true })
    .click();
  await dialog.getByRole("combobox", { name: /^Siswa/ }).selectOption(id(10));
  const count = posts.length;
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("[role=dialog] fieldset")?.disabled,
  );
  await page.keyboard.press("Escape");
  check(await dialog.isVisible(), "pending Escape cannot discard form");
  check(posts.length === count + 1, "pending command remains single");
  release();
  await dialog.waitFor({ state: "hidden" });
  await visit("normal", 320);
  await page.screenshot({ path: join(out, "points-mobile.png") });
  await visit("normal", 1440);
  await page.screenshot({ path: join(out, "points-desktop.png") });
  await visit();
  outcome = "uncertain";
  await page
    .getByRole("button", { name: "Catat kejadian", exact: true })
    .click();
  await dialog.getByRole("combobox", { name: /^Siswa/ }).selectOption(id(10));
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await dialog.getByText(/Hasil penyimpanan belum dapat dipastikan/).waitFor();
  check(await dialog.isVisible(), "uncertain write retains form");
  check(
    await dialog
      .getByRole("button", { name: "Simpan", exact: true })
      .isDisabled(),
    "uncertain write prevents blind retry",
  );
  await visit();
  await page
    .getByRole("button", { name: "Tambah kode poin", exact: true })
    .click();
  await dialog.getByLabel("Deskripsi", { exact: true }).fill("Draf katalog");
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.dismiss());
  await page.keyboard.press("Escape");
  check(
    await dialog.isVisible(),
    "dirty dismissal cancellation retains catalog draft",
  );
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.accept());
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await visit();
  outcome = "hang";
  await page
    .getByRole("button", { name: "Catat kejadian", exact: true })
    .click();
  await dialog.getByRole("combobox", { name: /^Siswa/ }).selectOption(id(10));
  await page.clock.install();
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await page.clock.fastForward(31000);
  await page.clock.resume();
  await dialog.getByText(/Hasil penyimpanan belum dapat dipastikan/).waitFor();
  check(
    await dialog
      .getByRole("button", { name: "Simpan", exact: true })
      .isDisabled(),
    "30 second timeout prevents blind retry",
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
