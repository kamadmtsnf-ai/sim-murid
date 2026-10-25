import { installConfirmDriver, settleConfirmation } from "./confirm-driver.mjs";
/** Isolated Duty browser regression suite. No real account, API mutation or production data. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd(),
  baseline = process.argv.includes("--baseline");
const out = process.env.DUTY_QA_OUTPUT ?? join(root, "docs/verification/duty");
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
  entryPoints: [join(root, "tests/ui/duty-fixture.tsx")],
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
          path: join(root, "tests/ui/duty-navigation-shim.ts"),
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jadwal QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
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
  let requests = [],
    reply = "success";
  page.on("dialog", (d) => d.accept());
  await installConfirmDriver(page);
  await page.route("**/api/operations/duty?*", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    requests.push(route.request().postDataJSON());
    if (reply === "network") return route.abort();
    if (reply === "hang") return;
    if (reply === "slow") await new Promise((r) => setTimeout(r, 700));
    if (["stale", "denied", "invalid", "duplicate"].includes(reply))
      return route.fulfill({
        status: reply === "denied" ? 403 : 409,
        json: {
          code: reply,
          result: { code: reply },
          message: "Permintaan belum berhasil: " + reply,
        },
      });
    if (reply === "malformed")
      return route.fulfill({
        status: 200,
        json: { result: { code: "saved" }, data: { revision: -1 } },
      });
    const data = await page.evaluate(() => window.dutyFixture);
    data.revision = route.request().postDataJSON().revision + 1;
    return route.fulfill({
      status: 200,
      json: {
        code: "saved",
        result: { code: "saved" },
        data,
        message: "Perubahan berhasil disimpan.",
      },
    });
  });
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const dialog = () => page.getByRole("dialog");
  async function visit(
    mode = "normal",
    width = 375,
    height = 812,
    view = "roster",
  ) {
    reply = "success";
    requests = [];
    await page.setViewportSize({ width, height });
    await page.goto(base + "/?mode=" + mode + "&view=" + view);
    await page.getByRole("heading", { level: 1 }).waitFor();
  }
  async function open(kind = "primary") {
    await page
      .getByRole("button", {
        name:
          kind === "primary"
            ? "Konfirmasi piket utama"
            : kind === "appoint"
              ? "Tunjuk pengganti"
              : "Atur jadwal mingguan",
        exact: true,
      })
      .click();
    await dialog().waitFor();
  }
  async function bounds(name) {
    const r = await dialog().evaluate((e) => {
      const r = e.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        right: r.right,
        bottom: r.bottom,
        vw: innerWidth,
        vh: innerHeight,
        scroll: e.scrollWidth,
        client: e.clientWidth,
      };
    });
    check(
      r.x >= -1 &&
        r.y >= -1 &&
        r.right <= r.vw + 1 &&
        r.bottom <= r.vh + 1 &&
        r.scroll <= r.client + 1,
      name + " modal contained",
      r,
    );
  }
  async function history() {
    await page
      .getByRole("tab", { name: "Riwayat konfirmasi", exact: true })
      .click();
  }
  await visit("inactive");
  check(
    await page
      .getByRole("button", { name: "Konfirmasi piket utama", exact: true })
      .isDisabled(),
    "inactive roster cannot confirm primary",
  );
  check(
    await page
      .getByRole("button", { name: "Tunjuk pengganti", exact: true })
      .isDisabled(),
    "inactive roster cannot appoint substitute",
  );
  check(
    (await page
      .getByText("Tugas Guru Piket tidak aktif", { exact: true })
      .count()) > 0,
    "inactive roster explained",
  );
  check(
    await page
      .getByRole("button", { name: "Atur jadwal mingguan", exact: true })
      .isEnabled(),
    "inactive roster cleanup remains available",
  );
  for (const mode of [
    "normal",
    "empty",
    "large",
    "readonly",
    "loading",
    "error",
  ])
    for (const width of [320, 390, 768, 1440]) {
      await visit(mode, width);
      await geometry(page, mode + " " + width);
      if (width === 320) await a11y(page, mode);
      if (!["loading", "error"].includes(mode)) {
        await history();
        await geometry(page, mode + " history " + width);
        if (mode === "readonly")
          check(
            (await page
              .getByRole("button", {
                name: /Konfirmasi piket utama|Tunjuk pengganti|Atur jadwal mingguan|Kelola/,
              })
              .count()) === 0,
            "readonly has no mutation controls " + width,
          );
      }
    }
  for (const width of [320, 375, 390, 768, 1440])
    for (const kind of ["primary", "appoint", "roster"]) {
      await visit("large", width, width === 320 ? 568 : 812);
      await open(kind);
      if (kind === "roster")
        await dialog()
          .getByRole("combobox", { name: "Guru", exact: true })
          .selectOption(id(30));
      await bounds(kind + " " + width);
      if (width === 320) await a11y(page, kind + " modal");
      await dialog()
        .getByRole("button", { name: "Batal", exact: true })
        .scrollIntoViewIfNeeded();
      check(
        await dialog()
          .getByRole("button", { name: "Batal", exact: true })
          .evaluate((e) => {
            const r = e.getBoundingClientRect();
            return r.top >= 0 && r.bottom <= innerHeight;
          }),
        kind + " footer reachable " + width,
      );
      await page.keyboard.press("Escape");
      await settleConfirmation(page);
      await dialog().waitFor({ state: "hidden" });
      check(
        await page
          .getByRole("button", {
            name:
              kind === "primary"
                ? "Konfirmasi piket utama"
                : kind === "appoint"
                  ? "Tunjuk pengganti"
                  : "Atur jadwal mingguan",
            exact: true,
          })
          .evaluate((e) => e === document.activeElement),
        kind + " return focus " + width,
      );
    }
  await visit();
  await open("roster");
  await dialog()
    .getByRole("combobox", { name: "Guru", exact: true })
    .selectOption(id(30));
  check(
    (await dialog().locator("input[name=weekdays]:checked").count()) === 2,
    "existing weekly days prefilled",
  );
  await dialog().getByLabel("Senin", { exact: true }).tap();
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.dismiss());
  await page.keyboard.press("Escape");
  await settleConfirmation(page);
  check(
    (await dialog().count()) === 1,
    "dirty Escape cancellation retains modal",
  );
  check(
    !(await dialog().getByLabel("Senin", { exact: true }).isChecked()),
    "draft days retained",
  );
  await dialog()
    .getByRole("combobox", { name: "Guru", exact: true })
    .selectOption(id(31));
  await settleConfirmation(page);
  check(
    (await dialog()
      .getByRole("combobox", { name: "Guru", exact: true })
      .inputValue()) === id(30),
    "dirty teacher change cancellation retains teacher",
  );
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.accept());
  reply = "slow";
  await dialog().getByRole("button", { name: "Simpan", exact: true }).click();
  await page.keyboard.press("Escape");
  await settleConfirmation(page);
  check((await dialog().count()) === 1, "pending prevents modal dismissal");
  await dialog().waitFor({ state: "hidden" });
  check(
    requests.length === 1 && requests[0].command.weekdays.join(",") === "4",
    "roster mutation retains unedited day and sends once",
  );
  await visit();
  await open("roster");
  await dialog()
    .getByRole("combobox", { name: "Guru", exact: true })
    .selectOption(id(30));
  while (await dialog().locator("input[name=weekdays]:checked").count())
    await dialog().locator("input[name=weekdays]:checked").first().uncheck();
  await dialog().getByRole("button", { name: "Simpan", exact: true }).click();
  await dialog().waitFor({ state: "hidden" });
  check(
    requests[0].command.weekdays.length === 0,
    "explicit empty roster supported",
  );
  await visit();
  await open("appoint");
  await dialog().locator("select[name=teacherId]").selectOption(id(30));
  await dialog().locator("select[name=replacesId]").selectOption(id(30));
  await dialog().getByRole("button", { name: "Simpan", exact: true }).click();
  await dialog().getByRole("alert").waitFor();
  check(requests.length === 0, "self substitution blocked before network");
  await dialog().locator("select[name=teacherId]").selectOption(id(31));
  await settleConfirmation(page);
  await dialog().getByRole("button", { name: "Simpan", exact: true }).click();
  await dialog().waitFor({ state: "hidden" });
  check(
    requests.length === 1 &&
      requests[0].command.type === "appoint" &&
      requests[0].command.replacesId === id(30),
    "substitute appoint command preserved",
  );
  await visit();
  await open();
  await dialog().locator("select[name=teacherId]").selectOption(id(30));
  await dialog().getByRole("button", { name: "Simpan", exact: true }).click();
  await dialog().waitFor({ state: "hidden" });
  check(
    requests[0].command.type === "primary",
    "primary confirmation preserved",
  );
  await history();
  check(
    (await page
      .getByRole("button", { name: "Kelola", exact: true })
      .count()) === 2,
    "cancelled and historical rows have no correction",
  );
  await page
    .getByRole("button", { name: "Kelola", exact: true })
    .nth(1)
    .focus();
  await page.keyboard.press("Enter");
  await dialog().waitFor();
  check(
    await dialog()
      .locator("select[name=action] option")
      .allTextContents()
      .then((a) => a.join("|") === "Konfirmasi hadir|Batalkan penunjukan"),
    "pending substitute action choices correct",
  );
  await dialog().getByLabel("Alasan", { exact: true }).fill("Hadir diperiksa");
  await dialog().getByRole("button", { name: "Simpan", exact: true }).click();
  await dialog().waitFor({ state: "hidden" });
  check(
    requests.at(-1).command.type === "confirm",
    "confirm existing substitute supported",
  );
  await page
    .getByRole("button", { name: "Kelola", exact: true })
    .first()
    .click();
  check(
    await dialog()
      .locator("select[name=action] option")
      .allTextContents()
      .then((a) => a.join("|") === "Batalkan konfirmasi|Batalkan penunjukan"),
    "confirmed row action choices correct",
  );
  await dialog()
    .getByLabel("Alasan", { exact: true })
    .fill("Konfirmasi dibatalkan");
  await dialog().getByRole("button", { name: "Simpan", exact: true }).click();
  await dialog().waitFor({ state: "hidden" });
  check(
    requests.at(-1).command.type === "unconfirm",
    "unconfirm command supported",
  );
  await page
    .getByRole("button", { name: "Kelola", exact: true })
    .first()
    .click();
  await dialog().locator("select[name=action]").selectOption("cancel");
  await dialog()
    .getByLabel("Alasan", { exact: true })
    .fill("Penunjukan dibatalkan");
  await dialog().getByRole("button", { name: "Simpan", exact: true }).click();
  await dialog().waitFor({ state: "hidden" });
  check(requests.at(-1).command.type === "cancel", "cancel command supported");
  for (const failure of [
    "invalid",
    "duplicate",
    "stale",
    "denied",
    "network",
    "malformed",
  ]) {
    await visit();
    await open();
    await dialog().locator("select[name=teacherId]").selectOption(id(30));
    reply = failure;
    await dialog().getByRole("button", { name: "Simpan", exact: true }).click();
    await dialog()
      .getByRole("alert")
      .or(dialog().getByRole("status"))
      .waitFor();
    check(
      await dialog()
        .getByRole("alert")
        .or(dialog().getByRole("status"))
        .evaluate((e) => e === document.activeElement),
      failure + " feedback inside trap",
    );
    check(
      (await dialog()
        .getByRole("button", { name: "Simpan", exact: true })
        .isDisabled()) === !["invalid", "duplicate"].includes(failure),
      failure + " retry lock",
    );
    check(
      (await dialog().locator("select[name=teacherId]").inputValue()) ===
        id(30),
      failure + " preserves teacher",
    );
    if (!["invalid", "duplicate"].includes(failure))
      check(
        await dialog()
          .getByRole("button", { name: "Muat ulang", exact: true })
          .isEnabled(),
        failure + " reload reachable",
      );
    check(requests.length === 1, failure + " no auto retry");
  }
  await visit();
  await open();
  await dialog().locator("select[name=teacherId]").selectOption(id(30));
  reply = "hang";
  await page.clock.install();
  await dialog().getByRole("button", { name: "Simpan", exact: true }).click();
  await page.clock.fastForward(31000);
  await page.clock.resume();
  await dialog().getByRole("alert").or(dialog().getByRole("status")).waitFor();
  check(
    (await dialog()
      .getByRole("button", { name: "Simpan", exact: true })
      .isDisabled()) && requests.length === 1,
    "timeout locks uncertain write",
  );
  await visit("large", 320, 568, "history");
  check(
    await page
      .getByRole("link", { name: "Berikutnya", exact: true })
      .getAttribute("href")
      .then((h) => h.includes("page=2") && h.includes("view=history")),
    "pagination retains history filters",
  );
  check(
    await page
      .getByRole("link", { name: "Ekspor Excel", exact: true })
      .getAttribute("href")
      .then((h) => h.includes("year=2026") && h.includes("format=xlsx")),
    "export link retains filters",
  );
  check(
    (await page.locator("input[name=view]").inputValue()) === "history",
    "filter retains history view",
  );
  await open("roster");
  await dialog()
    .getByRole("combobox", { name: "Guru", exact: true })
    .selectOption(id(30));
  await page.setViewportSize({ width: 812, height: 375 });
  await bounds("landscape");
  await page.keyboard.press("Tab");
  check(
    await dialog().evaluate((e) => e.contains(document.activeElement)),
    "focus trap retains keyboard",
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await bounds("desktop resize");
  await page.screenshot({ path: join(out, "duty-desktop.png") });
  await page.setViewportSize({ width: 320, height: 568 });
  await bounds("short mobile");
  await page.screenshot({ path: join(out, "duty-mobile.png") });
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
