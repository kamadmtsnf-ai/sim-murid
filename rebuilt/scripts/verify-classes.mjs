/** Isolated Classes browser regression suite. No real account, API mutation or production data. */
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
  process.env.CLASSES_QA_OUTPUT ?? join(root, "docs/verification/classes");
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
  entryPoints: [join(root, "tests/ui/classes-fixture.tsx")],
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
          path: join(root, "tests/ui/classes-navigation-shim.ts"),
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kelas QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
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
  for (const link of await page.locator("main a,main button").all()) {
    const b = await link.boundingBox();
    if (b)
      check(
        b.x >= -1 && b.x + b.width <= size.viewport + 1,
        name + " action fits",
        b,
      );
  }
  await page.locator("footer").scrollIntoViewIfNeeded();
  const b = await page.locator("footer").boundingBox();
  check(
    b &&
      b.y >= -1 &&
      b.y + b.height <= (await page.evaluate(() => innerHeight)) + 1,
    name + " footer reachable",
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
  const context = await browser.newContext({ reducedMotion: "reduce" }),
    page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  let writes = [],
    mode = "saved",
    release;
  page.on("dialog", (d) => d.accept());
  await page.route("**/api/classes", async (route) => {
    const body = route.request().postDataJSON();
    writes.push(body);
    if (mode === "hold") await new Promise((r) => (release = r));
    if (mode === "offline") {
      await route.abort("failed");
      return;
    }
    if (mode === "invalid") {
      await route.fulfill({
        status: 200,
        json: { message: "saved", classes: { revision: -1 } },
      });
      return;
    }
    if (mode === "duplicate" || mode === "stale") {
      await route.fulfill({
        status: 409,
        json: {
          code: mode,
          message:
            mode === "stale"
              ? "Data berubah. Muat ulang sebelum menyimpan."
              : "Data duplikat. Periksa isian.",
        },
      });
      return;
    }
    const data = await page.evaluate(() => window.classesFixture);
    data.revision += 1;
    if (body.command.type === "year")
      data.years.unshift({
        id: "00000000-0000-4000-8000-000000000012",
        start_year:
          body.command.startYear ??
          Number(body.command.academicYear.slice(0, 4)),
        is_active: false,
      });
    await route.fulfill({
      status: 200,
      json: { code: "saved", message: "Data berhasil disimpan.", classes: data },
    });
  });
  async function visit(s = "normal", width = 375, height = 812) {
    mode = "saved";
    writes = [];
    await page.setViewportSize({ width, height });
    await page.goto(base + "/?scenario=" + s);
    await page.locator("main h1").waitFor();
  }
  async function openEdit() {
    await page
      .getByRole("button", { name: "Edit", exact: true })
      .first()
      .click();
    await page.getByRole("dialog").waitFor();
  }
  async function fillClass() {
    await page
      .getByRole("button", { name: "Tambah kelas", exact: true })
      .click();
    await page.getByLabel("Nama kelas").fill("7 Uji");
  }
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await visit("normal", width);
    await geometry(page, "normal " + width);
    await a11y(page, "normal " + width);
    if (width === 320 || width === 1440)
      await page.screenshot({
        path: join(out, "classes-" + width + ".png"),
        fullPage: true,
      });
  }
  for (const s of ["long", "many", "empty", "readonly", "loading", "error"]) {
    await visit(s, 320);
    await geometry(page, s);
    await a11y(page, s);
    if (s === "readonly")
      check(
        (await page
          .getByRole("button", { name: "Tambah kelas", exact: true })
          .count()) === 0,
        "read-only no management",
      );
    if (s === "error") {
      await page.getByRole("button", { name: "Coba kembali" }).click();
      check(
        await page.evaluate(() => window.classesRetried),
        "error retry callback",
      );
      check(
        !(await page.locator("main").innerText()).includes(
          "private diagnostic",
        ),
        "safe error content",
      );
    }
  }
  for (const zoom of [200, 400]) {
    await visit("long", 320);
    await page.addStyleTag({ content: `html{font-size:${zoom}%}` });
    await geometry(page, "text " + zoom);
    await openEdit();
    await geometryDialog("text " + zoom);
  }
  async function geometryDialog(name) {
    const dialog = page.getByRole("dialog");
    const r = await dialog.evaluate((e) => ({
      x: e.getBoundingClientRect().x,
      right: e.getBoundingClientRect().right,
      y: e.getBoundingClientRect().y,
      bottom: e.getBoundingClientRect().bottom,
      width: innerWidth,
      height: innerHeight,
      scroll: e.scrollHeight,
      client: e.clientHeight,
    }));
    check(
      r.x >= -1 &&
        r.right <= r.width + 1 &&
        r.y >= -1 &&
        r.bottom <= r.height + 1,
      name + " dialog fits",
      r,
    );
    check(
      await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      name + " dialog no horizontal overflow",
    );
    await dialog
      .getByRole("button", { name: "Batal", exact: true })
      .scrollIntoViewIfNeeded();
    check(
      await dialog
        .getByRole("button", { name: "Batal", exact: true })
        .isVisible(),
      name + " footer usable",
    );
  }
  for (const [w, h] of [
    [320, 640],
    [768, 1024],
    [1440, 900],
    [812, 240],
  ]) {
    await visit("normal", w, h);
    await fillClass();
    await geometryDialog(`${w}x${h}`);
    await a11y(page, `dialog ${w}x${h}`);
    await page.keyboard.press("Tab");
    check(
      await page
        .getByRole("dialog")
        .evaluate((e) => e.contains(document.activeElement)),
      "modal keyboard focus trapped",
    );
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    check(
      await page
        .getByRole("button", { name: "Tambah kelas", exact: true })
        .evaluate((e) => e === document.activeElement),
      "focus restored after Escape",
    );
  }
  await visit();
  await openEdit();
  check(
    (await page.getByLabel("Wali kelas").inputValue()).endsWith("91"),
    "unavailable teacher preserved",
  );
  await page.getByLabel("Nama kelas").fill("7 Renamed");
  await page.getByRole("button", { name: "Simpan kelas" }).click();
  await page.getByRole("alert").waitFor();
  check(writes.length === 0, "unavailable teacher never silently cleared");
  check(
    (await page.getByRole("dialog").getByRole("alert").count()) === 1,
    "modal feedback stays accessible",
  );
  await page.getByLabel("Wali kelas").selectOption("");
  await page.getByRole("button", { name: "Simpan kelas" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  check(writes[0].command.teacherId === null, "explicit teacher removal kept");
  await visit();
  await page
    .getByLabel("Tahun ajaran (misalnya 2026/2027)", { exact: true })
    .fill("2027/2028");
  await page
    .getByRole("button", { name: "Tambah tahun ajaran", exact: true })
    .click();
  await page.getByText("Data berhasil disimpan.", { exact: true }).waitFor();
  check(
    (
      await page
        .getByRole("combobox", { name: "Tahun ajaran", exact: true })
        .inputValue()
    ).endsWith("12"),
    "new year selected without activating",
  );
  check(
    writes.length === 1 && writes[0].command.type === "year",
    "year creation single command",
  );
  await visit();
  await page
    .getByRole("button", { name: "Daftar siswa", exact: true })
    .first()
    .click();
  check(
    await page
      .getByRole("heading", { name: "Siswa kelas 7 A", exact: true })
      .evaluate((e) => e === document.activeElement),
    "roster focuses heading",
  );
  await page.getByLabel("Tanggal mulai penempatan").fill("2026-10-22");
  await page.getByLabel("Siswa 102 (00-102)", { exact: true }).check();
  await page.getByLabel("Cari siswa").fill("103");
  check(
    (await page
      .getByText("1 siswa dipilih · maksimum 500", { exact: true })
      .count()) === 1,
    "search preserves selected IDs",
  );
  await page.setViewportSize({ width: 812, height: 375 });
  await page.setViewportSize({ width: 320, height: 640 });
  check(
    (await page.getByLabel("Tanggal mulai penempatan").inputValue()) ===
      "2026-10-22",
    "resize keeps date",
  );
  await page.getByLabel("Cari siswa").fill("");
  check(
    await page.getByLabel("Siswa 102 (00-102)", { exact: true }).isChecked(),
    "resize keeps student selection",
  );
  mode = "hold";
  await page.getByRole("button", { name: "Tempatkan siswa terpilih" }).click();
  await page.waitForFunction(() =>
    document.querySelector('[aria-busy="true"]'),
  );
  check(
    await page
      .getByRole("button", { name: "Tempatkan siswa terpilih" })
      .isDisabled(),
    "pending write disabled",
  );
  check(writes.length === 1, "one pending enrollment request");
  release();
  await page.getByText("Data berhasil disimpan.", { exact: true }).waitFor();
  check(
    (await page.getByLabel("Tanggal mulai penempatan").inputValue()) === "",
    "confirmed save clears placement draft",
  );
  check(
    writes[0].command.studentIds.length === 1 &&
      writes[0].command.studentIds[0].endsWith("102"),
    "hidden selection sent exactly once",
  );
  await visit();
  await fillClass();
  mode = "duplicate";
  await page.getByRole("button", { name: "Simpan kelas" }).click();
  await page.getByRole("alert").waitFor();
  check(
    (await page.getByLabel("Nama kelas").inputValue()) === "7 Uji",
    "known error preserves draft",
  );
  check(
    await page.getByRole("button", { name: "Simpan kelas" }).isEnabled(),
    "duplicate remains editable",
  );
  await a11y(page, "duplicate modal");
  for (const failure of ["stale", "offline", "invalid"]) {
    await visit();
    await fillClass();
    mode = failure;
    await page.getByRole("button", { name: "Simpan kelas" }).click();
    await page.getByRole("alert").waitFor();
    check(
      await page.getByRole("button", { name: "Simpan kelas" }).isDisabled(),
      failure + " write locked",
    );
    check(writes.length === 1, failure + " no automatic replay");
    check(
      await page
        .getByRole("button", { name: "Muat ulang data", exact: true })
        .isEnabled(),
      failure + " reload available",
    );
    await page.getByRole("button", { name: "Batal", exact: true }).click();
    check(
      await page
        .getByRole("button", { name: "Tambah kelas", exact: true })
        .isDisabled(),
      failure + " lock survives modal close",
    );
  }
  await visit();
  await visit("probe");
  mode = "hold";
  await page.getByRole("button", { name: "Simpan probe" }).click();
  await page.waitForTimeout(50);
  await page.getByRole("button", { name: "Tutup panel uji" }).click();
  mode = "saved";
  release();
  await page.waitForTimeout(100);
  check(
    !(await page.evaluate(() => window.classesSaved)),
    "late response after unmount cannot call onSaved",
  );
  await visit("legacy");
  await page.getByRole("button", { name: "Simpan probe" }).click();
  await page.waitForFunction(() => window.classesSaved === true);
  check(
    await page.getByRole("button", { name: "Simpan probe" }).isEnabled(),
    "shared hook remains compatible with single-argument callbacks",
  );
  await visit();
  await page.clock.install();
  mode = "hold";
  await page
    .getByLabel("Tahun ajaran (misalnya 2026/2027)", { exact: true })
    .fill("2027/2028");
  await page
    .getByRole("button", { name: "Tambah tahun ajaran", exact: true })
    .click();
  await page.clock.fastForward(31000);
  await page.getByRole("alert").waitFor();
  check(
    await page
      .getByRole("button", { name: "Tambah tahun ajaran", exact: true })
      .isDisabled(),
    "timeout blocks blind retry",
  );
  mode = "saved";
  release();
  await page.clock.resume();
  check(errors.length === 0, "no uncaught JavaScript errors", errors);
  const report = {
    status: "passed",
    checks,
    axe: axeResults,
    issues,
    limits: [
      "Synthetic class data and intercepted write responses. Actual API/database permission checks run in separate suites.",
      "No production student/account mutations or real role-browser UAT. Normal page/list scrolling is intentional.",
    ],
  };
  await writeFile(
    join(out, "browser-results.json"),
    JSON.stringify(report, null, 2) + "\n",
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
      { error: String(error), checks, issues, errors, axe: axeResults },
      null,
      2,
    ),
  );
  throw error;
} finally {
  if (browser) await browser.close();
  server.close();
}
