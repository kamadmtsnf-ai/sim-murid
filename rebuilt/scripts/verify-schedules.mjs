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
  process.env.SCHEDULES_QA_OUTPUT ?? join(root, "docs/verification/schedules");
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
  entryPoints: [join(root, "tests/ui/schedules-fixture.tsx")],
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
          path: join(root, "tests/ui/schedules-navigation-shim.ts"),
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
  let requests = [],
    reply = "success";
  page.on("dialog", (d) => d.accept());
  await page.route("**/api/schedules?*", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (reply === "network") return route.abort();
    if (reply === "slow") await new Promise((r) => setTimeout(r, 500));
    if (reply === "overlap")
      return route.fulfill({
        status: 409,
        json: {
          code: "overlap",
          message: "Waktu bertabrakan dengan jadwal kelas atau guru.",
        },
      });
    if (reply === "stale")
      return route.fulfill({
        status: 409,
        json: {
          code: "stale",
          message: "Data berubah. Muat ulang sebelum menyimpan.",
        },
      });
    if (reply === "malformed")
      return route.fulfill({
        status: 200,
        json: { schedules: { revision: -1 } },
      });
    const data = await page.evaluate(() => window.schedulesFixture);
    data.revision++;
    await route.fulfill({
      status: 200,
      json: { schedules: data, message: "Data berhasil disimpan." },
    });
  });
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  async function visit(mode = "normal", width = 375, height = 812) {
    reply = "success";
    requests = [];
    await page.setViewportSize({ width, height });
    await page.goto(base + "/?mode=" + mode);
    await page.getByRole("heading", { level: 1 }).waitFor();
  }
  async function lesson() {
    await page.locator("select[name=classId]").selectOption(id(20));
    await page.locator("select[name=subjectId]").selectOption(id(50));
    await page.locator("select[name=teacherId]").selectOption(id(30));
  }
  for (const mode of [
    "normal",
    "empty",
    "large",
    "readonly",
    "loading",
    "error",
  ])
    for (const width of [320, 375, 768, 1440]) {
      await visit(mode, width);
      await geometry(page, mode + " " + width);
      if (width === 320) await a11y(page, mode);
    }
  await visit();
  await page
    .getByRole("combobox", { name: "Kelas untuk piket", exact: true })
    .selectOption(id(20));
  check(
    (await page.locator("input[name=assignment]:checked").count()) === 2,
    "full-week roster survives day filter",
  );
  check(
    (await page.getByText(/penugasan lama untuk siswa nonaktif/).count()) === 1,
    "inactive roster cleanup is explicit",
  );
  await a11y(page, "duty editor");
  await geometry(page, "duty editor");
  await page
    .getByRole("button", { name: "Simpan seluruh piket kelas", exact: true })
    .click();
  await page.getByText("Data berhasil disimpan.", { exact: true }).waitFor();
  check(
    requests.length === 1 &&
      requests[0].command.items.some((x) => x.weekday === 7),
    "full-week duty save includes Sunday",
  );
  check(
    requests[0].command.items.every((x) => x.studentId !== id(102)),
    "inactive student cannot be assigned",
  );
  await visit();
  await lesson();
  await page.getByLabel("Istirahat (menit)", { exact: true }).fill("15");
  check(
    (await page.getByText("08:35", { exact: true }).count()) === 1,
    "computed end includes break",
  );
  await page.getByLabel("Waktu mulai", { exact: true }).fill("23:50");
  check(
    await page
      .getByRole("button", { name: "Simpan pelajaran", exact: true })
      .isDisabled(),
    "cross-midnight prevented",
  );
  await page.getByLabel("Waktu mulai", { exact: true }).fill("07:00");
  reply = "slow";
  await page
    .getByRole("button", { name: "Simpan pelajaran", exact: true })
    .click();
  check(
    await page
      .getByRole("button", { name: "Simpan pelajaran", exact: true })
      .isDisabled(),
    "pending disables resubmit",
  );
  await page.getByText("Data berhasil disimpan.", { exact: true }).waitFor();
  check(
    requests.length === 1 && requests[0].command.breakMinutes === 15,
    "lesson submits once with rest preserved",
  );
  await visit();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  check(
    await page
      .locator("select[name=classId]")
      .evaluate((e) => e === document.activeElement),
    "edit focuses first field",
  );
  check(
    (await page
      .getByLabel("Istirahat (menit)", { exact: true })
      .inputValue()) === "15",
    "edit retains break",
  );
  await page.getByLabel("Jumlah JTM", { exact: true }).fill("3");
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Batal edit" }).click();
  check(
    (await page
      .getByRole("heading", { name: "Edit pelajaran", exact: true })
      .count()) === 1,
    "cancel dirty discard retains edit",
  );
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Batal edit" }).click();
  check(
    (await page
      .getByRole("heading", { name: "Tambah pelajaran", exact: true })
      .count()) === 1,
    "accepted discard returns to create",
  );
  await visit();
  await page
    .getByRole("combobox", { name: "Tahun ajaran", exact: true })
    .selectOption(id(11));
  check(
    await page
      .locator("select[name=class] option")
      .allTextContents()
      .then(
        (a) =>
          a.some((x) => x.includes("VII Lama")) &&
          !a.some((x) => x.includes("VII A")),
      ),
    "class choices follow selected year",
  );
  await visit();
  await page
    .getByRole("checkbox", { name: "Pilih IPA VII A Senin", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Hapus 1 jadwal terpilih", exact: true })
    .click();
  await page.getByText("Data berhasil disimpan.", { exact: true }).waitFor();
  check(
    requests[0].command.lessonIds.length === 1 &&
      requests[0].command.dutyIds.length === 0,
    "selective deletion keeps untouched duty IDs",
  );
  check(
    (await page
      .getByRole("checkbox", { name: "Pilih IPA VII A Senin", exact: true })
      .isChecked()) === false,
    "selection clears after confirmed save",
  );
  for (const failure of ["overlap", "stale", "network", "malformed"]) {
    await visit();
    await lesson();
    reply = failure;
    await page
      .getByRole("button", { name: "Simpan pelajaran", exact: true })
      .click();
    await page.getByRole("alert").waitFor();
    check(
      (await page
        .getByRole("button", { name: "Simpan pelajaran", exact: true })
        .isDisabled()) ===
        (failure !== "overlap"),
      failure + " correct retry lock",
    );
    check(
      await page
        .getByRole("alert")
        .evaluate((e) => e === document.activeElement),
      failure + " feedback focused",
    );
    check(
      await page
        .getByRole("button", { name: "Muat ulang", exact: true })
        .isEnabled(),
      failure + " reload reachable",
    );
    check(requests.length === 1, failure + " no automatic retry");
  }
  await visit("unavailable");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  check(
    (await page.locator("select[name=subjectId]").inputValue()) === "" &&
      (await page.locator("select[name=teacherId]").inputValue()) === "",
    "unavailable references require active selection",
  );
  check(
    await page
      .locator("select[name=teacherId]")
      .evaluate((e) => !e.checkValidity()),
    "missing active teacher blocks native validation",
  );
  await visit("large", 320, 568);
  await page
    .getByRole("combobox", { name: "Kelas untuk piket", exact: true })
    .selectOption(id(20));
  await geometry(page, "large duty at short mobile");
  await a11y(page, "large duty");
  await page.setViewportSize({ width: 812, height: 375 });
  await geometry(page, "landscape resize");
  await page.setViewportSize({ width: 1440, height: 900 });
  await geometry(page, "desktop resize");
  await visit("normal", 1440, 900);
  await page.getByRole("button", { name: "Edit", exact: true }).focus();
  await page.keyboard.press("Enter");
  check(
    await page
      .locator("select[name=classId]")
      .evaluate((e) => e === document.activeElement),
    "keyboard Edit opens and focuses editor",
  );
  await page.getByRole("button", { name: "Batal edit" }).click();
  await page
    .getByRole("checkbox", { name: "Pilih IPA VII A Senin", exact: true })
    .tap();
  check(
    await page
      .getByRole("checkbox", { name: "Pilih IPA VII A Senin", exact: true })
      .isChecked(),
    "touch toggles lesson selection",
  );
  await page
    .getByRole("checkbox", { name: "Pilih IPA VII A Senin", exact: true })
    .uncheck();
  await page.screenshot({
    path: join(out, "schedules-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 812 });
  await page.screenshot({
    path: join(out, "schedules-mobile.png"),
    fullPage: true,
  });
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
          "Synthetic fixtures and intercepted API writes; no authenticated production role UAT.",
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
