/** Actual Buku digital UI with isolated Auth/HTTP/Storage boundaries. */
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
  process.env.BOOKS_QA_OUTPUT ?? join(root, "docs/verification/books");
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
  entryPoints: [join(root, "tests/ui/books-fixture.tsx")],
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
          path: join(root, "tests/ui/books-navigation-shim.ts"),
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
const { PDFDocument } = await import("pdf-lib");
const pdf = await PDFDocument.create();
for (let n = 1; n <= 25; n++) {
  const p = pdf.addPage([595, 842]);
  p.drawText("Buku digital - halaman " + n, { x: 50, y: 780, size: 18 });
}
const pdfBytes = await pdf.save();
const server = createServer(async (request, response) => {
  if (request.url === "/pdf.worker.min.mjs") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(await readFile(join(root, "public/pdf.worker.min.mjs")));
  } else if (request.url?.startsWith("/api/learning/assets/")) {
    response.setHeader("Content-Type", "application/pdf");
    response.end(Buffer.from(pdfBytes));
  } else if (request.url === "/fixture.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(await readFile(join(temp, "fixture.js")));
  } else if (request.url === "/fixture.css") {
    response.setHeader("Content-Type", "text/css");
    response.end(css.join("\n"));
  } else {
    response.setHeader("Content-Type", "text/html");
    response.end(
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Books QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
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
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(String(e)));
  const accept = (d) => d.accept();
  page.on("dialog", accept);
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  let outcome = "success",
    readFailure = false,
    posts = [],
    assetPosts = [],
    preparedTarget;
  await page.route("**/api/learning/books*", async (route) => {
    const r = route.request(),
      data = await page.evaluate(() => window.booksFixture);
    if (r.method() === "GET") {
      if (readFailure)
        return route.fulfill({ status: 503, json: { message: "Offline" } });
      const q = new URL(r.url()).searchParams;
      data.extra.page = Number(q.get("page") ?? 1);
      if (q.get("query") === "absent") {
        data.rows = [];
        data.extra.total = 0;
      }
      return route.fulfill({ status: 200, json: { data } });
    }
    const c = r.postDataJSON().command;
    posts.push(c);
    if (outcome === "hang") return;
    if (outcome === "malformed")
      return route.fulfill({ status: 200, json: { message: "Saved" } });
    if (outcome === "stale")
      return route.fulfill({
        status: 409,
        json: { code: "stale", message: "Data berubah. Muat ulang." },
      });
    const target = c.id ?? id(999);
    if (c.type === "void") {
      data.rows = data.rows.filter((r) => r.id !== c.id);
      data.extra.total--;
    } else {
      const row = {
        id: target,
        title: c.title,
        author: c.author,
        publisher: c.publisher,
        publication_year: c.year,
        version: c.version,
        category: c.category,
        subject_id: c.subjectId,
        level: c.level,
        external_url: c.url || null,
        premium: c.premium,
        active: true,
        assets: data.rows.find((r) => r.id === target)?.assets ?? [],
      };
      data.rows = c.id
        ? data.rows.map((r) => (r.id === target ? row : r))
        : [...data.rows, row];
      if (!c.id) data.extra.total++;
    }
    data.revision++;
    await page.evaluate((d) => (window.booksFixture = d), data);
    await route.fulfill({
      status: 200,
      json: {
        code: "saved",
        result: { code: "saved", id: target },
        message: "Perubahan berhasil disimpan.",
      },
    });
  });
  await page.route("**/api/learning/assets", async (route) => {
    const b = route.request().postDataJSON();
    assetPosts.push(b);
    if (b.action === "prepare") {
      preparedTarget = b.targetId;
      return route.fulfill({
        status: 200,
        json: {
          id: id(900),
          upload: {
            path: `book/${b.targetId}/${id(900)}`,
            token: "scoped-token",
          },
        },
      });
    }
    if (outcome === "asset-error")
      return route.fulfill({
        status: 400,
        json: { message: "Isi berkas tidak sesuai atau rusak." },
      });
    await page.evaluate(
      ({ target, asset }) => {
        window.booksFixture.rows.find((r) => r.id === target).assets = [
          { id: asset, filename: "new.pdf" },
        ];
      },
      { target: preparedTarget, asset: id(900) },
    );
    return route.fulfill({
      status: 200,
      json: {
        code: "saved",
        id: id(900),
        action: "finalize",
        message: "Berkas berhasil diperbarui.",
      },
    });
  });
  const visit = async (mode = "normal") => {
    await page.goto(base + "/?mode=" + mode);
    await page
      .getByRole("heading", { name: "Buku digital", exact: true })
      .waitFor();
  };
  const card = () =>
    page.locator("article").filter({
      has: page.getByRole("heading", { name: "Buku 1", exact: true }),
    });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await visit();
    if (width === 320) {
      const title = page.getByText("Lihat judul lengkap", { exact: true });
      await title.click();
      check(
        await page
          .locator("article details[open] p")
          .innerText()
          .then((s) => s.length === 300),
        "long title remains readable on touch disclosure",
      );
      await geometry(page, "expanded title 320");
      await title.click();
    }
    await geometry(page, "catalog " + width);
    await a11y(page, "catalog " + width);
    await page.screenshot({
      path: join(out, `books-${width}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 320, height: 700 });
  await card().getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  check(
    (await dialog.getByLabel("URL buku eksternal (HTTPS)").inputValue()) ===
      "https://example.org/old.pdf",
    "editing retains stored external URL",
  );
  check(
    (await dialog.getByLabel(/^Judul/).getAttribute("maxlength")) === "300",
    "title supports full server limit",
  );
  await geometry(page, "edit mobile");
  await a11y(page, "edit mobile");
  await page.keyboard.press("Tab");
  check(
    await dialog.evaluate((e) => e.contains(document.activeElement)),
    "keyboard focus stays in edit dialog",
  );
  await dialog.getByLabel(/^Judul/).fill("Buku diperbarui");
  page.off("dialog", accept);
  const dismiss = (d) => d.dismiss();
  page.on("dialog", dismiss);
  await dialog.getByRole("button", { name: "Batal", exact: true }).click();
  check(await dialog.isVisible(), "dirty draft survives rejected discard");
  page.off("dialog", dismiss);
  page.on("dialog", accept);
  await dialog.getByLabel(/^Judul/).fill("Buku 1");
  await dialog.getByRole("button", { name: "Simpan buku" }).evaluate((e) => {
    e.click();
    e.click();
  });
  await page
    .getByText("Perubahan berhasil disimpan.", { exact: true })
    .waitFor();
  check(posts.length === 1, "double submit sends one mutation");
  check(
    posts[0].url === "https://example.org/old.pdf",
    "metadata save preserves URL payload",
  );
  await page.getByRole("button", { name: "Tambah buku", exact: true }).click();
  await dialog.getByLabel(/^Judul/).fill("Buku baru");
  await dialog.getByLabel("Tahun terbit", { exact: true }).fill("2201");
  await dialog.getByRole("button", { name: "Simpan buku" }).click();
  check(posts.length === 1, "out of range year blocked before request");
  await dialog.getByLabel("Tahun terbit", { exact: true }).fill("2026");
  await dialog.getByRole("button", { name: "Simpan buku" }).click();
  await dialog.waitFor({ state: "hidden" });
  check(posts.at(-1).id === null, "create sends null identity");
  await page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: "Buku baru", exact: true }),
    })
    .getByRole("button", { name: "Nonaktifkan", exact: true })
    .click();
  await page.waitForFunction(
    () => !window.booksFixture.rows.some((r) => r.title === "Buku baru"),
  );
  await page
    .getByText("Perubahan berhasil disimpan.", { exact: true })
    .waitFor();
  check(
    posts.at(-1).type === "void" && posts.at(-1).reason.length >= 3,
    "archive retains audited soft-deactivation command",
  );
  await card().getByRole("button", { name: "Ganti PDF" }).click();
  await dialog.getByLabel("Berkas PDF", { exact: true }).setInputFiles({
    name: "new.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdfBytes),
  });
  await dialog
    .getByRole("button", { name: "Unggah dan validasi" })
    .evaluate((e) => {
      e.click();
      e.click();
    });
  await page
    .getByText("PDF berhasil diunggah dan divalidasi.", { exact: true })
    .waitFor();
  check(
    assetPosts.length === 2 &&
      assetPosts[0].kind === "book" &&
      assetPosts[1].action === "finalize",
    "signed PDF upload prepares and finalizes once",
  );
  check(
    (await page.evaluate(() => window.storageUploads)).length === 1,
    "one signed storage upload",
  );
  await card().getByRole("button", { name: "Baca buku" }).click();
  await dialog.locator("canvas").first().waitFor({ timeout: 30000 });
  check(
    await dialog
      .getByLabel("Navigasi halaman")
      .innerText()
      .then((s) => s.includes("/ 25")),
    "actual PDF.js renders 25-page document",
  );
  await geometry(page, "reader 320");
  await a11y(page, "reader 320");
  await dialog
    .getByRole("button", { name: "Halaman berikutnya", exact: true })
    .click();
  await dialog.locator('canvas[aria-label="Halaman 2"]').waitFor();
  check(true, "next PDF page renders");
  await dialog.getByRole("button", { name: "Perbesar", exact: true }).click();
  await geometry(page, "zoom confined to reader");
  await dialog.getByRole("button", { name: "Mode gulir", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Halaman berikutnya", exact: true })
    .click();
  check(
    await dialog
      .getByLabel("Navigasi halaman")
      .innerText()
      .then((s) => s.includes("22–25")),
    "scroll mode chunk stays within document bounds",
  );
  await dialog
    .getByRole("button", { name: "Sesuaikan lebar", exact: true })
    .click();
  await page.setViewportSize({ width: 740, height: 360 });
  await geometry(page, "reader landscape resize");
  await dialog.getByRole("button", { name: "Tampilan standar" }).click();
  check(
    (await dialog.locator("iframe").getAttribute("src")) ===
      "/api/learning/assets/" + id(900),
    "native fallback uses authorized private endpoint",
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  check(
    await card()
      .getByRole("button", { name: "Baca buku" })
      .evaluate((e) => document.activeElement === e),
    "reader restores opener focus",
  );
  await visit();
  await page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Buku 2", exact: true }) })
    .getByRole("button", { name: "Baca buku" })
    .click();
  check(
    (await dialog.locator("iframe").getAttribute("src")) ===
      "https://drive.google.com/file/d/example123/preview",
    "legacy Drive locator has preview fallback",
  );
  check(
    (await dialog.getByText("Sumber eksternal.", { exact: false }).count()) ===
      1,
    "external source clearly identified",
  );
  await page.keyboard.press("Escape");
  await page.getByLabel("Cari judul atau penulis").fill("absent");
  await page.getByRole("button", { name: "Terapkan filter" }).click();
  await page
    .getByRole("heading", { name: "Belum ada buku yang ditampilkan" })
    .waitFor();
  check(true, "filtered empty state is explicit");
  await page.getByRole("button", { name: "Reset filter" }).click();
  await page.locator("article").first().waitFor();
  await visit("large");
  await page.getByRole("button", { name: "Berikutnya", exact: true }).click();
  await page.getByRole("navigation", {name:"Halaman katalog",exact:true}).getByText("Halaman 2 dari 3", {exact:true}).waitFor();
  check(true, "catalog server pagination advances with same scope");
  readFailure = true;
  await page.getByRole("button", { name: "Berikutnya", exact: true }).click();
  await page
    .getByText("Katalog belum dapat dimuat.", { exact: false })
    .waitFor();
  check(
    await page.getByRole("navigation", {name:"Halaman katalog",exact:true}).getByText("Halaman 2 dari 3", {exact:true}).isVisible(),
    "pagination failure retains previous data",
  );
  readFailure = false;
  await geometry(page, "large catalog");
  await visit("readonly");
  check(
    (await page
      .getByRole("button", { name: "Tambah buku", exact: true })
      .count()) === 0,
    "reader role has no admin creation",
  );
  check(
    (await page.getByRole("button", { name: "Edit", exact: true }).count()) ===
      0,
    "reader role has no edit controls",
  );
  await a11y(page, "readonly");
  await visit("empty");
  await a11y(page, "empty");
  check(
    await page
      .getByRole("button", { name: "Berikutnya", exact: true })
      .isDisabled(),
    "empty catalog pagination disabled",
  );
  for (const result of ["stale", "malformed"]) {
    await visit();
    outcome = result;
    await card().getByRole("button", { name: "Edit", exact: true }).click();
    await dialog.getByRole("button", { name: "Simpan buku" }).click();
    await dialog
      .getByRole("button", { name: "Simpan buku", exact: true })
      .waitFor();
    await page.waitForFunction(
      () =>
        document.querySelector(".books-panel")?.getAttribute("aria-busy") ===
        "false",
    );
    check(
      await dialog.getByRole("button", { name: "Simpan buku" }).isDisabled(),
      result + " write blocks blind retry",
    );
    await page.keyboard.press("Escape");
    outcome = "success";
    await page.getByRole("button", { name: "Muat ulang", exact: true }).click();
    await page
      .getByText(
        "Katalog berhasil dimuat ulang. Periksa data sebelum melanjutkan.",
        { exact: true },
      )
      .waitFor();
    check(
      await page
        .getByRole("button", { name: "Tambah buku", exact: true })
        .isEnabled(),
      result + " recovers after explicit reload",
    );
  }
  await visit();
  readFailure = true;
  await card().getByRole("button", { name: "Edit", exact: true }).click();
  await dialog.getByRole("button", { name: "Simpan buku" }).click();
  await page
    .getByText("Perubahan tersimpan, tetapi katalog belum dapat diperbarui.", {
      exact: false,
    })
    .waitFor();
  check(
    await page
      .getByRole("button", { name: "Tambah buku", exact: true })
      .isDisabled(),
    "saved but unreadable catalog blocks duplicate write",
  );
  readFailure = false;
  await visit();
  await page.clock.install();
  outcome = "hang";
  await card().getByRole("button", { name: "Edit", exact: true }).click();
  await dialog.getByRole("button", { name: "Simpan buku" }).click();
  await page.clock.fastForward(31000);
  await dialog
    .getByText("Hasil perubahan belum dapat dipastikan.", { exact: false })
    .waitFor();
  check(
    await dialog.getByRole("button", { name: "Simpan buku" }).isDisabled(),
    "write timeout blocks retry",
  );
  await page.clock.resume();
  check(errors.length === 0, "no JavaScript page errors", errors);
  await writeFile(
    join(out, "browser-results.json"),
    JSON.stringify(
      { status: "passed", checks, errors, axe: axeResults },
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
