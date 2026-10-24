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
  process.env.INSIGHTS_QA_OUTPUT ?? join(root, "docs/verification/insights");
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
  entryPoints: [join(root, "tests/ui/insights-fixture.tsx")],
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Surveys QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const checks = [],
  errors = [],
  accessibility = [];
let browser, activePage;
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
  const page = await browser.newPage();
  activePage = page;
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => d.accept());
  let posts = 0,
    aiPosts = 0,
    failRead = false,
    lastQuery = "";
  const progress = Array.from({ length: 25 }, (_, i) => ({
    user_id: id(100 + i),
    name: "Responden " + i,
    submitted_at: "2026-12-20",
    flags: { reliability: "tinggi" },
    note: "Catatan " + i,
  }));
  const plan = Array.from({ length: 4 }, (_, i) => ({
    description: "Rencana tersimpan " + i,
    owner: "Kepala",
    target: "2027-02-01",
    aspect: "Pengajaran",
    status: "proses",
  }));
  await page.route("**/api/services/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname.endsWith("/ai")) {
      aiPosts++;
      await new Promise((r) => setTimeout(r, 150));
      await route.fulfill({
        status: 200,
        json: { message: "Konfigurasi tersimpan" },
      });
      return;
    }
    const data = await page.evaluate(() => window.insightsFixture);
    if (request.method() === "POST") {
      posts++;
      const body = request.postDataJSON();
      if (body.command.type === "note")
        progress.find((r) => r.user_id === body.command.userId).note =
          body.command.note;
    }
    lastQuery = url.search;
    data.extra.appliedFilters = Object.fromEntries(url.searchParams);
    if (url.searchParams.has("periodId"))
      Object.assign(data.extra, {
        progress,
        plan,
        aggregates: [
          {
            role: "student",
            aspect: "Pengajaran",
            code: "A1",
            n: 25,
            mean: 4.2,
          },
        ],
        analyses: [],
        canPlan: true,
      });
    await new Promise((r) => setTimeout(r, 80));
    await route.fulfill({
      status: failRead ? 503 : 200,
      json: failRead
        ? { message: "Tidak tersedia" }
        : { data, result: { code: "saved" }, code: "saved" },
    });
  });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base);
    await page.getByRole("combobox", { name: /^Periode/ }).selectOption(id(11));
    await page
      .getByRole("textbox", { name: /^Deskripsi/ })
      .first()
      .waitFor();
    check(
      (await page.getByRole("textbox", { name: /^Deskripsi/ }).count()) === 4,
      "saved four-point plan " + width,
    );
    check(
      (await page
        .getByRole("textbox", { name: /^Deskripsi/ })
        .first()
        .inputValue()) === "Rencana tersimpan 0",
      "plan values retained " + width,
    );
    check(
      (await page
        .getByRole("option", { name: "OpenAI (ChatGPT)", exact: true })
        .count()) === 2,
      "OpenAI provider available " + width,
    );
    const size = await page.evaluate(() => ({
      w: innerWidth,
      s: document.documentElement.scrollWidth,
    }));
    check(size.s <= size.w + 1, "no horizontal overflow " + width);
    await page.evaluate(axe);
    const a = await page.evaluate(() =>
      window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"],
        },
      }),
    );
    accessibility.push({
      width,
      violations: a.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    });
    check(!a.violations.length, "axe " + width);
    await page.screenshot({
      path: join(out, "insights-" + width + ".png"),
      fullPage: true,
    });
  }
  await page.getByLabel("Jumlah poin").fill("3");
  check(
    (await page.getByRole("textbox", { name: /^Deskripsi/ }).count()) === 3,
    "existing plan can reduce to three points after confirmation",
  );
  await page.getByLabel("Jumlah poin").fill("4");
  await page.getByRole("combobox", { name: /^Peran/ }).selectOption("teacher");
  check(
    await page
      .getByRole("button", { name: "Jalankan", exact: true })
      .isDisabled(),
    "unapplied scope blocks AI",
  );
  await page.getByRole("button", { name: "Terapkan filter hasil" }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('input[name="description0"]').length === 1 &&
      !document.querySelector("main")?.getAttribute("aria-busy"),
  );
  await page
    .getByRole("button", { name: "Jalankan", exact: true })
    .evaluate((e) => {
      e.click();
      e.click();
    });
  await page.waitForFunction(
    () => !document.querySelector('section[aria-busy="true"]'),
    {},
    { timeout: 10000 },
  );
  check(aiPosts === 1, "double submit sends one AI request");
  check(lastQuery.includes("role=teacher"), "AI reload preserves role");
  await page.getByText(/^Daftar responden/).click();
  const note = page.getByLabel("Catatan pemantau").first();
  await page.getByRole("textbox", {name:/^Deskripsi/}).first().fill("Draft rencana belum disimpan");
  await note.fill("Diperbarui");
  await page
    .getByRole("button", { name: "Simpan catatan" })
    .first()
    .evaluate((e) => {
      e.click();
      e.click();
    });
  await page
    .getByText("Perubahan tersimpan dan hasil telah dimuat ulang.")
    .waitFor();
  check(posts === 1, "double save sends one mutation");
  check(
    (await page.getByLabel("Catatan pemantau").first().inputValue()) ===
      "Diperbarui",
    "confirmed note readback",
  );
  check(!(await page.evaluate(() => window.dispatchEvent(new Event("sim-form-unsaved-check", {cancelable:true})))), "saving note preserves independent plan dirty guard");
  check((await page.getByRole("textbox", {name:/^Deskripsi/}).first().inputValue()) === "Draft rencana belum disimpan", "saving note retains independent plan values");
  await page.getByRole("button", { name: "Berikutnya", exact: true }).click();
  check(
    (await page.getByLabel("Catatan pemantau").count()) === 5,
    "respondent pagination",
  );
  failRead = true;
  await page.getByRole("button", { name: "Muat ulang hasil" }).click();
  await page
    .getByText("Hasil belum dapat dimuat. Muat ulang sebelum melanjutkan.")
    .waitFor();
  check(
    await page.getByRole("combobox", { name: /^Periode/ }).isDisabled(),
    "failed read blocks changes",
  );
  failRead = false;
  await page.getByRole("button", { name: "Muat ulang hasil" }).click();
  await page.getByRole("combobox", { name: /^Periode/ }).waitFor();
  await page.waitForFunction(
    () => !document.querySelector("fieldset[disabled]"),
    {},
    { timeout: 10000 },
  );
  check(
    await page.getByRole("combobox", { name: /^Periode/ }).isEnabled(),
    "explicit reload recovers",
  );
  await page.setViewportSize({ width: 812, height: 375 });
  const landscape = await page.evaluate(
    () => document.documentElement.scrollWidth <= innerWidth + 1,
  );
  check(landscape, "orientation change does not overflow");
  await page.getByRole("combobox", { name: /^Periode/ }).focus();
  await page.keyboard.press("Tab");
  check(
    await page.evaluate(() => document.activeElement?.tagName === "A"),
    "keyboard reaches export action",
  );
  await page.getByRole("combobox", { name: /^Periode/ }).selectOption("");
  await page
    .getByText(
      "Pilih periode untuk melihat hasil survei sesuai hak akses Anda.",
    )
    .waitFor();
  check(
    (await page.getByRole("link", { name: /^Ekspor/ }).count()) === 0,
    "clearing period removes export links",
  );
  check(!errors.length, "no JavaScript errors");
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
  if (activePage)
    await writeFile(join(out, "page.html"), await activePage.content());
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
