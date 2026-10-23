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
  process.env.SETTINGS_QA_OUTPUT ?? join(root, "docs/verification/settings");
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
  entryPoints: [join(root, "tests/ui/settings-fixture.tsx")],
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
        b.onResolve({ filter: /^next\/image$/ }, () => ({
          path: join(root, "tests/ui/settings-image-shim.ts"),
        }));
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
let browser, page;
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
  page = await browser.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(String(e)));
  const accept = (d) => d.accept();
  page.on("dialog", accept);
  let writes = 0,
    mode = "ok";
  await page.route("https://assets.example.invalid/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jm3sAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.route("**/api/settings**", async (route) => {
    const request = route.request(),
      data = await page.evaluate(() => window.settingsFixture);
    if (request.method() === "POST") {
      writes++;
      if (request.url().endsWith("/logo"))
        data.school.asset_data.school = id(600) + ".png";
      else {
        const c = request.postDataJSON().command;
        if (c.type === "profile")
          data.school = { ...data.school, ...c.profile };
        else if (["subject", "memorization"].includes(c.type)) {
          const key = c.type === "subject" ? "subjects" : "memorization";
          const row = {
            id: c.id ?? id(500 + writes),
            code: "MP_NEW",
            sort_order: 99,
            name: c.name.trim().replaceAll(";", ","),
            active: c.active,
          };
          if (c.id) data[key] = data[key].map((r) => (r.id === c.id ? row : r));
          else data[key].push(row);
        } else if (c.type === "deactivate") {
          const key = c.catalog === "subject" ? "subjects" : "memorization";
          data[key].find((r) => r.id === c.id).active = false;
        } else if (c.type === "holiday") {
          data.holidays.push({
            id: id(700 + writes),
            holiday_date: c.start,
            description: c.description,
          });
        } else if (c.type === "logo_clear")
          delete data.school.asset_data[c.slot];
      }
      data.revision++;
      await page.evaluate((data) => (window.settingsFixture = data), data);
    }
    await new Promise((r) => setTimeout(r, 80));
    await route.fulfill({
      status: mode === "ok" ? 200 : 503,
      json:
        mode === "ok"
          ? {
              settings: data,
              code: request.method() === "POST" ? "saved" : undefined,
              message: "Pengaturan berhasil disimpan.",
            }
          : { message: "Layanan belum dapat memastikan hasil." },
    });
  });
  async function geometry(name) {
    const s = await page.evaluate(() => ({
      viewport: innerWidth,
      width: document.documentElement.scrollWidth,
    }));
    check(s.width <= s.viewport + 1, name + " no horizontal overflow");
  }
  async function a11y(name) {
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
      name,
      violations: r.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    });
    check(!r.violations.length, name + " axe");
  }
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base);
    await page
      .getByRole("textbox", { name: "Nama sekolah", exact: true })
      .waitFor();
    for (const tab of [
      "Profil dan logo",
      "Mata pelajaran",
      "Hafalan",
      "Hari libur",
    ]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await geometry(tab + " " + width);
      if (width === 320) await a11y(tab);
    }
    await page
      .getByRole("button", { name: "Profil dan logo", exact: true })
      .click();
    await page.screenshot({
      path: join(out, "settings-" + width + ".png"),
      fullPage: true,
      animations: "disabled",
    });
  }
  const name = page.getByRole("textbox", { name: "Nama sekolah", exact: true });
  await name.fill("Profil belum disimpan");
  page.off("dialog", accept);
  const dismiss = (d) => d.dismiss();
  page.on("dialog", dismiss);
  await page
    .getByRole("button", { name: "Mata pelajaran", exact: true })
    .click();
  check(
    (await name.inputValue()) === "Profil belum disimpan",
    "tab discard cancellation preserves profile",
  );
  page.off("dialog", dismiss);
  page.on("dialog", accept);
  await page.getByLabel("Pilih logo sekolah", { exact: true }).setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jm3sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page
    .getByRole("button", { name: "Unggah logo", exact: true })
    .first()
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Pengaturan berhasil disimpan." })
    .waitFor();
  check(
    (await name.inputValue()) === "Profil belum disimpan",
    "logo save preserves unsaved profile",
  );
  check(
    (await page
      .getByLabel("Pilih logo sekolah", { exact: true })
      .inputValue()) === "",
    "uploaded file input resets",
  );
  const before = writes;
  await page
    .getByRole("button", { name: "Simpan profil sekolah", exact: true })
    .evaluate((e) => {
      e.click();
      e.click();
    });
  await page.waitForFunction(
    () =>
      document.querySelector("div[aria-busy]")?.getAttribute("aria-busy") ===
      "false",
  );
  check(writes === before + 1, "synchronous double click sends one save");
  check(
    (await name.inputValue()) === "Profil belum disimpan",
    "profile confirmed value",
  );
  check(
    (await page
      .getByRole("textbox", { name: "NPSN", exact: true })
      .inputValue()) === "00001",
    "leading zeros retained",
  );
  await page
    .getByRole("button", { name: "Mata pelajaran", exact: true })
    .click();
  check(
    (await page.getByRole("button", { name: "Edit", exact: true }).count()) ===
      20,
    "master pagination limits DOM",
  );
  await page.getByRole("button", { name: "Berikutnya", exact: true }).click();
  check(
    (await page.getByRole("button", { name: "Edit", exact: true }).count()) ===
      5,
    "next master page",
  );
  await page
    .getByRole("searchbox", { name: "Cari data" })
    .fill("Mata pelajaran 24");
  check(
    (await page.getByRole("button", { name: "Edit", exact: true }).count()) ===
      1,
    "master search",
  );
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("textbox", { name: "Ubah nama", exact: true }).waitFor();
  check(
    (await page
      .getByRole("checkbox", { name: "Aktif", exact: true })
      .isChecked()) === false,
    "inactive master can be edited",
  );
  await page.getByRole("checkbox", { name: "Aktif", exact: true }).check();
  await page
    .getByRole("button", { name: "Simpan perubahan", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Nama baru", exact: true }).waitFor();
  check(
    (await page
      .getByRole("button", { name: "Nonaktifkan", exact: true })
      .count()) === 1,
    "inactive master reactivated",
  );
  await page
    .getByRole("textbox", { name: "Nama baru", exact: true })
    .fill("Akun ambigu");
  mode = "ambiguous";
  await page.getByRole("button", { name: "Tambah", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("div[aria-busy]")?.getAttribute("aria-busy") ===
      "false",
  );
  check(
    await page
      .getByRole("button", { name: "Tambah", exact: true })
      .isDisabled(),
    "uncertain save blocks blind retry",
  );
  const saved = writes;
  mode = "ok";
  await page.getByRole("button", { name: "Muat ulang", exact: true }).click();
  await page.getByText("Pengaturan berhasil dimuat ulang.").waitFor();
  check(writes === saved, "reload never repeats write");
  await page.getByRole("searchbox", { name: "Cari data" }).fill("Akun ambigu");
  check(
    (await page.getByRole("button", { name: "Edit", exact: true }).count()) ===
      1,
    "committed ambiguous save recovered once",
  );
  await page.getByRole("button", { name: "Hari libur", exact: true }).click();
  await page.getByLabel("Tanggal awal", { exact: true }).fill("2026-11-01");
  check(
    (await page
      .getByLabel("Tanggal akhir (sama untuk satu hari)", { exact: true })
      .inputValue()) === "2026-11-01",
    "one-day holiday auto fills end",
  );
  await page
    .getByRole("textbox", { name: "Keterangan", exact: true })
    .fill("Libur baru");
  await page
    .getByRole("button", { name: "Tambahkan hari libur", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Pengaturan berhasil disimpan." })
    .waitFor();
  await page.getByRole("searchbox", { name: "Cari data" }).fill("Libur baru");
  check(
    (await page
      .getByRole("cell", { name: "Libur baru", exact: true })
      .count()) === 1,
    "holiday saved and searchable",
  );
  await page.setViewportSize({ width: 812, height: 375 });
  await geometry("landscape orientation");
  await page.getByRole("searchbox", { name: "Cari data" }).focus();
  await page.keyboard.press("Tab");
  check(
    await page.evaluate(
      () => document.activeElement?.getAttribute("role") === "region",
    ),
    "keyboard reaches scrollable table",
  );
  await page.keyboard.press("Tab");
  check(
    await page.evaluate(() => document.activeElement?.tagName === "BUTTON"),
    "keyboard reaches table action",
  );
  await page.goto(base + "/?empty=1");
  await page
    .getByRole("textbox", { name: "Nama sekolah", exact: true })
    .waitFor();
  check(
    await page
      .getByRole("button", { name: "Unggah logo", exact: true })
      .first()
      .isDisabled(),
    "empty profile blocks logo",
  );
  await page.getByRole("button", { name: "Hafalan", exact: true }).click();
  await page.getByText("Belum ada data.", { exact: true }).waitFor();
  check(true, "empty catalog rendered");
  await a11y("empty");
  check(!errors.length, "no JavaScript page errors");
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
