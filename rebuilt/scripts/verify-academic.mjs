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
  process.env.ACADEMIC_QA_OUTPUT ?? join(root, "docs/verification/academic");
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
  entryPoints: [join(root, "tests/ui/academic-fixture.tsx")],
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
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/api/learning/**", async (route) => {
    check(
      route.request().method() === "GET",
      "browser test performs reads only",
    );
    const d = await page.evaluate(() => window.academicLearning);
    d.semester = Number(
      new URL(route.request().url()).searchParams.get("semester") ?? 1,
    );
    await route.fulfill({ status: 200, json: { data: d } });
  });
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  async function visit(view, width = 375) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto(base + "/?view=" + view);
    await page.getByRole("heading", { level: 1 }).waitFor();
  }
  for (const view of [
    "grades",
    "reports",
    "promotions",
    "survey",
    "insights",
    "schedule",
  ])
    for (const width of [320, 768, 1440]) {
      await visit(view, width);
      await geometry(page, view + " " + width);
      if (width === 320) await a11y(page, view);
    }
  await visit("grades");
  const cls = page.getByRole("combobox", { name: "Kelas / tahun ajaran" });
  check(
    (await cls.locator("option").allTextContents()).includes(
      "VII A — 2026/2027",
    ),
    "grades class year is paired",
  );
  await cls.selectOption(id(20));
  await page
    .getByRole("combobox", { name: "Mata pelajaran" })
    .selectOption(id(30));
  await page.getByRole("button", { name: "Tampilkan", exact: true }).click();
  await page.getByLabel("Tanggal penilaian / periode KKM").waitFor();
  let date = page.getByLabel("Tanggal penilaian / periode KKM");
  check(
    (await date.getAttribute("min")) === "2026-07-01" &&
      (await date.getAttribute("max")) === "2026-12-31",
    "Ganjil date bounds",
  );
  await date.fill("2026-10-30");
  await page
    .getByRole("combobox", { name: "Semester", exact: true })
    .selectOption("2");
  await page.getByRole("button", { name: "Tampilkan", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("input[name=date]")?.min === "2027-01-01",
  );
  date = page.getByLabel("Tanggal penilaian / periode KKM");
  check(
    (await date.inputValue()) === "2027-01-01",
    "semester change resets old dirty date into correct Genap year",
  );
  check(
    (await date.getAttribute("max")) === "2027-06-30",
    "Genap ends in June of second year",
  );
  check(
    (await page
      .getByText("Tahun ajaran 2026/2027 · Genap · Januari–Juni 2027", {
        exact: true,
      })
      .count()) === 1,
    "selected period description synchronized",
  );
  await visit("promotions");
  const source = page.getByRole("combobox", { name: "Tahun ajaran asal" });
  check(
    await source
      .locator("option")
      .allTextContents()
      .then((v) => v.includes("2026/2027") && v.includes("2025/2026")),
    "promotion years use full ranges",
  );
  await visit("survey");
  await page
    .getByText("Buat periode survei utama / mikro", { exact: true })
    .click();
  const year = page.getByRole("combobox", {
      name: "Tahun ajaran",
      exact: true,
    }),
    semester = page.getByRole("combobox", { name: "Semester", exact: true });
  check(
    await year
      .locator("option")
      .allTextContents()
      .then((v) => v.includes("2026/2027")),
    "survey year labels paired",
  );
  await semester.selectOption("2");
  let start = page.getByLabel("Mulai", { exact: true }),
    end = page.getByLabel("Selesai", { exact: true });
  check(
    (await start.getAttribute("min")) === "2027-01-01" &&
      (await end.getAttribute("max")) === "2027-06-30",
    "survey Genap period synchronized",
  );
  await page.locator('input[name="title"]').fill("Evaluasi Genap");
  await page.getByLabel("Siswa", { exact: true }).check();
  await start.fill("2026-12-31");
  await end.fill("2027-06-30");
  check(
    !(await start.evaluate((e) => e.checkValidity())),
    "survey cannot submit outside selected semester",
  );
  await start.fill("2027-01-01");
  await page.getByRole("button", { name: "Buat periode", exact: true }).click();
  check(
    (await page.evaluate(() => window.academicCommands.length)) === 1,
    "valid survey submits once",
  );
  const command = await page.evaluate(() => window.academicCommands[0]);
  check(
    command.semester === 2 &&
      command.yearId === id(10) &&
      command.start === "2027-01-01",
    "survey request keeps correct year identity and Genap dates",
  );
  await year.selectOption(id(11));
  check(
    (await page.getByLabel("Mulai", { exact: true }).inputValue()) === "",
    "year change clears old survey date",
  );
  check(
    (await page.getByLabel("Mulai", { exact: true }).getAttribute("min")) ===
      "2026-01-01",
    "previous academic year Genap uses previous second calendar year",
  );
  await visit("schedule");
  check(
    await page
      .getByRole("combobox", { name: "Kelas", exact: true })
      .locator("option")
      .allTextContents()
      .then((v) => v.includes("VII A (2026/2027)")),
    "schedule class labels show complete year",
  );
  check(!errors.length, "no uncaught JavaScript errors", errors);
  const report = {
    status: "passed",
    checks,
    axe: axeResults,
    issues,
    limits: [
      "Synthetic components and intercepted GETs; no real account/student mutations or role UAT.",
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
