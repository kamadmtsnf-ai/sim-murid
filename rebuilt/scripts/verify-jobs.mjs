/** Actual Pekerjaan UI with isolated HTTP boundaries. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd();
const out = process.env.JOBS_QA_OUTPUT ?? join(root, "docs/verification/jobs");
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
  entryPoints: [join(root, "tests/ui/jobs-fixture.tsx")],
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pekerjaan QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
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
  const accept = (d) => d.accept();
  page.on("dialog", accept);
  let writes = 0,
    dispatches = 0,
    mode = "ok",
    dispatchMode = "sent",
    lastCommand;
  await page.route("**/api/services/jobs", async (route) => {
    const r = route.request();
    let data = await page.evaluate(() => window.jobsFixture);
    if (r.method() === "POST") {
      writes++;
      lastCommand = r.postDataJSON().command;
      await new Promise((r) => setTimeout(r, 200));
      if (mode === "network") return route.abort("failed");
      data.revision++;
      if (lastCommand.type === "retry") {
        const row = data.rows.find((x) => x.id === lastCommand.id);
        row.status = "queued";
      }
      await page.evaluate((d) => (window.jobsFixture = d), data);
      if (mode === "bad")
        return route.fulfill({ status: 200, json: { message: "Saved", data } });
      if (mode === "503" || mode === "409")
        return route.fulfill({
          status: Number(mode),
          json: { message: "Unavailable" },
        });
      return route.fulfill({
        status: 200,
        json: {
          code: "saved",
          data,
          result:
            lastCommand.type === "retry"
              ? { code: "saved", id: lastCommand.id }
              : {
                  code: "saved",
                  dryRun: lastCommand.dryRun,
                  reminderCandidates: 3,
                  date: "2026-10-23",
                  hourWib: 21,
                },
          message: "Saved",
        },
      });
    }
    return route.fulfill({
      status: mode === "get-error" ? 503 : 200,
      json: { data },
    });
  });
  await page.route("**/api/services/dispatch", async (route) => {
    dispatches++;
    await new Promise((r) => setTimeout(r, 200));
    if (dispatchMode === "network") return route.abort("failed");
    return route.fulfill({
      status: dispatchMode === "unconfirmed" ? 503 : 200,
      json: {
        code: dispatchMode,
        message:
          dispatchMode === "sent"
            ? "Pengiriman diterima penyedia."
            : dispatchMode === "empty"
              ? "Tidak ada pengiriman siap diproses."
              : dispatchMode === "ambiguous"
                ? "Hasil pengiriman ambigu; tidak diulang otomatis."
                : "Pengiriman gagal atau belum dikonfigurasi.",
      },
    });
  });
  const preview = () =>
    page.getByRole("button", { name: "Pratinjau pekerjaan", exact: true });
  const queue = () =>
    page.getByRole("button", { name: "Antrekan pekerjaan", exact: true });
  const dispatch = () =>
    page.getByRole("button", { name: "Proses satu pengiriman", exact: true });
  const refresh = () =>
    page.getByRole("button", { name: "Muat ulang antrean", exact: true });
  async function geometry(label) {
    const s = await page.evaluate(() => ({
      w: innerWidth,
      s: document.documentElement.scrollWidth,
    }));
    check(s.s <= s.w + 1, label + " no horizontal overflow");
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
  async function reload() {
    mode = "ok";
    await refresh().click();
    await page.getByText(/^Antrean diperbarui/).waitFor();
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base);
    await preview().waitFor();
    await geometry("jobs " + width);
    await a11y("jobs " + width);
    await page.getByText(/^Tampilkan riwayat/).click();
    await geometry("expanded history " + width);
    await a11y("expanded history " + width);
    await page.getByText(/^Tampilkan riwayat/).click();
    await page.screenshot({
      path: join(out, "jobs-" + width + ".png"),
      fullPage: false,
      animations: "disabled",
    });
  }
  check(
    await page.getByText("25 hasil · Halaman 1 dari 3").isVisible(),
    "bounded pagination",
  );
  await page.getByRole("button", { name: "Berikutnya", exact: true }).click();
  check(
    await page.getByText("25 hasil · Halaman 2 dari 3").isVisible(),
    "next page",
  );
  await page.getByLabel("Cari peristiwa atau ID").fill("event-24");
  check(
    (await page.locator("li").count()) === 101,
    "search includes one visible queue row plus separate history",
  );
  await page.getByLabel("Cari peristiwa atau ID").fill("not-found");
  check(
    await page.getByText("Tidak ada pengiriman sesuai filter.").isVisible(),
    "search empty state",
  );
  await page.getByLabel("Cari peristiwa atau ID").fill("");
  await page.locator("#jobs-status").selectOption("failed");
  check(
    await page.getByText("5 hasil · Halaman 1 dari 1").isVisible(),
    "status filter",
  );
  check(
    await page
      .getByText("Batas lima percobaan tercapai. Periksa bersama operator.")
      .isVisible(),
    "exhausted attempts explain limit",
  );
  await page.locator("#jobs-channel").selectOption("email");
  check(
    (await page
      .getByRole("button", { name: "Antre ulang", exact: true })
      .count()) === 4,
    "retry only failed eligible rows",
  );
  await page
    .getByRole("button", { name: "Antre ulang", exact: true })
    .first()
    .click();
  await page.getByRole("alertdialog").getByRole("button",{name:"Lanjutkan",exact:true}).click();
  await page.getByText(/^Pekerjaan diantre ulang/).waitFor();
  check(
    lastCommand.type === "retry" && lastCommand.id === id(1),
    "retry correct row",
  );
  await page.locator("#jobs-status").selectOption("ambiguous");
  check(
    (await page
      .getByRole("button", { name: "Antre ulang", exact: true })
      .count()) === 0,
    "ambiguous cannot retry",
  );
  await page.locator("#jobs-status").selectOption("all");
  await page.locator("#jobs-channel").selectOption("all");
  const count = writes;
  await preview().evaluate((e) => {
    e.click();
    e.click();
  });
  await page.getByText(/^Pratinjau 2026/).waitFor();
  check(writes === count + 1, "double click one tick");
  check(lastCommand.dryRun === true, "preview never enqueues");
  page.off("dialog", accept);
  page.once("dialog", (d) => d.dismiss());
  const before = writes;
  await queue().click();
  await page.getByRole("alertdialog").getByRole("button",{name:"Batal",exact:true}).click();
  await page.getByRole("alertdialog").waitFor({state:"hidden"});
  check(writes === before, "cancel queue confirmation");
  page.on("dialog", accept);
  await queue().click();
  await page.getByRole("alertdialog").getByRole("button",{name:"Lanjutkan",exact:true}).click();
  await page.getByText(/^Pemeriksaan dan pengantrean/).waitFor();
  check(lastCommand.dryRun === false, "queue explicit non-preview");
  const beforeDispatch = dispatches;
  await dispatch().evaluate((e) => {
    e.click();
    e.click();
  });
  await page.getByRole("alertdialog").getByRole("button",{name:"Lanjutkan",exact:true}).click();
  await page
    .getByText("Pengiriman diterima penyedia.", { exact: true })
    .waitFor();
  await page.waitForFunction(
    () => !document.querySelector('[aria-busy="true"]'),
  );
  check(dispatches === beforeDispatch + 1, "dispatch shares synchronous lock");
  dispatchMode = "empty";
  await dispatch().click();
  await page.getByRole("alertdialog").getByRole("button",{name:"Lanjutkan",exact:true}).click();
  await page
    .getByText("Tidak ada pengiriman siap diproses.", { exact: true })
    .waitFor();
  await page.waitForFunction(
    () => !document.querySelector('[aria-busy="true"]'),
  );
  check(await preview().isEnabled(), "empty delivery permits next action");
  dispatchMode = "ambiguous";
  await dispatch().click();
  await page.getByRole("alertdialog").getByRole("button",{name:"Lanjutkan",exact:true}).click();
  await page.getByText(/^Hasil pengiriman ambigu/).waitFor();
  check(await queue().isDisabled(), "ambiguous dispatch locks");
  await reload();
  for (const next of ["bad", "503", "409", "network"]) {
    mode = next;
    await preview().click();
    await page.getByText(/^Hasil tindakan belum dapat dipastikan/).waitFor();
    check(await queue().isDisabled(), next + " locks mutation");
    const old = writes;
    await reload();
    check(writes === old, "GET no replay " + next);
  }
  mode = "get-error";
  await refresh().click();
  await page.getByText(/^Antrean belum dapat dimuat/).waitFor();
  check(await dispatch().isDisabled(), "failed refresh locks dispatcher");
  await reload();
  dispatchMode = "unconfirmed";
  await dispatch().click();
  await page.getByRole("alertdialog").getByRole("button",{name:"Lanjutkan",exact:true}).click();
  await page.getByText(/^Hasil tindakan belum dapat dipastikan/).waitFor();
  check(await dispatch().isDisabled(), "unconfirmed provider commit locks");
  await reload();
  await page.setViewportSize({ width: 320, height: 850 });
  const touchWrites = writes;
  await preview().tap();
  await page.getByText(/^Pratinjau 2026/).waitFor();
  check(writes === touchWrites + 1, "mobile touch preview");
  await page.setViewportSize({ width: 844, height: 390 });
  await geometry("landscape");
  await preview().focus();
  await page.keyboard.press("Tab");
  check(
    await queue().evaluate((e) => document.activeElement === e),
    "keyboard action order",
  );
  await page.goto(base + "/?empty=1");
  await preview().waitFor();
  check(
    await page.getByText("Belum ada pengiriman dalam antrean.").isVisible(),
    "empty queue",
  );
  await page.getByText(/^Tampilkan riwayat/).click();
  check(
    await page.getByText("Belum ada riwayat pekerjaan otomatis.").isVisible(),
    "empty history",
  );
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
