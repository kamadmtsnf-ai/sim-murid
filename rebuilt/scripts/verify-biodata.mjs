/** Actual Biodata UI with isolated HTTP boundaries. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd();
const out =
  process.env.BIODATA_QA_OUTPUT ?? join(root, "docs/verification/biodata");
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
  entryPoints: [join(root, "tests/ui/biodata-fixture.tsx")],
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Biodata QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
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
  page = await browser.newPage({ hasTouch: true });
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(String(e)));
  let acceptDialogs = true;
  page.on("dialog", (d) => (acceptDialogs ? d.accept() : d.dismiss()));
  let mode = "ok",
    posts = [],
    reads = 0,
    stored,
    preparedCount = 0;
  await page.route("**/api/student-*/**", async (route) => {
    const r = route.request(),
      url = new URL(r.url());
    stored ??= await page.evaluate(() =>
      structuredClone(window.biodataFixture),
    );
    await new Promise((r) => setTimeout(r, 100));
    if (r.method() === "GET") {
      reads++;
      if (mode === "offline-all") return route.abort();
      return route.fulfill({ json: stored });
    }
    const body = r.postDataJSON();
    posts.push(body);
    if (mode === "offline" || mode === "offline-all") return route.abort();
    if (mode === "json") return route.fulfill({ body: "invalid-json" });
    if (mode === "malformed")
      return route.fulfill({ json: { message: "invalid-success" } });
    if (["401", "403", "409", "503"].includes(mode))
      return route.fulfill({
        status: Number(mode),
        json: { message: "Gagal " + mode },
      });
    if (url.pathname.includes("student-profile")) {
      stored.student.data = body.data;
      stored.student.revision++;
      return route.fulfill({
        json: { student: stored.student, message: "Biodata tersimpan." },
      });
    }
    if (body.action === "prepare") {
      const preparedId = id(50 + preparedCount++);
      stored.documents.push({
        id: preparedId,
        kind: body.kind,
        filename: body.filename,
        mime: body.mime,
        size: body.size,
        state: "pending",
        created_at: "2026-10-23T00:00:00Z",
      });
      return route.fulfill({
        json: {
          id: preparedId,
          upload: { path: "synthetic/file.pdf", token: "synthetic-token" },
        },
      });
    }
    if (body.action === "download")
      return route.fulfill({
        json: {
          url: "https://example.org/private/" + body.id,
          mime: body.id === id(10) ? "application/pdf" : "image/png",
          filename:
            "PratinjauNamaBerkas".repeat(12) +
            (body.id === id(10) ? ".pdf" : ".png"),
        },
      });
    if (body.action === "delete")
      stored.documents = stored.documents.filter((d) => d.id !== body.id);
    if (body.action === "finalize")
      stored.documents = stored.documents.map((d) =>
        d.id === body.id ? { ...d, state: "ready" } : d,
      );
    stored.student.revision++;
    return route.fulfill({
      json: { ...stored, message: "Dokumen diperbarui." },
    });
  });
  await page.route("https://example.org/private/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  const button = (name) => page.getByRole("button", { name, exact: true });
  const field = (name) => page.locator("#biodata-" + name);
  async function idle() {
    await page.waitForFunction(
      () => !document.querySelector('[aria-busy="true"]'),
    );
  }
  async function geometry(label) {
    const g = await page.evaluate(() => ({
      w: innerWidth,
      s: document.documentElement.scrollWidth,
    }));
    check(g.s <= g.w + 1, label + " no horizontal overflow");
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
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base);
    await field("NIK").waitFor();
    await geometry("form " + width);
    await a11y("form " + width);
    await button("Dokumen").click();
    await geometry("documents " + width);
    await a11y("documents " + width);
    await page.screenshot({
      path: join(out, "biodata-" + width + ".png"),
      fullPage: true,
    });
  }
  await button("Data siswa").click();
  check(
    (await field("NIK").inputValue()) === "0012345678901234",
    "leading zeros retained",
  );
  check(
    (await field("JumlahSaudara").inputValue()) === "0",
    "zero siblings retained",
  );
  await field("Email").fill("invalid");
  await button("Ayah").click();
  await button("Simpan biodata / draf").click();
  await field("Email").waitFor();
  check(
    (await field("Email").getAttribute("aria-invalid")) === "true",
    "cross-section validation selects invalid field",
  );
  check(
    await field("Email").evaluate((e) => document.activeElement === e),
    "invalid field focused",
  );
  check(posts.length === 0, "invalid data never sent");
  await field("Email").fill("student@example.org");
  const beforeRefresh = reads;
  acceptDialogs = false;
  await button("Muat ulang").click();
  acceptDialogs = true;
  check(
    reads === beforeRefresh &&
      (await field("Email").inputValue()) === "student@example.org",
    "cancel refresh retains unsaved biodata",
  );
  await button("Dokumen").click();
  check(
    await button("Unggah dan validasi").isDisabled(),
    "dirty data blocks upload",
  );
  check(
    await page
      .getByRole("button", { name: "Hapus KK", exact: true })
      .isDisabled(),
    "dirty blocks delete",
  );
  await button("Data siswa").click();
  mode = "offline";
  await button("Simpan biodata / draf").click();
  await idle();
  const requestId = posts.at(-1).requestId;
  check(
    (await field("Email").inputValue()) === "student@example.org",
    "network error preserves draft",
  );
  mode = "ok";
  await button("Simpan biodata / draf").click();
  await idle();
  check(
    posts.at(-1).requestId === requestId,
    "uncertain save reuses request ID",
  );
  const count = posts.length;
  await button("Simpan biodata / draf").evaluate((e) => {
    e.click();
    e.click();
  });
  await idle();
  check(posts.length === count + 1, "synchronous save lock");
  for (const failure of ["401", "403", "409", "503", "json", "malformed"]) {
    mode = failure;
    await field("Hobi").fill("Draf " + failure);
    await button("Simpan biodata / draf").click();
    await idle();
    await page.getByRole("alert").waitFor();
    check(
      (await field("Hobi").inputValue()) === "Draf " + failure,
      failure + " preserves draft",
    );
  }
  mode = "ok";
  await button("Simpan biodata / draf").click();
  await idle();
  await button("Ayah").click();
  await field("AyahStatus").selectOption("Masih Hidup");
  check(
    await field("AyahJalan").isVisible(),
    "father address conditional visible",
  );
  await field("AyahAlamatTinggalLuarNegeri").check();
  check((await field("AyahJalan").count()) === 0, "foreign address hidden");
  await button("Wali").click();
  await field("WaliPilihan").selectOption("Lainnya");
  await field("WaliAlamatStatus").selectOption("Lainnya");
  check(await field("WaliJalan").isVisible(), "other guardian address visible");
  await button("Simpan biodata / draf").click();
  await idle();
  await button("Dokumen").click();
  await page
    .getByRole("button", { name: "Pratinjau KIP", exact: true })
    .click();
  await idle();
  await page
    .getByRole("region", { name: "Pratinjau dokumen", exact: true })
    .waitFor();
  await page.getByRole("slider").fill("200");
  await page.setViewportSize({ width: 320, height: 850 });
  await geometry("image zoom 200%");
  await a11y("preview");
  await button("Tutup pratinjau").click();
  check(
    (await page
      .getByRole("region", { name: "Pratinjau dokumen", exact: true })
      .count()) === 0,
    "preview closes",
  );
  await page.getByRole("button", { name: "Pratinjau KK", exact: true }).click();
  await idle();
  check((await page.locator("iframe").count()) === 1, "PDF iframe preserved");
  await geometry("PDF mobile");
  await button("Tutup pratinjau").click();
  await page.getByRole("button", { name: "Unduh KK", exact: true }).click();
  await idle();
  check(
    (
      await page
        .getByRole("link", { name: /Unduh Pratinjau/ })
        .getAttribute("href")
    ).startsWith("https://"),
    "private signed download link",
  );
  await geometry("long download name");
  await page.locator("#document-file").setInputFiles({
    name: "wrong.png",
    mimeType: "image/png",
    buffer: Buffer.from("bad"),
  });
  let before = posts.length;
  await button("Unggah dan validasi").click();
  await idle();
  check(posts.length === before, "wrong MIME rejected before prepare");
  await page.locator("#document-file").setInputFiles({
    name: "kk.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-synthetic"),
  });
  await page.evaluate(() => (window.storageError = true));
  await button("Unggah dan validasi").click();
  await idle();
  check(reads > 0, "failed upload refreshes pending document list");
  check(
    await button("Unggah dan validasi").isEnabled(),
    "upload failure recovers controls",
  );
  check(
    await page.getByText("kk.pdf", { exact: true }).isVisible(),
    "pending uploaded document visible without page reload",
  );
  await page.evaluate(() => (window.storageError = false));
  await page
    .getByRole("listitem")
    .filter({ has: page.getByText("kk.pdf", { exact: true }) })
    .getByRole("button", { name: "Coba validasi kembali", exact: true })
    .click();
  await idle();
  check(
    await page
      .getByRole("listitem")
      .filter({ has: page.getByText("kk.pdf", { exact: true }) })
      .getByText("Siap", { exact: true })
      .isVisible(),
    "pending finalize recovery",
  );
  await page.locator("#document-kind").selectOption("KIP");
  await page.locator("#document-file").setInputFiles({
    name: "new.png",
    mimeType: "image/png",
    buffer: Buffer.from("%PDF-synthetic"),
  });
  await button("Unggah dan validasi").click();
  await idle();
  check(
    (await page.locator("#document-file").inputValue()) === "",
    "successful upload clears file control",
  );
  check(
    (await page.evaluate(() => window.storageUploads.length)) === 2,
    "direct signed upload boundary called twice",
  );
  check(
    (await page.locator("#document-kind").inputValue()) === "KIP",
    "upload preserves selected kind",
  );
  mode = "offline-all";
  await page
    .getByRole("button", { name: "Hapus KK", exact: true })
    .first()
    .click();
  await idle();
  check(
    await button("Unggah dan validasi").isDisabled(),
    "unknown document state blocks subsequent writes",
  );
  mode = "ok";
  await button("Muat ulang").click();
  await idle();
  check(
    await button("Unggah dan validasi").isEnabled(),
    "manual refresh restores synchronized state",
  );
  await page
    .getByRole("button", { name: "Hapus KK", exact: true })
    .first()
    .click();
  await idle();
  check(posts.at(-1).action === "delete", "delete action preserved");
  await page.setViewportSize({ width: 844, height: 390 });
  await geometry("landscape");
  await button("Data siswa").tap();
  await field("NIK").focus();
  await page.keyboard.press("Tab");
  check(
    await field("TempatLahir").evaluate((e) => document.activeElement === e),
    "keyboard field navigation",
  );
  stored = null;
  await page.goto(base + "/?readonly=1");
  await field("NIK").waitFor();
  check(await field("NIK").isDisabled(), "read-only biodata disabled");
  await button("Dokumen").click();
  check(
    (await button("Unggah dan validasi").count()) === 0,
    "read-only upload absent",
  );
  check(
    (await page.getByRole("button", { name: /^Hapus / }).count()) === 0,
    "read-only delete absent",
  );
  await a11y("readonly");
  await page.goto(base + "/?empty=1");
  await button("Dokumen").click();
  check(
    await page.getByText("Belum ada dokumen", { exact: true }).isVisible(),
    "empty state",
  );
  await a11y("empty");
  await page.goto(base + "/?many=1");
  await button("Dokumen").click();
  check(
    (await page.getByRole("listitem").count()) >= 60,
    "many documents render",
  );
  await geometry("many documents");
  for (const scenario of ["loading", "error"]) {
    await page.goto(base + "/?" + scenario + "=1");
    await page.getByRole("heading", { level: 1 }).waitFor();
    await geometry(scenario);
    await a11y(scenario);
    if (scenario === "error") {
      await button("Coba lagi").click();
      check(
        (await page.locator("html").getAttribute("data-retried")) === "true",
        "error retry works",
      );
    }
  }
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
