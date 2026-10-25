import {installConfirmDriver,settleConfirmation} from "./confirm-driver.mjs";
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
  process.env.GRADES_QA_OUTPUT ?? join(root, "docs/verification/grades");
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
  entryPoints: [join(root, "tests/ui/grades-fixture.tsx")],
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
          path: join(root, "tests/ui/grades-navigation-shim.ts"),
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
  await installConfirmDriver(page);
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => d.accept());
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const posts = [],
    reads = [];
  let outcome = "success",
    readFailure = false,
    contextFailure = false,
    contextStale = false,
    release;
  await page.route("**/api/learning/grades?*", async (route) => {
    const data = await page.evaluate(() => window.gradesFixture),
      req = route.request(),
      q = new URL(req.url()).searchParams;
    const scope = {
      ...(q.get("classId") ? { classId: q.get("classId") } : {}),
      ...(q.get("subjectId") ? { subjectId: q.get("subjectId") } : {}),
      ...(q.get("studentId") ? { studentId: q.get("studentId") } : {}),
      semester: Number(q.get("semester") ?? 1),
    };
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
      if (outcome === "stale")
        return route.fulfill({
          status: 409,
          json: {
            code: "stale",
            message: "Data berubah. Muat ulang sebelum menyimpan.",
          },
        });
      data.revision = route.request().postDataJSON().revision + 1;
      if (body.command.type === "void")
        data.rows = data.rows.filter((r) => r.id !== body.command.id);
      if (body.command.type === "kkm") data.extra.kkm = body.command.value;
      await page.evaluate((d) => (window.gradesFixture = d), data);
    } else {
      reads.push(req.url());
      if (readFailure || (contextFailure && scope.classId === id(31)))
        return route.fulfill({ status: 503, json: { message: "Unavailable" } });
      if (contextStale && scope.classId === id(31)) data.revision++;
    }
    data.semester = scope.semester;
    data.rows = data.rows.filter(
      (r) =>
        r.semester === scope.semester &&
        (!scope.classId || r.class_id === scope.classId) &&
        (!scope.subjectId || r.subject_id === scope.subjectId),
    );
    data.extra.entryPeople = data.people.filter(
      (p) => !scope.classId || p.class_id === scope.classId,
    );
    data.people = data.extra.entryPeople.filter(
      (p) => !scope.studentId || p.id === scope.studentId,
    );
    data.extra.scope = scope;
    return route.fulfill({
      json: {
        code: "saved",
        result: { code: "saved" },
        message: "Perubahan berhasil disimpan.",
        data,
      },
    });
  });
  const visit = async (mode = "normal", width = 375) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(base + "/?mode=" + mode);
    await page.locator("#main-content").waitFor();
  };
  const dialog = page.getByRole("dialog");
  const filter = async (cls = id(30), sub = id(60), student = "") => {
    await page
      .getByRole("combobox", { name: /^Kelas \/ tahun ajaran/ })
      .selectOption(cls);
    await page
      .getByRole("combobox", { name: /^Mata pelajaran/ })
      .selectOption(sub);
    await page
      .getByRole("combobox", { name: /^Siswa dalam laporan/ })
      .selectOption(student);
    await page.getByRole("button", { name: "Tampilkan", exact: true }).click(); await settleConfirmation(page);
    await page
      .getByText("Data penilaian diperbarui.", { exact: true })
      .waitFor();
  };
  for (const width of [320, 375, 390, 768, 1440]) {
    await visit("normal", width);
    await geometry(page, "normal " + width);
    if (width === 320 || width === 1440) await a11y(page, "normal " + width);
  }
  for (const mode of ["empty", "large", "readonly", "loading", "error"]) {
    await visit(mode, 320);
    await geometry(page, mode + " 320");
    if (["empty", "large", "readonly"].includes(mode)) await a11y(page, mode);
    if (mode === "readonly")
      check(
        (await page.getByRole("button", { name: /^Koreksi/ }).count()) === 0,
        "reader has no correction actions",
      );
  }
  await visit("normal", 320);
  await page.locator(".grades-panel details:not(.academic-context-bar) > summary").first().click(); await settleConfirmation(page);
  await geometry(page, "expanded scores 320");
  await a11y(page, "expanded scores");
  check(
    (await page.getByRole("cell", { name: "0", exact: true }).count()) === 1,
    "zero grade remains visible",
  );
  check(
    (await page
      .getByRole("cell", { name: "Belum diisi", exact: true })
      .count()) === 1,
    "null grade is distinct from zero",
  );
  await filter();
  check(
    await page
      .getByRole("heading", { name: "KKM periode dipilih: 0", exact: true })
      .isVisible(),
    "zero KKM does not fall back to 75",
  );
  await page.getByRole("button", { name: "Input nilai", exact: true }).click(); await settleConfirmation(page);
  await dialog
    .getByRole("button", { name: "Simpan nilai", exact: true })
    .waitFor();
  await dialog.getByLabel("Nilai Siswa 1", { exact: true }).fill("0");
  await dialog.getByLabel("Catatan Siswa 1", { exact: true }).fill("Nol sah");
  await geometry(page, "batch modal 320");
  await a11y(page, "batch modal");
  const before = posts.length;
  await dialog
    .getByRole("button", { name: "Simpan nilai", exact: true })
    .evaluate((e) => {
      e.click();
      e.click();
    });
  await dialog.waitFor({ state: "hidden" });
  check(posts.length === before + 1, "double submission produces one write");
  check(
    posts.at(-1).command.items[0].value === 0 &&
      posts.at(-1).command.items[1].value === null,
    "batch keeps zero and blank as distinct values",
  );
  await page.getByRole("button", { name: "Input nilai", exact: true }).click(); await settleConfirmation(page);
  await dialog
    .getByRole("combobox", { name: /^Jenis penilaian/ })
    .selectOption("ATS");
  await dialog
    .getByRole("button", { name: "Simpan koreksi", exact: true })
    .waitFor();
  check(
    (await dialog.getByLabel("Nilai Siswa 1", { exact: true }).inputValue()) ===
      "70",
    "existing nonPH upsert preloads stored values",
  );
  check(
    (await dialog
      .getByLabel("Alasan koreksi", { exact: true })
      .getAttribute("required")) !== null,
    "implicit nonPH correction requires reason",
  );
  await dialog
    .getByLabel("Alasan koreksi", { exact: true })
    .fill("Perbaikan nilai ATS");
  await dialog
    .getByRole("button", { name: "Simpan koreksi", exact: true })
    .click(); await settleConfirmation(page);
  await dialog.waitFor({ state: "hidden" });
  check(
    posts.at(-1).command.id === id(401) &&
      posts.at(-1).command.reason === "Perbaikan nilai ATS",
    "nonPH correction submits existing ID and reason",
  );
  await page.getByRole("button", { name: "Input nilai", exact: true }).click(); await settleConfirmation(page);
  await dialog
    .getByLabel("Cari siswa dalam formulir", { exact: true })
    .fill("Siswa 1");
  const searchPosts = posts.length;
  await dialog
    .getByLabel("Cari siswa dalam formulir", { exact: true })
    .press("Enter");
  check(
    posts.length === searchPosts && (await dialog.isVisible()),
    "Enter in form search never submits grades",
  );
  let searchConfirmations = 0;
  const searchListener = (d) => {
    searchConfirmations++;
    d.accept();
  };
  page.removeAllListeners("dialog");
  page.on("dialog", searchListener);
  await page.keyboard.press("Escape"); await settleConfirmation(page);
  await dialog.waitFor({ state: "hidden" });
  check(
    searchConfirmations === 0,
    "view-only search does not mark grade draft dirty",
  );
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Atur KKM", exact: true }).click(); await settleConfirmation(page);
  check(
    (await dialog.getByLabel("KKM (0–100)", { exact: true }).inputValue()) ===
      "0",
    "KKM modal restores actual zero",
  );
  await dialog.getByLabel("KKM (0–100)", { exact: true }).fill("101");
  const invalidBefore = posts.length;
  await dialog.getByRole("button", { name: "Simpan KKM" }).click(); await settleConfirmation(page);
  check(posts.length === invalidBefore, "invalid KKM blocked before network");
  await dialog.getByLabel("KKM (0–100)", { exact: true }).fill("100");
  await page.setViewportSize({ width: 812, height: 375 });
  await geometry(page, "KKM landscape");
  await dialog
    .getByRole("button", { name: "Simpan KKM" })
    .scrollIntoViewIfNeeded();
  check(
    await dialog
      .getByRole("button", { name: "Simpan KKM" })
      .evaluate((e) => e.getBoundingClientRect().bottom <= innerHeight),
    "KKM modal submit reachable",
  );
  await dialog.getByRole("button", { name: "Simpan KKM" }).click(); await settleConfirmation(page);
  await dialog.waitFor({ state: "hidden" });
  check(
    posts.at(-1).command.value === 100,
    "KKM 100 saved without changing old score snapshots",
  );
  check(
    (await page.getByText("KKM saat dinilai: 75", { exact: false }).count()) >
      0,
    "old assessment KKM stays visible after KKM update",
  );
  await visit();
  await page.getByRole("button", { name: "Koreksi PH 4", exact: true }).click(); await settleConfirmation(page);
  await dialog.getByLabel("Nilai Siswa historis", { exact: true }).waitFor();
  check(
    (await dialog
      .getByLabel("Tanggal penilaian / periode KKM", { exact: true })
      .inputValue()) === "2025-10-23",
    "correction uses original academic-year date",
  );
  check(
    await dialog
      .getByRole("combobox", { name: /^Jenis penilaian/ })
      .isDisabled(),
    "explicit correction cannot change assessment kind",
  );
  check(
    (await dialog
      .getByLabel("Nilai Siswa di luar katalog", { exact: true })
      .inputValue()) === "0",
    "original score missing from catalog retained",
  );
  await dialog
    .getByLabel("Alasan koreksi", { exact: true })
    .fill("Koreksi historis");
  await dialog.getByRole("button", { name: "Simpan koreksi" }).click(); await settleConfirmation(page);
  await dialog.waitFor({ state: "hidden" });
  check(
    posts.at(-1).command.classId === id(31) &&
      posts.at(-1).command.subjectId === id(61) &&
      posts
        .at(-1)
        .command.items.some((i) => i.studentId === id(99) && i.value === 0),
    "correction binds original class/subject and preserves hidden scores",
  );
  await visit();
  await page.getByRole("combobox", { name: /^Semester/ }).selectOption("2");
  await filter();
  await page.getByRole("button", { name: "Input nilai", exact: true }).click(); await settleConfirmation(page);
  const semesterDate = dialog.getByLabel("Tanggal penilaian / periode KKM", {
    exact: true,
  });
  check(
    (await semesterDate.inputValue()) === "2027-01-01" &&
      (await semesterDate.getAttribute("min")) === "2027-01-01" &&
      (await semesterDate.getAttribute("max")) === "2027-06-30",
    "Genap uses second academic-year January to June",
  );
  await semesterDate.fill("2026-12-31");
  const dateBefore = posts.length;
  await dialog.getByRole("button", { name: "Simpan nilai" }).click(); await settleConfirmation(page);
  check(
    posts.length === dateBefore,
    "outside-semester date rejected before network",
  );
  await page.keyboard.press("Escape"); await settleConfirmation(page);
  await dialog.waitFor({ state: "hidden" });
  await visit();
  contextFailure = true;
  await page.getByRole("button", { name: "Koreksi PH 4", exact: true }).click(); await settleConfirmation(page);
  await dialog.getByText(/Konteks penilaian belum dapat dimuat/).waitFor();
  check(
    await dialog.getByRole("button", { name: "Simpan nilai" }).isDisabled(),
    "context outage never opens an editable blank correction",
  );
  contextFailure = false;
  await dialog.getByRole("button", { name: "Muat ulang konteks" }).click(); await settleConfirmation(page);
  await dialog.getByLabel("Nilai Siswa historis", { exact: true }).waitFor();
  await page.keyboard.press("Escape"); await settleConfirmation(page);
  await dialog.waitFor({ state: "hidden" });
  await visit();
  contextStale = true;
  await page.getByRole("button", { name: "Koreksi PH 4", exact: true }).click(); await settleConfirmation(page);
  await dialog.getByText(/Konteks penilaian belum dapat dimuat/).waitFor();
  check(
    await dialog.getByRole("button", { name: "Simpan nilai" }).isDisabled(),
    "context revision conflict blocks editing",
  );
  contextStale = false;
  await page.keyboard.press("Escape"); await settleConfirmation(page);
  await dialog.waitFor({ state: "hidden" });
  await filter(id(30), id(60), id(10));
  await page.getByRole("button", { name: "Input nilai", exact: true }).click(); await settleConfirmation(page);
  check(
    (await dialog.getByLabel("Nilai Siswa 2", { exact: true }).count()) === 1,
    "student report filter never truncates batch roster",
  );
  await page.keyboard.press("Escape"); await settleConfirmation(page);
  await dialog.waitFor({ state: "hidden" });
  check(
    await page
      .getByRole("button", { name: "Input nilai", exact: true })
      .evaluate((e) => e === document.activeElement),
    "Escape returns focus to trigger",
  );
  await page
    .getByLabel("Cari mapel atau nama siswa", { exact: true })
    .fill("Siswa 2");
  check(
    (await page.locator("article").count()) === 0,
    "history search respects selected student scope",
  );
  await page.getByLabel("Cari mapel atau nama siswa", { exact: true }).fill("");
  readFailure = true;
  await page.getByRole("button", { name: "Tampilkan", exact: true }).click(); await settleConfirmation(page);
  await page.getByText(/Data belum dapat dimuat/).waitFor();
  check(
    (await page.locator("article").count()) === 3,
    "failed read retains prior history",
  );
  readFailure = false;
  await visit("large");
  await filter();
  await page.getByRole("button", { name: "Input nilai", exact: true }).click(); await settleConfirmation(page);
  await dialog.getByLabel("Nilai Siswa 1", { exact: true }).fill("25.5");
  await dialog
    .getByRole("button", { name: "Siswa berikutnya", exact: true })
    .click(); await settleConfirmation(page);
  check(
    await dialog
      .getByText("Halaman siswa 2 dari 3", { exact: true })
      .isVisible(),
    "entry pagination works",
  );
  await dialog.getByLabel("Nilai Siswa 21", { exact: true }).fill("25.555");
  await dialog
    .getByLabel("Cari siswa dalam formulir", { exact: true })
    .fill("Siswa 1");
  await dialog.getByLabel("Nilai Siswa 1", { exact: true }).waitFor();
  check(
    (await dialog.getByLabel("Nilai Siswa 1", { exact: true }).inputValue()) ===
      "25.5",
    "paging/search preserves input draft",
  );
  await page.setViewportSize({ width: 768, height: 375 });
  await geometry(page, "large batch landscape");
  await dialog
    .getByRole("button", { name: "Simpan nilai" })
    .scrollIntoViewIfNeeded();
  const hiddenInvalidBefore = posts.length;
  await dialog.getByRole("button", { name: "Simpan nilai" }).click(); await settleConfirmation(page);
  await dialog.getByText(/Gunakan nilai 0–100/).waitFor();
  check(
    posts.length === hiddenInvalidBefore,
    "hidden-page invalid decimal rejected before network",
  );
  await dialog
    .getByLabel("Cari siswa dalam formulir", { exact: true })
    .fill("Siswa 21");
  await dialog.getByLabel("Nilai Siswa 21", { exact: true }).fill("25.55");
  await dialog.getByRole("button", { name: "Simpan nilai" }).click(); await settleConfirmation(page);
  await dialog.waitFor({ state: "hidden" });
  check(
    posts.at(-1).command.items.length === 60 &&
      posts.at(-1).command.items[0].value === 25.5,
    "hidden pages all submit without loss",
  );
  await page.getByRole("button", { name: "Penilaian berikutnya" }).click(); await settleConfirmation(page);
  check(
    await page.getByText("Halaman 2 dari 3", { exact: true }).isVisible(),
    "history pagination works",
  );
  await visit();
  await page
    .getByRole("button", { name: "Batalkan penilaian", exact: true })
    .first()
    .click(); await settleConfirmation(page);
  await dialog
    .getByLabel("Alasan pembatalan", { exact: true })
    .fill("Penilaian dibatalkan");
  await dialog.getByRole("button", { name: "Konfirmasi pembatalan" }).click(); await settleConfirmation(page);
  await dialog.waitFor({ state: "hidden" });
  check(
    posts.at(-1).command.type === "void" && posts.at(-1).command.id === id(400),
    "void requires only original ID and reason",
  );
  check(
    await page
      .locator("#grades-filter")
      .evaluate((e) => e === document.activeElement),
    "removed assessment restores stable focus",
  );
  await visit("normal", 320);
  await page.screenshot({ path: join(out, "grades-mobile.png") });
  await visit("normal", 1440);
  await page.screenshot({ path: join(out, "grades-desktop.png") });
  await visit();
  await filter();
  await page.getByRole("button", { name: "Input nilai", exact: true }).click(); await settleConfirmation(page);
  await dialog.getByLabel("Nilai Siswa 1", { exact: true }).fill("50");
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.dismiss());
  await page.keyboard.press("Escape"); await settleConfirmation(page);
  check(await dialog.isVisible(), "dirty close cancellation preserves form");
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.accept());
  await page.keyboard.press("Escape"); await settleConfirmation(page);
  await dialog.waitFor({ state: "hidden" });
  outcome = "slow";
  await page.getByRole("button", { name: "Input nilai", exact: true }).click(); await settleConfirmation(page);
  await dialog.getByRole("button", { name: "Simpan nilai" }).click(); await settleConfirmation(page);
  await page.waitForFunction(
    () => document.querySelector("[role=dialog] fieldset")?.disabled,
  );
  await page.keyboard.press("Escape"); await settleConfirmation(page);
  check(await dialog.isVisible(), "pending Escape cannot discard batch");
  release();
  await dialog.waitFor({ state: "hidden" });
  await visit();
  await filter();
  outcome = "uncertain";
  await page.getByRole("button", { name: "Input nilai", exact: true }).click(); await settleConfirmation(page);
  await dialog.getByRole("button", { name: "Simpan nilai" }).click(); await settleConfirmation(page);
  await dialog.getByText(/Hasil penyimpanan belum dapat dipastikan/).waitFor();
  check(await dialog.isVisible(), "uncertain write retains draft");
  check(
    await dialog.getByRole("button", { name: "Simpan nilai" }).isDisabled(),
    "uncertain write prevents blind retry",
  );
  await visit();
  await filter();
  outcome = "hang";
  await page.getByRole("button", { name: "Input nilai", exact: true }).click(); await settleConfirmation(page);
  await page.clock.install();
  await dialog.getByRole("button", { name: "Simpan nilai" }).click(); await settleConfirmation(page);
  await page.clock.fastForward(31000);
  await page.clock.resume();
  await dialog.getByText(/Hasil penyimpanan belum dapat dipastikan/).waitFor();
  check(
    await dialog.getByRole("button", { name: "Simpan nilai" }).isDisabled(),
    "30 second timeout blocks retry",
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
