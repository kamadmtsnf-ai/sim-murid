/** Actual Hak akses saya UI with isolated HTTP boundaries. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd();
const out =
  process.env.ACADEMIC_CONTEXT_QA_OUTPUT ??
  join(root, "docs/verification/academic-context");
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
  entryPoints: [join(root, "tests/ui/academic-context-fixture.tsx")],
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
        b.onResolve({ filter: /^@\/lib\/supabase\/environment$/ }, () => ({
          path: "fixture-env",
          namespace: "fixture-env",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture-env" }, () => ({
          contents:
            'export const getSupabasePublicEnvironment=()=>({url:"https://example.org",publishableKey:"synthetic"});',
          loader: "js",
        }));
        b.onResolve({ filter: /^next\/image$/ }, () => ({
          path: join(root, "tests/ui/settings-image-shim.ts"),
        }));
        b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({
          path: join(root, "tests/ui/promotions-storage-shim.ts"),
        }));
        b.onResolve({ filter: /^next\/navigation$/ }, () => ({
          path: join(root, "tests/ui/academic-context-navigation-shim.ts"),
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Academic Context QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const checks = [],
  errors = [],
  accessibility = [];
let browser, page;
function check(ok, name) {
  checks.push({ name, passed: !!ok });
  assert.ok(ok, name);
}
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.UI_CHROMIUM_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext();
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    key = "sim-academic:v1:001-context";
  let failure = false,
    mismatch = false;
  const reads = [],
    writes = [];
  await context.route("**/api/learning/*", async (route) => {
    const req = route.request();
    if (req.method() !== "GET") {
      writes.push(req.url());
      return route.abort();
    }
    const u = new URL(req.url()),
      moduleName = u.pathname.split("/").at(-1),
      scope = Object.fromEntries(u.searchParams);
    reads.push({ module: moduleName, ...scope });
    if (failure)
      return route.fulfill({ status: 503, json: { message: "synthetic" } });
    const fixture = await page.evaluate(() => window.academicFixture),
      data = structuredClone(fixture[moduleName]);
    data.semester = Number(scope.semester ?? 2);
    data.extra.scope = { ...scope, semester: data.semester };
    if (mismatch) data.semester = data.semester === 1 ? 2 : 1;
    return route.fulfill({ json: { data } });
  });
  async function visit(module, extra = "") {
    await page.goto(base + "/?module=" + module + extra);
    await page.locator(".academic-context-bar summary").waitFor();
    await page.locator(".academic-context-bar summary").click();
  }
  const button = (name) => page.getByRole("button", { name, exact: true });
  const stored = { version: 1, year: 2026, semester: 1, classId: id(30) };
  async function put(value) {
    await page.evaluate(
      ({ key, value }) => {
        localStorage.setItem(key, JSON.stringify(value));
        window.dispatchEvent(new Event("sim-academic-context"));
      },
      { key, value },
    );
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
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await visit("classes");
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "context overflow " + width,
    );
    await a11y("context " + width);
    await page.screenshot({
      path: join(out, "context-" + width + ".png"),
      fullPage: true,
    });
  }
  await visit("classes");
  check(
    (await page
      .getByLabel("Semester pilihan lintas halaman", { exact: true })
      .inputValue()) === "2",
    "server January suggests Genap without browser clock",
  );
  await page
    .getByRole("button", { name: "Daftar siswa", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Semester pilihan lintas halaman", { exact: true })
    .selectOption("1");
  await button("Ingat pilihan halaman").click();
  check(
    (await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).classId,
      key,
    )) === id(30),
    "class context remembers actual roster",
  );
  await page.locator('input[name="startsOn"]').fill("2026-07-01");
  await put({ ...stored, year: 2025, classId: id(31), semester: 2 });
  page.once("dialog", (d) => d.dismiss());
  await button("Terapkan pilihan tersimpan").click();
  check(
    (await page.locator('input[name="startsOn"]').inputValue()) ===
      "2026-07-01",
    "cancel context preserves placement draft",
  );
  page.once("dialog", (d) => d.accept());
  await button("Terapkan pilihan tersimpan").click();
  check(
    (await page.locator(".classes-filters select").first().inputValue()) ===
      id(71) &&
      (await page.locator('input[name="startsOn"]').inputValue()) === "",
    "confirmed year transfer clears dependent placement",
  );
  await put(stored);
  await visit("grades");
  check(
    (await page
      .getByRole("button", { name: "Input nilai", exact: true })
      .count()) === 0,
    "no automatic filter/write on navigation",
  );
  await button("Terapkan pilihan tersimpan").click();
  await page.getByText("Data penilaian diperbarui.", { exact: true }).waitFor();
  check(
    reads.at(-1).classId === id(30) && reads.at(-1).semester === "1",
    "stored class/semester transferred to real grade GET",
  );
  check(
    (await page.locator('select[name="classId"]').inputValue()) === id(30) &&
      (await page.locator('select[name="semester"]').inputValue()) === "1",
    "grade controls synchronized after transfer",
  );
  await page.locator('select[name="subjectId"]').selectOption(id(60));
  await button("Tampilkan").click();
  await page
    .getByRole("button", { name: "Input nilai", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Input nilai", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  check(
    (await page
      .getByRole("dialog")
      .getByLabel("Tanggal penilaian / periode KKM", { exact: true })
      .inputValue()) === "2026-07-01",
    "stored Ganjil controls date even when server is January",
  );
  check(
    await page
      .locator(".academic-context-bar button")
      .filter({ hasText: "Terapkan pilihan tersimpan" })
      .isDisabled(),
    "open entry blocks context transfer",
  );
  await page.keyboard.press("Escape");
  await put({ ...stored, year: 2025, classId: id(31), semester: 2 });
  check(
    (await page.locator('select[name="classId"]').inputValue()) === id(30),
    "external preference never overwrites current applied scope",
  );
  await button("Terapkan pilihan tersimpan").click();
  await page.waitForFunction(() =>
    document.querySelector('select[name="classId"]').value.endsWith("31"),
  );
  check(
    (await page.locator(".grades-panel").innerText()).includes(
      "Januari–Juni 2026",
    ),
    "historical Genap uses second calendar year",
  );
  check(
    !reads.at(-1).subjectId,
    "dependent subject filter cleared on class transfer",
  );
  await visit("schedules");
  await button("Terapkan pilihan tersimpan").click();
  const pushed = await page.locator("html").getAttribute("data-pushed");
  const scheduleQuery = new URL(pushed, base).searchParams;
  check(
    scheduleQuery.get("year") === id(71) &&
      scheduleQuery.get("class") === id(31) &&
      scheduleQuery.get("day") === "2" &&
      scheduleQuery.get("personal") === "1" &&
      scheduleQuery.get("view") === "piket",
    "schedule transfer maps year UUID and preserves day/personal/tab",
  );
  await visit("reports");
  await button("Terapkan pilihan tersimpan").click();
  await page
    .getByText("Tidak ada rapor sesuai filter dan hak akses Anda.", {
      exact: true,
    })
    .first()
    .waitFor();
  check(
    reads.at(-1).module === "reports" &&
      reads.at(-1).classId === id(31) &&
      reads.at(-1).semester === "2",
    "same scope transfers grades to reports",
  );
  await page.reload();
  await page.locator(".academic-context-bar summary").click();
  check(
    (await page
      .locator(".academic-context-bar")
      .getByText(/2025\/2026/)
      .count()) > 0,
    "preference survives reload",
  );
  await page.goBack();
  await page.locator(".academic-context-summary").waitFor();
  check(
    (await page.locator(".academic-context-summary").innerText()).includes(
      "2025/2026",
    ),
    "browser Back preserves stored preference",
  );
  await page.goto(base + "/?module=grades&revoked=1");
  await page.locator(".academic-context-bar summary").click();
  await put(stored);
  check(
    await button("Terapkan pilihan tersimpan").isDisabled(),
    "revoked class cannot broaden to all",
  );
  check(
    await page.getByText(/tersimpan tidak tersedia/).isVisible(),
    "revocation explanation explicit",
  );
  await visit("grades");
  await put(stored);
  failure = true;
  let n = reads.length;
  await button("Terapkan pilihan tersimpan").click();
  await page.getByText(/Data belum dapat dimuat/).waitFor();
  check(
    reads.length === n + 1 &&
      (await page.locator('select[name="classId"]').inputValue()) === "",
    "failed GET retains original scope",
  );
  failure = false;
  mismatch = true;
  await button("Terapkan pilihan tersimpan").click();
  await page.waitForFunction(
    () =>
      document.querySelector(".grades-panel")?.getAttribute("aria-busy") ===
      "false",
  );
  check(
    (await page.locator('select[name="classId"]').inputValue()) === "",
    "wrong semester response never applied",
  );
  mismatch = false;
  await visit("classes", "&user=other");
  check(
    await button("Terapkan pilihan tersimpan").isDisabled(),
    "other account does not inherit context",
  );
  await visit("classes");
  const second = await context.newPage();
  await second.goto(base + "/?module=classes");
  await second.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key, value: { ...stored, semester: 2 } },
  );
  await page.waitForFunction(() =>
    document
      .querySelector(".academic-context-summary")
      ?.textContent.includes("Genap"),
  );
  check(
    (await page.locator(".classes-filters select").first().inputValue()) ===
      id(70),
    "storage event does not alter page filter",
  );
  await second.close();
  await button("Hapus pilihan tersimpan").click();
  check(
    (await page.evaluate((key) => localStorage.getItem(key), key)) === null,
    "clear preference preserves current filters",
  );
  await page.evaluate((key) => {
    localStorage.setItem(key, '{"version":99}');
    window.dispatchEvent(new Event("sim-academic-context"));
  }, key);
  check(
    await page.getByText(/Pilihan tersimpan tidak valid/).isVisible(),
    "malformed preference visible and inert",
  );
  await button("Hapus pilihan tersimpan").click();
  await visit("classes", "&today=2026-07-01");
  check(
    (await page
      .getByLabel("Semester pilihan lintas halaman", { exact: true })
      .inputValue()) === "1",
    "server July suggests Ganjil",
  );
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw Error("blocked");
    };
  });
  await page
    .getByRole("button", { name: "Daftar siswa", exact: true })
    .first()
    .click();
  await button("Ingat pilihan halaman").click();
  check(
    await page.getByText(/Pilihan hanya diingat selama/).isVisible(),
    "storage blocked has memory fallback",
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "remembered topbar overflow " + width,
    );
    await a11y("remembered context " + width);
    if (width === 320 || width === 1440)
      await page.screenshot({
        path: join(out, "remembered-" + width + ".png"),
        fullPage: true,
      });
  }
  await page.setViewportSize({ width: 844, height: 390 });
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "context landscape overflow",
  );
  check(!writes.length, "context transfer performs no mutation");
  check(!errors.length, "no JavaScript errors");
  await writeFile(
    join(out, "results.json"),
    JSON.stringify({ checks, accessibility, errors, reads, writes }, null, 2),
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
