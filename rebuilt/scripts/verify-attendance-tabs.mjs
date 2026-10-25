/** Isolated Attendance browser regression suite. No real account, API mutation or production data. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { installConfirmDriver } from "./confirm-driver.mjs";
const root = process.cwd(),
  baseline = process.argv.includes("--baseline");
const out =
  process.env.ATTENDANCE_QA_OUTPUT ??
  join(root, "docs/verification/attendance");
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
  entryPoints: [join(root, "tests/ui/attendance-fixture.tsx")],
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
          path: join(root, "tests/ui/attendance-navigation-shim.ts"),
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
  await installConfirmDriver(page);
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  let posts = [],
    gets = [],
    reply = "success",
    calendarReply = "success";
  await page.route("**/api/operations/attendance?*", async (route) => {
    const request = route.request(),
      data = await page.evaluate(() => window.attendanceFixture),
      q = new URL(request.url()).searchParams;
    if (request.method() === "GET") {
      gets.push(request.url());
      if (q.has("calendar")) {
        if (calendarReply === "error")
          return route.fulfill({
            status: 503,
            json: { message: "Unavailable" },
          });
        const month = q.get("calendar"),
          student = q.get("studentId");
        data.rows = [
          {
            ...data.rows[0],
            student_id: student,
            date: month + "-02",
            status: "Sakit",
          },
        ];
        data.total = calendarReply === "incomplete" ? 51 : 1;
        data.page = 1;
        data.pageSize = 10000;
        return route.fulfill({ json: { data } });
      }
      if (reply === "read-error")
        return route.fulfill({ status: 503, json: { message: "Unavailable" } });
      data.page = Number(q.get("page") ?? 1);
      data.people = [];
      data.rows = q.get("status") === "Alpha" ? [] : data.rows;
      data.total = q.get("status") === "Alpha" ? 0 : data.total;
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
    data.revision = route.request().postDataJSON().revision + 1;
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
    calendarReply = "success";
    posts = [];
    gets = [];
    await page.setViewportSize({ width, height });
    await page.goto(base + "/?mode=" + mode);
    await page.getByRole("heading", { level: 1 }).waitFor();
  }
  const input = () =>
      page.getByRole("region", { name: "Input absensi per kelas" }),
    history = () => page.getByRole("region", { name: "Filter riwayat" });
  async function prepare() {
    await input().getByLabel("Kelas untuk input").selectOption(id(20));
    await input().getByRole("button", { name: "Tandai semua Hadir" }).click();
  }
  for (const width of [320, 375, 768, 1440]) {
    await visit("normal", width, width === 768 ? 375 : 812);
    const inputTab = page.getByRole("tab", {
      name: "Input absensi",
      exact: true,
    });
    const historyTab = page.getByRole("tab", {
      name: "Riwayat absensi",
      exact: true,
    });
    check(
      (await inputTab.getAttribute("aria-selected")) === "true",
      "manager starts input " + width,
    );
    await prepare();
    await input()
      .getByLabel("Keterangan Siswa 1", { exact: true })
      .fill("Draft dipertahankan");
    await geometry(page, "input " + width);
    await a11y(page, "input " + width);
    await inputTab.focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      () =>
        document
          .querySelector('[role="tab"][data-state="active"]')
          ?.textContent?.trim() === "Riwayat absensi",
    );
    await history().waitFor({ state: "hidden" });
    check(
      (await historyTab.getAttribute("aria-selected")) === "true",
      "keyboard switches tabs " + width,
    );
    const summary = page
      .locator("summary")
      .filter({ hasText: "Filter riwayat" });
    await summary.click();
    await history().waitFor();
    await history()
      .getByRole("combobox", { name: "Status", exact: true })
      .selectOption("Alpha");
    await history().getByRole("button", { name: "Terapkan filter" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Riwayat diperbarui" })
      .waitFor();
    check(
      (
        await page
          .getByRole("link", { name: "Ekspor Excel" })
          .getAttribute("href")
      ).includes("status=Alpha"),
      "export filter " + width,
    );
    await summary.focus();
    await page.keyboard.press("Enter");
    await history().waitFor({ state: "hidden" });
    await geometry(page, "history " + width);
    await a11y(page, "history " + width);
    await inputTab.click();
    check(
      (await input()
        .getByLabel("Keterangan Siswa 1", { exact: true })
        .inputValue()) === "Draft dipertahankan",
      "tab retains draft " + width,
    );
    await input()
      .getByRole("button", { name: "Simpan absensi", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Perubahan berhasil" })
      .waitFor();
    check(
      posts.length === 1 && posts[0].command.type === "batch",
      "existing batch save " + width,
    );
  }
  await visit("readonly");
  check(
    (await page
      .getByRole("tab", { name: "Riwayat absensi", exact: true })
      .getAttribute("aria-selected")) === "true",
    "readonly defaults history",
  );
  await page.getByRole("tab", { name: "Input absensi", exact: true }).click();
  check(
    (await page
      .getByRole("button", { name: "Simpan absensi", exact: true })
      .count()) === 0,
    "readonly has no write controls",
  );
  await page
    .getByText("Input absensi tidak tersedia", { exact: true })
    .waitFor();
  await a11y(page, "readonly input");
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
