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
  process.env.REPORTS_QA_OUTPUT ?? join(root, "docs/verification/reports");
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
  entryPoints: [join(root, "tests/ui/reports-fixture.tsx")],
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
          path: join(root, "tests/ui/reports-navigation-shim.ts"),
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rapor QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
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
  page.on("pageerror", (e) => errors.push(String(e)));
  let outcome = "success",
    readFailure = false,
    posts = 0,
    reads = 0;
  let readDelay = 0;
  await page.route("**/api/learning/reports?*", async (route) => {
    const r = route.request(),
      q = new URL(r.url()).searchParams;
    const data = await page.evaluate(() => window.reportsFixture);
    const scope = {
      classId: q.get("classId") ?? undefined,
      semester: Number(q.get("semester") ?? 1),
    };
    if (r.method() === "POST") {
      posts++;
      if (outcome === "network") {
        await route.abort();
        return;
      }
      if (outcome === "malformed") {
        await route.fulfill({ status: 200, json: { message: "Saved" } });
        return;
      }
      if (outcome === "stale") {
        await route.fulfill({
          status: 409,
          json: { code: "stale", message: "Data berubah. Muat ulang." },
        });
        return;
      }
      const body = r.postDataJSON();
      check(
        body.command.type === "publish" &&
          body.command.semester === scope.semester,
        "publish command preserves scope",
      );
      data.revision = route.request().postDataJSON().revision + 1;
      data.rows = data.rows.map((row) =>
        body.command.studentIds.includes(row.student_id)
          ? {
              ...row,
              published: {
                id: row.student_id,
                snapshot: { ...row.draft, draft: false },
                published_at: "2026-10-23",
              },
            }
          : row,
      );
      await page.evaluate((d) => (window.reportsFixture = d), data);
      await route.fulfill({
        status: 200,
        json: {
          code: "saved",
          data: { ...data, extra: { ...data.extra, scope } },
          message: "Data berhasil disimpan.",
        },
      });
      return;
    }
    reads++;
    if (readDelay)
      await new Promise((resolve) => setTimeout(resolve, readDelay));
    if (readFailure) {
      await route.fulfill({ status: 503, json: { message: "Offline" } });
      return;
    }
    if (q.get("format") === "pdf") {
      if (outcome === "pdf-error") {
        await route.fulfill({ status: 503, json: { message: "Offline" } });
        return;
      }
      check(
        q.get("selected")?.length > 0,
        "PDF carries explicit student selection",
      );
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        body: Buffer.from("%PDF-1.4\n%%EOF"),
      });
      return;
    }
    data.semester = scope.semester;
    data.rows = data.rows.map((row) => ({
      ...row,
      draft: row.draft
        ? {
            ...row.draft,
            semester: scope.semester,
            class: { ...row.draft.class, id: scope.classId },
          }
        : null,
      published: row.published
        ? {
            ...row.published,
            snapshot: {
              ...row.published.snapshot,
              semester: scope.semester,
              class: { ...row.published.snapshot.class, id: scope.classId },
            },
          }
        : null,
    }));
    await route.fulfill({
      status: 200,
      json: { data: { ...data, extra: { ...data.extra, scope } } },
    });
  });
  async function open(mode = "normal", width = 1440, height = 900) {
    await page.setViewportSize({ width, height });
    await page.goto(base + "/?mode=" + mode);
    await page.getByRole("heading", { name: "Rapor", exact: true }).waitFor();
    await page
      .getByRole("combobox", { name: "Kelas / tahun ajaran" })
      .selectOption("00000000-0000-4000-8000-000000000030");
    await page.getByRole("button", { name: "Tampilkan", exact: true }).click();
    await page
      .getByText("Data rapor diperbarui.", { exact: true })
      .waitFor()
      .catch(() => {});
  }
  for (const [width, height] of [
    [320, 740],
    [768, 1024],
    [1440, 900],
  ]) {
    await open("normal", width, height);
    await geometry(page, "reports " + width);
    await a11y(page, "reports " + width);
    check(
      (await page.getByText("Draf belum lengkap", { exact: true }).count()) ===
        1,
      "incomplete draft identified " + width,
    );
    check(
      (await page.getByText("Tidak tersedia", { exact: true }).count()) === 1,
      "null draft not mislabeled published " + width,
    );
    await page
      .getByRole("combobox", { name: "Jenis rapor" })
      .selectOption("Praktik");
    check(
      (await page.locator("td").filter({ hasText: /^0$/ }).count()) > 0,
      "practice zero retained " + width,
    );
    await page
      .getByRole("combobox", { name: "Jenis rapor" })
      .selectOption("combined");
    await page.getByRole("textbox", { name: "Cari siswa" }).fill("siswa-4");
    if (width === 320) {
      await page.getByRole("checkbox").tap();
      check(
        await page.getByRole("checkbox").isChecked(),
        "touch selects student",
      );
    } else await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Terbitkan pilihan", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
    check(
      await dialog.evaluate((e) => e.contains(document.activeElement)),
      "keyboard focus remains in modal " + width,
    );
    await geometry(page, "confirm " + width);
    await a11y(page, "confirm " + width);
    check(
      await page
        .getByRole("button", { name: "Konfirmasi penerbitan" })
        .isDisabled(),
      "confirmation acknowledgement required " + width,
    );
    await dialog.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Konfirmasi penerbitan" })
      .scrollIntoViewIfNeeded();
    const box = await page
      .getByRole("button", { name: "Konfirmasi penerbitan" })
      .boundingBox();
    check(
      box && box.y >= 0 && box.y + box.height <= height,
      "modal footer reachable " + width,
    );
    await page.keyboard.press("Escape");
    await dialog.waitFor({state:"hidden"});
    await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==="Terbitkan pilihan");
    check((await dialog.count()) === 0, "Escape closes modal " + width);
    check(
      await page
        .getByRole("button", { name: "Terbitkan pilihan", exact: true })
        .evaluate((e) => e === document.activeElement),
      "focus restored " + width,
    );
    if (width === 320) {
      await page.screenshot({
        path: join(out, "rapor-mobile.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 740, height: 320 });
      await geometry(page, "orientation landscape");
    }
    if (width === 1440)
      await page.screenshot({
        path: join(out, "rapor-desktop.png"),
        fullPage: true,
      });
  }
  await open("normal");
  await page.getByRole("textbox", { name: "Cari siswa" }).fill("siswa-4");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Terbitkan pilihan", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("checkbox").check();
  const before = posts;
  await page
    .getByRole("button", { name: "Konfirmasi penerbitan" })
    .evaluate((e) => {
      e.click();
      e.click();
    });
  await page.getByText("Data berhasil disimpan.", { exact: true }).waitFor();
  check(posts === before + 1, "double click publishes once");
  check(
    (await page.getByRole("dialog").count()) === 0,
    "successful publish closes dialog",
  );
  await page.getByRole("textbox", { name: "Cari siswa" }).fill("");
  await page
    .getByRole("button", { name: "Unduh rapor Siswa 1", exact: true })
    .click();
  await page.getByText("PDF berhasil disiapkan.", { exact: true }).waitFor();
  check(true, "single PDF success feedback");
  outcome = "pdf-error";
  await page
    .getByRole("button", { name: "Unduh rapor Siswa 1", exact: true })
    .click();
  await page
    .getByText("PDF belum dapat diunduh. Periksa pilihan dan coba kembali.", {
      exact: true,
    })
    .waitFor();
  check(true, "PDF failure feedback");
  outcome = "success";
  readDelay = 500;
  await page.getByRole("button", { name: "Tampilkan", exact: true }).click();
  check(
    await page
      .getByRole("button", { name: "Memuat…", exact: true })
      .isDisabled(),
    "loading disables concurrent read",
  );
  await page.getByText("Data rapor diperbarui.", { exact: true }).waitFor();
  readDelay = 0;
  readFailure = true;
  await page.getByRole("button", { name: "Tampilkan", exact: true }).click();
  await page
    .getByText(
      "Data rapor belum dapat dimuat. Periksa koneksi lalu coba kembali.",
      { exact: true },
    )
    .waitFor();
  check(
    (await page.getByText("Siswa 1", { exact: true }).count()) > 0,
    "failed read retains previous data",
  );
  readFailure = false;
  await open("large");
  check(
    (await page.locator('section[aria-label^="Rapor "]').count()) === 10,
    "large data paginated",
  );
  await page.getByRole("button", { name: "Berikutnya" }).click();
  check(
    (await page.getByText(/Halaman 2 dari 4/).count()) === 1,
    "pagination advances",
  );
  await geometry(page, "large data");
  await page.getByRole("textbox", { name: "Cari siswa" }).fill("no match");
  check(
    (await page
      .getByText("Tidak ada rapor sesuai filter dan hak akses Anda.", {
        exact: true,
      })
      .count()) > 0,
    "search empty state",
  );
  await open("readonly");
  check(
    (await page
      .getByRole("button", { name: "Terbitkan pilihan", exact: true })
      .count()) === 0,
    "read-only role has no publish action",
  );
  await a11y(page, "readonly");
  await page.goto(base + "/?mode=empty");
  await page
    .getByRole("combobox", { name: "Kelas / tahun ajaran" })
    .selectOption("00000000-0000-4000-8000-000000000030");
  await page.getByRole("button", { name: "Tampilkan", exact: true }).click();
  await page.waitForTimeout(100);
  check(
    await page
      .getByRole("button", { name: "Unduh PDF hasil filter" })
      .isDisabled(),
    "empty data disables export",
  );
  await geometry(page, "empty");
  for (const failure of ["network", "malformed", "stale"]) {
    outcome = failure;
    await open("normal");
    await page.getByRole("textbox", { name: "Cari siswa" }).fill("siswa-4");
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Terbitkan pilihan", exact: true })
      .click();
    await page.getByRole("dialog").getByRole("checkbox").check();
    const count = posts;
    await page.getByRole("button", { name: "Konfirmasi penerbitan" }).click();
    await page
      .getByRole("button", { name: "Muat ulang untuk memeriksa hasil" })
      .waitFor();
    check(
      await page
        .getByRole("button", { name: "Konfirmasi penerbitan" })
        .isDisabled(),
      failure + " blocks blind retry",
    );
    check(posts === count + 1, failure + " one request");
  }
  check(errors.length === 0, "no JavaScript page errors", errors);
  check(reads > 0, "real UI performs scoped reads");
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
