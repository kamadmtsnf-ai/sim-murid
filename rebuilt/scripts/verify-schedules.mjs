/** Isolated Schedules tab/modal browser regression suite. No real account, API mutation or production data. */
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
  process.env.SCHEDULES_QA_OUTPUT ??
  join(root, "docs/verification/schedules-tabs");
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
  entryPoints: [join(root, "tests/ui/schedules-fixture.tsx")],
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
          path: join(root, "tests/ui/schedules-navigation-shim.ts"),
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
  await page.route("**/api/schedules?*", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (reply === "network") return route.abort();
    if (reply === "hang") return;
    if (reply === "slow") await new Promise((r) => setTimeout(r, 700));
    if (["overlap", "stale", "denied", "invalid_membership"].includes(reply))
      return route.fulfill({
        status: reply === "denied" ? 403 : 409,
        json: {
          code: reply,
          message:
            reply === "overlap"
              ? "Waktu bertabrakan dengan jadwal kelas atau guru."
              : reply === "invalid_membership"
                ? "Siswa tidak terdaftar aktif."
                : "Data berubah. Muat ulang sebelum menyimpan.",
        },
      });
    if (reply === "malformed")
      return route.fulfill({
        status: 200,
        json: { schedules: { revision: -1 } },
      });
    const data = await page.evaluate(() => window.schedulesFixture);
    data.revision++;
    await route.fulfill({
      status: 200,
      json: { code: "saved", schedules: data, message: "Data berhasil disimpan." },
    });
  });
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  async function visit(
    mode = "normal",
    width = 375,
    height = 812,
    view = "kbm",
  ) {
    reply = "success";
    requests = [];
    await page.setViewportSize({ width, height });
    await page.goto(base + "/?mode=" + mode + "&view=" + view);
    await page.getByRole("heading", { level: 1 }).waitFor();
  }
  const dialog = () => page.getByRole("dialog");
  async function tab(value) {
    await page
      .getByRole("tab", {
        name: value === "kbm" ? "Jadwal KBM" : "Jadwal Piket",
        exact: true,
      })
      .click();
  }
  async function open(kind = "kbm") {
    await tab(kind);
    await page
      .getByRole("button", {
        name: kind === "kbm" ? "Input Jadwal KBM" : "Input Jadwal Piket",
        exact: true,
      })
      .click();
    await dialog().waitFor();
  }
  async function lesson() {
    await dialog().locator("select[name=classId]").selectOption(id(20));
    await dialog().locator("select[name=subjectId]").selectOption(id(50));
    await dialog().locator("select[name=teacherId]").selectOption(id(30));
  }
  async function duty(cls = id(20)) {
    await dialog()
      .getByRole("combobox", { name: "Kelas untuk piket", exact: true })
      .selectOption(cls);
  }
  async function bounds(name) {
    const r = await dialog().evaluate((e) => {
      const r = e.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        client: e.clientWidth,
        scroll: e.scrollWidth,
      };
    });
    check(
      r.x >= -1 &&
        r.y >= -1 &&
        r.right <= r.viewportWidth + 1 &&
        r.bottom <= r.viewportHeight + 1 &&
        r.scroll <= r.client + 1,
      name + " dialog contained",
      r,
    );
  }
  for (const mode of [
    "normal",
    "empty",
    "large",
    "readonly",
    "loading",
    "error",
  ])
    for (const width of [320, 768, 1440]) {
      await visit(mode, width);
      await geometry(page, mode + " " + width);
      if (width === 320) await a11y(page, mode);
      if (!["loading", "error"].includes(mode)) {
        await tab("piket");
        await geometry(page, mode + " piket " + width);
        check(
          (await page
            .getByRole("tabpanel", { name: "Jadwal Piket", exact: true })
            .count()) === 1,
          mode + " piket panel " + width,
        );
        if (mode === "readonly")
          check(
            (await page
              .getByRole("button", { name: /Input Jadwal/ })
              .count()) === 0,
            "readonly hides input actions " + width,
          );
      }
    }
  for (const width of [320, 375, 768, 1440])
    for (const kind of ["kbm", "piket"]) {
      await visit("large", width, width === 320 ? 568 : 812);
      await open(kind);
      if (kind === "piket") await duty();
      await bounds(kind + " " + width);
      await a11y(page, kind + " modal " + width);
      await dialog()
        .getByRole("button", { name: "Batal", exact: true })
        .scrollIntoViewIfNeeded();
      check(
        await dialog()
          .getByRole("button", { name: "Batal", exact: true })
          .isVisible(),
        kind + " footer reachable " + width,
      );
      await page.keyboard.press("Escape");
      await dialog().waitFor({ state: "hidden" });
      check(
        await page
          .getByRole("button", {
            name: kind === "kbm" ? "Input Jadwal KBM" : "Input Jadwal Piket",
            exact: true,
          })
          .evaluate((e) => e === document.activeElement),
        kind + " restores trigger focus " + width,
      );
    }
  await visit();
  check(
    (await page.getByRole("dialog").count()) === 0 &&
      (await page.locator("select[name=classId]").count()) === 0,
    "forms unmounted until opened",
  );
  check((await page.getByRole("table").count()) === 1, "KBM tab shows lessons");
  await page.getByRole("tab", { name: "Jadwal KBM", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(
    () =>
      document.querySelector("[role=tab][data-state=active]")?.textContent ===
      "Jadwal Piket",
  );
  check(
    (await page
      .getByRole("tab", { name: "Jadwal Piket", exact: true })
      .getAttribute("aria-selected")) === "true",
    "arrow key activates Piket tab",
  );
  check(
    (await page.getByRole("table").count()) === 0,
    "Piket hides lesson table",
  );
  check(
    (await page.locator("input[name=view]").inputValue()) === "piket",
    "filter GET retains active tab",
  );
  await page.keyboard.press("Home");
  await page.waitForFunction(
    () =>
      document.querySelector("[role=tab][data-state=active]")?.textContent ===
      "Jadwal KBM",
  );
  check(
    (await page
      .getByRole("tab", { name: "Jadwal KBM", exact: true })
      .getAttribute("aria-selected")) === "true",
    "Home activates first tab",
  );
  await page
    .getByRole("checkbox", { name: "Pilih IPA VII A Senin", exact: true })
    .tap();
  await tab("piket");
  check(
    (await page
      .getByRole("button", { name: /Hapus .* jadwal terpilih/ })
      .count()) === 0,
    "tab switch clears hidden lesson selection",
  );
  await tab("kbm");
  check(
    !(await page
      .getByRole("checkbox", { name: "Pilih IPA VII A Senin", exact: true })
      .isChecked()),
    "returning tab starts with no old selection",
  );
  await open();
  await lesson();
  await dialog().getByLabel("Istirahat (menit)", { exact: true }).fill("15");
  check(
    (await dialog().getByText("08:35", { exact: true }).count()) === 1,
    "computed time retains break",
  );
  await dialog().getByLabel("Waktu mulai", { exact: true }).fill("23:50");
  check(
    await dialog()
      .getByRole("button", { name: "Simpan pelajaran", exact: true })
      .isDisabled(),
    "cross-midnight cannot submit",
  );
  await dialog().getByLabel("Waktu mulai", { exact: true }).fill("07:00");
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.dismiss());
  await page.keyboard.press("Escape");
  check(
    (await dialog().count()) === 1,
    "dirty Escape cancellation retains modal",
  );
  check(
    (await dialog()
      .getByLabel("Istirahat (menit)", { exact: true })
      .inputValue()) === "15",
    "dirty cancellation retains values",
  );
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.accept());
  reply = "slow";
  await dialog()
    .getByRole("button", { name: "Simpan pelajaran", exact: true })
    .click();
  await page.keyboard.press("Escape");
  check((await dialog().count()) === 1, "pending modal cannot close");
  check(
    await dialog()
      .getByRole("button", { name: "Simpan pelajaran", exact: true })
      .isDisabled(),
    "pending disables submit",
  );
  await dialog().waitFor({ state: "hidden" });
  await page.getByText("Data berhasil disimpan.", { exact: true }).waitFor();
  check(
    requests.length === 1 && requests[0].command.breakMinutes === 15,
    "confirmed lesson saves once and closes modal",
  );
  await page.getByRole("button", { name: "Edit", exact: true }).focus();
  await page.keyboard.press("Enter");
  await dialog().waitFor();
  check(
    (await dialog()
      .getByRole("heading", { name: "Edit Jadwal KBM", exact: true })
      .count()) === 1,
    "keyboard Edit uses same modal",
  );
  check(
    (await dialog()
      .getByLabel("Istirahat (menit)", { exact: true })
      .inputValue()) === "15",
    "edit retains original break",
  );
  await page.keyboard.press("Escape");
  await dialog().waitFor({ state: "hidden" });
  // Radix restores focus after unmount; hidden alone does not await autofocus.
  await page.waitForFunction(() => Array.from(document.querySelectorAll("button")).some(e => e.textContent === "Edit" && e === document.activeElement));
  check(
    await page
      .getByRole("button", { name: "Edit", exact: true })
      .evaluate((e) => e === document.activeElement),
    "edit close restores row trigger",
  );
  await visit();
  await open("piket");
  await duty();
  check(
    (await dialog().locator("input[name=assignment]:checked").count()) === 2,
    "day filter still loads all-week duty roster",
  );
  check(
    (await dialog()
      .getByText(/penugasan lama untuk siswa nonaktif/)
      .count()) === 1,
    "inactive cleanup explicit",
  );
  await dialog().locator("input[name=assignment]").first().uncheck();
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.dismiss());
  await duty(id(22));
  check(
    (await dialog()
      .getByRole("combobox", { name: "Kelas untuk piket", exact: true })
      .inputValue()) === id(20),
    "dirty class-switch cancellation preserves class",
  );
  check(
    !(await dialog().locator("input[name=assignment]").first().isChecked()),
    "dirty class-switch preserves choices",
  );
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.accept());
  await duty(id(22));
  check(
    (await dialog()
      .getByText("Belum ada siswa aktif di kelas ini.", { exact: true })
      .count()) === 1,
    "empty student state shown",
  );
  await duty();
  await dialog()
    .getByRole("button", { name: "Simpan seluruh piket kelas", exact: true })
    .click();
  await dialog().waitFor({ state: "hidden" });
  check(
    requests.length === 1 &&
      requests[0].command.items.some((x) => x.weekday === 7),
    "full-week duties retain Sunday on save",
  );
  check(
    requests[0].command.items.every((x) => x.studentId !== id(102)),
    "inactive student cannot be assigned",
  );
  await visit();
  await open("piket");
  await duty();
  while (await dialog().locator("input[name=assignment]:checked").count())
    await dialog().locator("input[name=assignment]:checked").first().uncheck();
  await dialog()
    .getByRole("button", { name: "Simpan seluruh piket kelas", exact: true })
    .click();
  await dialog().waitFor({ state: "hidden" });
  check(
    requests[0].command.items.length === 0,
    "explicit empty roster remains supported",
  );
  for (const failure of [
    "overlap",
    "stale",
    "denied",
    "network",
    "malformed",
  ]) {
    await visit();
    await open();
    await lesson();
    reply = failure;
    await dialog()
      .getByRole("button", { name: "Simpan pelajaran", exact: true })
      .click();
    await dialog().getByRole("alert").waitFor();
    check(
      await dialog()
        .getByRole("alert")
        .evaluate((e) => e === document.activeElement),
      failure + " feedback focused inside modal",
    );
    check(
      (await dialog()
        .getByRole("button", { name: "Simpan pelajaran", exact: true })
        .isDisabled()) ===
        (failure !== "overlap"),
      failure + " correct retry lock",
    );
    check(
      (await dialog().locator("select[name=classId]").inputValue()) === id(20),
      failure + " values retained",
    );
    if (failure !== "overlap")
      check(
        await dialog()
          .getByRole("button", { name: "Muat ulang", exact: true })
          .isEnabled(),
        failure + " reload reachable inside trap",
      );
    check(requests.length === 1, failure + " no automatic retry");
  }
  await visit();
  await open();
  await lesson();
  reply = "hang";
  await page.clock.install();
  await dialog()
    .getByRole("button", { name: "Simpan pelajaran", exact: true })
    .click();
  for (let attempt = 0; requests.length === 0 && attempt < 100; attempt++) await new Promise(r => setTimeout(r, 10));
  check(requests.length === 1, "timeout request observed before advancing clock");
  await page.clock.fastForward(31000);
  await page.clock.resume();
  await dialog().getByRole("alert").waitFor();
  check(
    await dialog()
      .getByRole("button", { name: "Simpan pelajaran", exact: true })
      .isDisabled(),
    "30-second timeout retains write lock",
  );
  check(requests.length === 1, "timeout performs no automatic retry");
  await visit("unavailable");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  check(
    (await dialog().locator("select[name=subjectId]").inputValue()) === "" &&
      (await dialog().locator("select[name=teacherId]").inputValue()) === "",
    "inactive references require active choice",
  );
  await page.keyboard.press("Escape");
  await visit();
  await page
    .getByRole("combobox", { name: "Tahun ajaran", exact: true })
    .selectOption(id(11));
  check(
    await page
      .locator("select[name=class] option")
      .allTextContents()
      .then(
        (a) =>
          a.some((x) => x.includes("VII Lama")) &&
          !a.some((x) => x.includes("VII A")),
      ),
    "year-scoped filter choices preserved",
  );
  for (const kind of ["kbm", "piket"]) {
    await visit();
    await tab(kind);
    await page
      .getByRole("checkbox", {
        name:
          kind === "kbm" ? "Pilih IPA VII A Senin" : new RegExp("Pilih piket"),
      })
      .first()
      .check();
    await page
      .getByRole("button", { name: "Hapus 1 jadwal terpilih", exact: true })
      .click();
    await page.getByText("Data berhasil disimpan.", { exact: true }).waitFor();
    check(
      requests.length === 1 &&
        requests[0].command.lessonIds.length === (kind === "kbm" ? 1 : 0) &&
        requests[0].command.dutyIds.length === (kind === "piket" ? 1 : 0),
      kind + " delete only visible domain",
    );
  }
  await visit("normal", 320, 568, "piket");
  check(
    (await page
      .getByRole("tab", { name: "Jadwal Piket", exact: true })
      .getAttribute("aria-selected")) === "true",
    "initial Piket view preserved",
  );
  await open("piket");
  await duty();
  await page.setViewportSize({ width: 812, height: 375 });
  await bounds("landscape resize");
  await page.setViewportSize({ width: 1440, height: 900 });
  await bounds("desktop resize");
  await page.keyboard.press("Tab");
  check(
    await dialog().evaluate((e) => e.contains(document.activeElement)),
    "keyboard focus stays in dialog",
  );
  await page.screenshot({
    path: join(out, "piket-desktop.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.screenshot({
    path: join(out, "piket-mobile.png"),
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await visit("normal", 1440, 900);
  await open();
  await page.screenshot({
    path: join(out, "kbm-desktop.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await bounds("KBM short mobile");
  await page.screenshot({ path: join(out, "kbm-mobile.png"), fullPage: false });
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
          "Actual components with synthetic fixtures/intercepted API writes; authenticated production role UAT not performed.",
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
