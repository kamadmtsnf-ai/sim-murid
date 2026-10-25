import {installConfirmDriver,settleConfirmation} from "./confirm-driver.mjs";
/** Actual Hak akses saya UI with isolated HTTP boundaries. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd();
const out = process.env.BULK_QA_OUTPUT ?? join(root, "docs/verification/bulk");
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
  entryPoints: [join(root, "tests/ui/bulk-fixture.tsx")],
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
          path: join(root, "tests/ui/overview-navigation-shim.ts"),
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Design System QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const checks = [],
  accessibility = [],
  errors = [];
let browser, page;
function check(v, name) {
  checks.push({ name, passed: !!v });
  assert.ok(v, name);
}
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.UI_CHROMIUM_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    hasTouch: true,
    acceptDownloads: true,
  });
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  let mode = "success",
    requests = [],
    release,
    acceptConfirm = false;
  const stored = new Map();
  await installConfirmDriver(page);
  page.on("dialog", (d) =>
    d.type() === "beforeunload" || acceptConfirm ? d.accept() : d.dismiss(),
  );
  await page.route("**/api/bulk-input*", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      scenario = mode;
    const body = request.method() === "POST" ? request.postDataJSON() : null;
    requests.push({ method: request.method(), body, url: url.search });
    check(
      !url.searchParams.has("actor") && !body?.actor,
      "caller identity never supplied by browser",
    );
    if (url.searchParams.get("catalog") === "1")
      return route.fulfill({
        json: {
          catalog: {
            classId: url.searchParams.get("classId"),
            domain: url.searchParams.get("domain"),
            people: [
              { username: "001-02", name: "Siswa QA" },
              { username: "guru-01", name: "Guru QA" },
            ],
            subjects: [{ code: "IPS", name: "IPS" }],
          },
        },
      });
    if (request.method() === "GET")
      return route.fulfill({
        json: {
          result: stored.get(url.searchParams.get("requestId")) ?? {
            code: "not_found",
          },
        },
      });
    const count = await page.evaluate(
        ({ csv, domain }) => window.bulkCount(csv, domain),
        body,
      ),
      rows = Array.from({ length: count }, (_, i) => ({
        row: i + 2,
        code: body.action === "preview" ? "valid" : "saved",
      }));
    const result = {
      code: body.action === "preview" ? "ready" : "saved",
      revision: 7,
      requestId: body.requestId,
      rows,
    };
    if (body.action === "preview") {
      if (scenario === "preview-error")
        return route.fulfill({
          status: 503,
          json: { message: "Pratinjau belum tersedia." },
        });
      if (scenario === "invalid")
        return route.fulfill({
          status: 409,
          json: {
            result: {
              code: "invalid",
              revision: 7,
              rows: rows.map((r, i) => ({
                ...r,
                code: i === count - 1 ? "overlap" : "not_saved",
              })),
            },
          },
        });
      return route.fulfill({ json: { result } });
    }
    if (scenario === "hold" || scenario === "timeout")
      await new Promise((r) => (release = r));
    if (["401", "403"].includes(scenario))
      return route.fulfill({ status: Number(scenario), body: "not-json" });
    if (scenario === "stale")
      return route.fulfill({
        status: 409,
        json: { result: { code: "stale" } },
      });
    if (scenario === "lost") {
      stored.set(body.requestId, result);
      return route.abort();
    }
    if (scenario === "offline") return route.abort();
    if (scenario === "wrong-ack")
      return route.fulfill({
        json: {
          result: {
            ...result,
            requestId: "00000000-0000-4000-8000-000000000088",
          },
        },
      });
    if (scenario === "partial")
      return route.fulfill({
        json: { result: { ...result, rows: rows.slice(0, 1) } },
      });
    stored.set(body.requestId, result);
    return route.fulfill({ json: { result } });
  });
  const csvs = {
    enrollment: "username\n001-02\n1-2\n",
    grades: "username,value,notes\n001-02,0,\n1-2,,Belum diisi\n",
    schedules:
      "teacher_username,subject_code,weekday,start,duration_minutes,jtm,break_minutes\nguru-01,IPS,1,07:00,40,1,0\nguru-01,IPS,2,07:00,40,1,0\n",
  };
  const titles = {
    enrollment: "Impor penempatan siswa",
    grades: "Impor nilai",
    schedules: "Impor jadwal KBM",
  };
  async function visit(domain = "enrollment") {
    mode = "success";
    requests = [];
    release = undefined;
    stored.clear();
    await page.goto(base + "/?domain=" + domain);
    await page
      .getByRole("button", { name: titles[domain], exact: true })
      .click();
      await settleConfirmation(page);
    await page.getByRole("dialog").waitFor();
  }
  async function fill(domain = "enrollment", csv = csvs[domain]) {
    if (domain !== "schedules")
      await page
        .getByLabel(
          domain === "grades"
            ? "Tanggal penilaian"
            : "Tanggal mulai penempatan",
          { exact: true },
        )
        .fill("2026-10-24");
    await page.getByLabel("Isi CSV", { exact: true }).fill(csv);
  }
  async function validate() {
    await page
      .getByRole("button", { name: "Validasi dan pratinjau", exact: true })
      .click();
      await settleConfirmation(page);
    await page
      .getByText("Validasi sumber berhasil.", { exact: false })
      .waitFor();
    await page
      .getByRole("button", { name: "Konfirmasi simpan batch", exact: true })
      .waitFor();
  }
  async function confirm() {
    await page.getByLabel("Saya sudah memeriksa", { exact: false }).check();
    await page
      .getByRole("button", { name: "Konfirmasi simpan batch", exact: true })
      .click();
      await settleConfirmation(page);
  }
  async function axeCheck(label) {
    await page.addScriptTag({ content: axe });
    const report = await page.evaluate(() =>
      window.axe.run(document.querySelector("[role=dialog]"), {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      }),
    );
    accessibility.push({ label, violations: report.violations });
    check(report.violations.length === 0, label + " axe");
  }
  for (const domain of ["enrollment", "schedules", "grades"])
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 850 });
      await visit(domain);
      await fill(domain);
      await validate();
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        domain + " " + width + " no page overflow",
      );
      const rect = await page.getByRole("dialog").boundingBox();
      check(
        rect.x >= 8 &&
          rect.x + rect.width <= width - 8 &&
          rect.height <= 850 - 30,
        domain + " " + width + " bounded modal "+JSON.stringify(rect),
      );
      check(
        await page
          .getByRole("button", { name: "Konfirmasi simpan batch", exact: true })
          .isDisabled(),
        domain + " " + width + " explicit confirmation required",
      );
      if (domain !== "schedules")
        check(
          (await page
            .locator("td")
            .getByText("001-02", { exact: true })
            .count()) === 1,
          domain + " " + width + " exact leading zero/minus preview",
        );
      await axeCheck(domain + " " + width);
      await page.screenshot({ path: join(out, `bulk-${domain}-${width}.png`) });
      await confirm();
      await page
        .getByText("Seluruh batch tersimpan.", { exact: false })
        .waitFor();
      check(
        requests.filter((r) => r.body?.action === "commit").length === 1,
        domain + " " + width + " one commit",
      );
      await page
        .getByRole("button", {
          name: "Selesai dan perbarui tampilan",
          exact: true,
        })
        .click();
        await settleConfirmation(page);
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      check(
        await page.evaluate(() => window.bulkDone === 1),
        domain + " " + width + " successful close refreshes parent",
      );
    }
  await visit();
  await page
    .getByRole("button", { name: "Tampilkan referensi kelas", exact: true })
    .click();
    await settleConfirmation(page);
  await page
    .getByText("Referensi username dan kode mapel", { exact: true })
    .waitFor();
  await page
    .getByText("Referensi username dan kode mapel", { exact: true })
    .click();
    await settleConfirmation(page);
  check(
    (await page.getByText("001-02", { exact: true }).count()) === 1,
    "reference catalog preserves exact identity",
  );
  await fill("enrollment", "username\na\na\n");
  check(
    await page
      .getByRole("button", { name: "Validasi dan pratinjau", exact: true })
      .isDisabled(),
    "local duplicate blocks preview",
  );
  check(
    requests.every((r) => r.method === "GET"),
    "duplicate batch never sent to mutation",
  );
  await visit();
  await fill();
  await validate();
  const old = await page.getByLabel("Isi CSV", { exact: true }).inputValue();
  await page
    .getByLabel("Unggah CSV", { exact: true })
    .setInputFiles({
      name: "bad.xlsx",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("bad"),
    });
  check(
    (await page.getByLabel("Isi CSV", { exact: true }).inputValue()) === "",
    "invalid replacement file clears old ready draft",
  );
  check(
    (await page
      .getByRole("button", { name: "Konfirmasi simpan batch", exact: true })
      .count()) === 0,
    "invalid replacement cannot commit old preview",
  );
  await page
    .getByLabel("Unggah CSV", { exact: true })
    .setInputFiles({
      name: "data.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(old),
    });
  await page.waitForFunction(() =>
    document.querySelector("textarea")?.value.includes("001-02"),
  );
  check(true, "UTF8 CSV file uploads without identity conversion");
  await visit();
  await fill();
  mode = "invalid";
  await page
    .getByRole("button", { name: "Validasi dan pratinjau", exact: true })
    .click();
    await settleConfirmation(page);
  await page.getByText("Isian tidak valid", { exact: false }).first().waitFor();
  check(
    (await page
      .getByRole("button", { name: "Konfirmasi simpan batch", exact: true })
      .count()) === 0,
    "source validation failure prevents confirmation",
  );
  check(
    (await page.getByLabel("Isi CSV", { exact: true }).inputValue()).includes(
      "001-02",
    ),
    "failed source validation retains input",
  );
  await visit();
  await fill();
  await validate();
  await page.getByRole("button", { name: "Tutup dialog", exact: true }).click();
  await settleConfirmation(page);
  check(
    await page.getByRole("dialog").isVisible(),
    "cancel discard keeps dirty modal",
  );
  check(
    (await page.getByLabel("Isi CSV", { exact: true }).inputValue()).includes(
      "001-02",
    ),
    "cancel discard keeps CSV",
  );
  acceptConfirm = true;
  await page.getByRole("button", { name: "Tutup dialog", exact: true }).click();
  await settleConfirmation(page);
  acceptConfirm = false;
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  check(
    await page
      .getByRole("button", { name: titles.enrollment, exact: true })
      .evaluate((e) => e === document.activeElement),
    "dialog returns keyboard focus",
  );
  await visit();
  await fill();
  await validate();
  mode = "hold";
  await confirm();
  await page.waitForFunction(
    () =>
      document.querySelector('[role=dialog] button[aria-label="Tutup dialog"]')
        ?.disabled,
  );
  for (let i = 0; !release && i < 100; i++) await page.waitForTimeout(10);
  check(typeof release === "function", "commit reached handler");
  await page.keyboard.press("Escape");
  await settleConfirmation(page);
  check(
    await page.getByRole("dialog").isVisible(),
    "pending commit cannot close modal",
  );
  await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .find((e) => e.textContent === "Konfirmasi simpan batch")
      ?.click(),
  );
  check(
    requests.filter((r) => r.body?.action === "commit").length === 1,
    "double click synchronous lock",
  );
  release();
  await page.getByText("Seluruh batch tersimpan.", { exact: false }).waitFor();
  for (const scenario of ["lost", "offline", "wrong-ack", "partial"]) {
    await visit();
    await fill();
    await validate();
    const id = requests.find((r) => r.body?.action === "preview").body
      .requestId;
    mode = scenario;
    await confirm();
    await page
      .getByText("Hasil penyimpanan belum dapat dipastikan.", { exact: false })
      .waitFor();
    check(
      requests.filter((r) => r.body?.action === "commit").length === 1,
      scenario + " no automatic retry",
    );
    check(
      await page.getByLabel("Isi CSV", { exact: true }).isDisabled(),
      scenario + " uncertain input locked",
    );
    mode = "success";
    await page
      .getByRole("button", { name: "Periksa hasil", exact: true })
      .click();
      await settleConfirmation(page);
    if (scenario === "lost") {
      await page
        .getByText("Seluruh batch tersimpan.", { exact: false })
        .waitFor();
      check(
        requests.filter((r) => r.body?.action === "commit").length === 1,
        "readback confirms lost acknowledgement without resend",
      );
    } else {
      await page
        .getByRole("button", {
          name: "Coba simpan dengan ID sama",
          exact: true,
        })
        .waitFor();
      await page
        .getByRole("button", {
          name: "Coba simpan dengan ID sama",
          exact: true,
        })
        .click();
        await settleConfirmation(page);
      await page
        .getByText("Seluruh batch tersimpan.", { exact: false })
        .waitFor();
      check(
        requests
          .filter((r) => r.body?.action === "commit")
          .every((r) => r.body.requestId === id),
        scenario + " explicit retry preserves original request id and revision",
      );
    }
  }
  for (const code of ["401", "403"]) {
    await visit();
    await fill();
    await validate();
    mode = code;
    await confirm();
    await page
      .getByText("Sesi atau akses berubah.", { exact: false })
      .waitFor();
    check(
      (await page.getByLabel("Isi CSV", { exact: true }).inputValue()) === "",
      code + " clears private draft",
    );
    check(
      (await page
        .getByRole("button", { name: "Konfirmasi simpan batch", exact: true })
        .count()) === 0,
      code + " blocks resubmit",
    );
  }
  await visit();
  await fill();
  await validate();
  mode = "stale";
  await confirm();
  await page
    .getByText("Data berubah; buat pratinjau baru", { exact: false })
    .waitFor();
  check(
    (await page
      .getByRole("button", { name: "Konfirmasi simpan batch", exact: true })
      .count()) === 0,
    "stale revision requires new preview",
  );
  check(
    (await page.getByLabel("Isi CSV", { exact: true }).inputValue()).includes(
      "001-02",
    ),
    "stale keeps draft for review",
  );
  await visit();
  await fill(
    "enrollment",
    "username\n" +
      Array.from({ length: 100 }, (_, i) => "user-" + i).join("\n"),
  );
  await validate();
  check(
    (await page
      .getByRole("navigation", { name: "Halaman pratinjau impor" })
      .count()) === 1,
    "100 rows paginated",
  );
  await page.getByRole("button", { name: "Berikutnya", exact: true }).click();
  await settleConfirmation(page);
  check(
    (await page.getByText("Halaman 2 dari 10", { exact: false }).count()) === 1,
    "preview pagination advances",
  );
  await visit();
  await fill();
  await validate();
  await page.clock.install();
  mode = "timeout";
  await confirm();
  await page.waitForFunction(
    () =>
      document.querySelector('[role=dialog] button[aria-label="Tutup dialog"]')
        ?.disabled,
  );
  await page.clock.fastForward(36000);
  await page
    .getByText("Hasil penyimpanan belum dapat dipastikan.", { exact: false })
    .waitFor();
  check(
    requests.filter((r) => r.body?.action === "commit").length === 1,
    "timeout never repeats commit",
  );
  release();
  await page.clock.resume();
  await page.setViewportSize({ width: 844, height: 390 });
  await visit();
  await fill();
  await validate();
  const landscape = await page.getByRole("dialog").boundingBox();
  check(
    landscape.y >= 0 && landscape.y + landscape.height <= 390,
    "landscape modal stays in viewport",
  );
  check(
    await page.evaluate(() =>
      Object.values(localStorage).every(
        (v) => !v.includes("001-02") && !v.includes("username"),
      ),
    ),
    "CSV and student identities not persisted in browser drafts",
  );
  check(errors.length === 0, "no JavaScript page errors");
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
} catch (e) {
  if (page) { await writeFile(join(out, "page.html"), await page.content()); await page.screenshot({path:join(out,"failure.png")}); }
  await writeFile(
    join(out, "failure.json"),
    JSON.stringify(
      { error: String(e), checks, accessibility, errors },
      null,
      2,
    ),
  );
  throw e;
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
