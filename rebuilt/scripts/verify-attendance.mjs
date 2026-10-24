/** Isolated Attendance browser regression suite. No real account, API mutation or production data. */
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
  process.env.ATTENDANCE_QA_OUTPUT ??
  join(root, "docs/verification/attendance");
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
  entryPoints: [join(root, "tests/ui/attendance-fixture.tsx")],
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
          path: join(root, "tests/ui/attendance-navigation-shim.ts"),
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Absensi QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
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
  page.on("dialog", (d) => d.accept());
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  let posts = [],
    gets = [],
    reply = "success",
    calendarReply = "success";
  await page.route("**/api/operations/attendance?*", async (route) => {
    const request = route.request(),
      data = await page.evaluate(() => window.attendanceFixture),
      q = new URL(request.url()).searchParams;
    if (request.method() === "GET") {
      gets.push(request.url());
      if (q.has("calendar")) {
        if (calendarReply === "error")
          return route.fulfill({
            status: 503,
            json: { message: "Unavailable" },
          });
        const month = q.get("calendar"),
          student = q.get("studentId");
        data.rows = [
          {
            ...data.rows[0],
            student_id: student,
            date: month + "-02",
            status: "Sakit",
          },
        ];
        data.total = calendarReply === "incomplete" ? 51 : 1;
        data.page = 1;
        data.pageSize = 10000;
        return route.fulfill({ json: { data } });
      }
      if (reply === "read-error")
        return route.fulfill({ status: 503, json: { message: "Unavailable" } });
      data.page = Number(q.get("page") ?? 1);
      data.people = [];
      data.rows = q.get("status") === "Alpha" ? [] : data.rows;
      data.total = q.get("status") === "Alpha" ? 0 : data.total;
      return route.fulfill({ json: { data } });
    }
    posts.push(request.postDataJSON());
    if (reply === "network") return route.abort();
    if (reply === "hang") return;
    if (reply === "slow") await new Promise((r) => setTimeout(r, 700));
    if (["stale", "denied", "invalid", "duplicate"].includes(reply))
      return route.fulfill({
        status: reply === "denied" ? 403 : 409,
        json: {
          code: reply,
          result: { code: reply },
          message: "Perubahan ditolak: " + reply,
        },
      });
    if (reply === "malformed")
      return route.fulfill({
        json: { result: { code: "saved" }, data: { revision: -1 } },
      });
    data.revision = route.request().postDataJSON().revision + 1;
    return route.fulfill({
      json: {
        result: { code: "saved" },
        code: "saved",
        data,
        message: "Perubahan berhasil disimpan.",
      },
    });
  });
  async function visit(mode = "normal", width = 375, height = 812) {
    reply = "success";
    calendarReply = "success";
    posts = [];
    gets = [];
    await page.setViewportSize({ width, height });
    await page.goto(base + "/?mode=" + mode);
    await page.getByRole("heading", { level: 1 }).waitFor();
  }
  const input = () =>
      page.getByRole("region", { name: "Input absensi per kelas" }),
    history = () => page.getByRole("region", { name: "Filter riwayat" }),
    cal = () => page.getByRole("region", { name: "Kalender kehadiran siswa" }),
    dialog = () => page.getByRole("dialog");
  async function prepare() {
    await input().getByLabel("Kelas untuk input").selectOption(id(20));
    await input().getByRole("button", { name: "Tandai semua Hadir" }).click();
  }
  async function bounds(label) {
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
      label + " dialog contained",
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
  ]) {
    await visit(mode, 320, 568);
    await geometry(page, mode + " mobile");
    if (!["loading", "error"].includes(mode))
      await a11y(page, mode + " mobile");
    for (const width of [375, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await geometry(page, mode + " " + width);
    }
    if (mode === "readonly")
      check(
        (await page
          .getByRole("button", { name: "Simpan absensi", exact: true })
          .count()) === 0,
        "readonly no input",
      );
  }
  await visit();
  await prepare();
  const note = input().getByLabel("Keterangan Siswa 1", { exact: true }),
    status = input().getByRole("combobox", {
      name: "Status Siswa 1",
      exact: true,
    });
  await note.fill("Catatan tetap tersimpan");
  await status.selectOption("Izin");
  await input().getByRole("button", { name: "Tandai semua Hadir" }).tap();
  check(
    (await note.inputValue()) === "Catatan tetap tersimpan",
    "all present preserves notes",
  );
  check(
    (await status.inputValue()) === "Hadir",
    "all present updates selected status",
  );
  await input().getByRole("button", { name: "Kosongkan status" }).click();
  check(
    (await note.inputValue()) === "Catatan tetap tersimpan",
    "clear status preserves notes",
  );
  check((await status.inputValue()) === "", "clear status only clears status");
  await input()
    .getByRole("button", { name: "Simpan absensi", exact: true })
    .click();
  check(posts.length === 0, "empty batch never sent");
  await page
    .getByRole("alert")
    .filter({ hasText: "Pilih sedikitnya" })
    .waitFor();
  await status.selectOption("Sakit");
  await input()
    .getByRole("button", { name: "Simpan absensi", exact: true })
    .dblclick();
  await page
    .getByRole("status")
    .filter({ hasText: "Perubahan berhasil" })
    .waitFor();
  check(posts.length === 1, "synchronous duplicate submission locked");
  check(posts[0].command.items.length === 1, "blank statuses omitted");
  check(
    posts[0].command.items[0].notes === "Catatan tetap tersimpan",
    "batch payload retains notes",
  );
  check((await note.inputValue()) === "", "successful save resets draft");
  check((await status.inputValue()) === "", "successful save clears statuses");
  // History filtering must not narrow the independent batch input catalog or calendar.
  await visit();
  await history()
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("Alpha");
  await history().getByRole("button", { name: "Terapkan filter" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Riwayat diperbarui" })
    .waitFor();
  await prepare();
  check(
    (await input().getByRole("combobox").count()) === 3,
    "filtered history retains full selected class roster",
  );
  const excel = page.getByRole("link", { name: "Ekspor Excel" });
  check(
    (await excel.getAttribute("href")).includes("status=Alpha"),
    "export preserves history filter",
  );
  await cal().getByLabel("Siswa / anak").selectOption(id(10));
  await cal().getByRole("button", { name: "Tampilkan kalender" }).click();
  await cal().getByRole("heading", { level: 3 }).waitFor();
  check(
    (await cal().locator("time").count()) === 31,
    "calendar requests all 31 dates",
  );
  check(
    (await cal().getByText("Sakit", { exact: true }).count()) === 1,
    "calendar retains status excluded by history filter",
  );
  check(
    gets.at(-1).includes("calendar=2026-10") &&
      !gets.at(-1).includes("status="),
    "calendar scope independent from history pagination/status",
  );
  check(
    (await cal().getByText("Libur", { exact: true }).count()) === 5,
    "calendar marks Sundays and configured holiday",
  );
  check(
    (await input()
      .getByRole("combobox", { name: "Status Siswa 1", exact: true })
      .inputValue()) === "Hadir",
    "calendar does not reset batch draft",
  );
  await a11y(page, "calendar mobile");
  await geometry(page, "calendar mobile");
  for (const result of ["error", "incomplete"]) {
    calendarReply = result;
    await cal().getByRole("button", { name: "Tampilkan kalender" }).click();
    await cal().getByRole("alert").waitFor();
    check(
      (await cal().locator("time").count()) === 0,
      "calendar " + result + " never displays false unrecorded days",
    );
  }
  // Existing corrections, reason validation, cancellation, focus and small landscape modal.
  await visit();
  await prepare();
  await input()
    .getByLabel("Keterangan Siswa 1", { exact: true })
    .fill("Draft batch dipertahankan");
  const trigger = page
    .getByRole("button", { name: "Koreksi", exact: true })
    .first();
  await trigger.click();
  await dialog().waitFor();
  await bounds("mobile");
  await a11y(page, "correction modal");
  await page.keyboard.press("Tab");
  check(
    await dialog().evaluate((e) => e.contains(document.activeElement)),
    "keyboard focus remains inside dialog",
  );
  await dialog()
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("Alpha");
  await dialog().getByRole("button", { name: "Simpan koreksi" }).click();
  check(posts.length === 0, "correction requires reason");
  await dialog()
    .getByLabel("Alasan koreksi / pembatalan")
    .fill("Ditinjau wali");
  reply = "invalid";
  await dialog().getByRole("button", { name: "Simpan koreksi" }).click();
  await dialog().getByRole("alert").waitFor();
  check(
    await dialog().evaluate((e) => e.contains(document.activeElement)),
    "correction error feedback stays focused inside modal",
  );
  check(
    (await dialog().getByLabel("Alasan koreksi / pembatalan").inputValue()) ===
      "Ditinjau wali",
    "correction failure retains reason",
  );
  reply = "success";
  await dialog().getByRole("button", { name: "Simpan koreksi" }).click();
  await dialog().waitFor({ state: "hidden" });
  check(
    posts[0].command.type === "edit" &&
      posts[0].command.reason === "Ditinjau wali",
    "correction preserves command/reason",
  );
  check(
    (await input()
      .getByLabel("Keterangan Siswa 1", { exact: true })
      .inputValue()) === "Draft batch dipertahankan",
    "correction preserves independent batch draft",
  );
  await trigger.click();
  await dialog()
    .getByLabel("Alasan koreksi / pembatalan")
    .fill("Data duplikat");
  await dialog()
    .getByRole("button", { name: "Batalkan catatan", exact: true })
    .click();
  await dialog().waitFor({ state: "hidden" });
  check(
    posts.at(-1).command.type === "void",
    "void uses existing audit command",
  );
  await trigger.click();
  await dialog()
    .getByLabel("Alasan koreksi / pembatalan")
    .fill("Pemeriksaan ulang");
  reply = "slow";
  await dialog().getByRole("button", { name: "Simpan koreksi" }).click();
  await page.keyboard.press("Escape");
  check(
    (await dialog().count()) === 1,
    "pending correction cannot close via Escape",
  );
  await dialog().waitFor({ state: "hidden" });
  reply = "success";
  await trigger.click();
  await page.setViewportSize({ width: 812, height: 375 });
  await bounds("landscape");
  await page.setViewportSize({ width: 1440, height: 900 });
  await bounds("desktop resize");
  await page.screenshot({ path: join(out, "attendance-desktop.png") });
  await page.setViewportSize({ width: 320, height: 568 });
  await bounds("short mobile");
  const closeButton = dialog().getByRole("button", {
    name: "Tutup",
    exact: true,
  });
  await closeButton.scrollIntoViewIfNeeded();
  const closeBox = await closeButton.boundingBox();
  check(
    closeBox.y >= 0 && closeBox.y + closeBox.height <= 568,
    "short modal footer reachable by scrolling",
  );
  await page.screenshot({ path: join(out, "attendance-mobile.png") });
  await page.keyboard.press("Escape");
  await dialog().waitFor({ state: "hidden" });
  check(
    await trigger.evaluate((e) => e === document.activeElement),
    "Escape returns trigger focus",
  );
  // Draft reset confirmation can be declined.
  await prepare();
  await input().getByLabel("Keterangan Siswa 1", { exact: true }).fill("Draft");
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.dismiss());
  await input().getByLabel("Kelas untuk input").selectOption(id(21));
  check(
    (await input().getByLabel("Kelas untuk input").inputValue()) === id(20),
    "declined class change preserves selection",
  );
  check(
    (await input()
      .getByLabel("Keterangan Siswa 1", { exact: true })
      .inputValue()) === "Draft",
    "declined class change preserves draft",
  );
  page.removeAllListeners("dialog");
  page.on("dialog", (d) => d.accept());
  for (const failure of [
    "stale",
    "denied",
    "network",
    "malformed",
    "invalid",
    "duplicate",
  ]) {
    await visit();
    await prepare();
    reply = failure;
    await input()
      .getByRole("button", { name: "Simpan absensi", exact: true })
      .click();
    await page.getByRole("alert").waitFor();
    const block = ["stale", "denied", "network", "malformed"].includes(failure);
    check(
      (await input()
        .getByRole("button", { name: "Simpan absensi", exact: true })
        .isDisabled()) === block,
      failure + " correct retry policy",
    );
    check(
      (await input()
        .getByRole("combobox", { name: "Status Siswa 1", exact: true })
        .inputValue()) === "Hadir",
      failure + " preserves draft",
    );
  }
  await visit();
  await prepare();
  reply = "slow";
  await input()
    .getByRole("button", { name: "Simpan absensi", exact: true })
    .click();
  check(
    await history()
      .getByRole("button", { name: "Terapkan filter" })
      .isDisabled(),
    "pending write disables competing history read",
  );
  await page
    .getByRole("status")
    .filter({ hasText: "Perubahan berhasil" })
    .waitFor();
  await visit("large");
  await page.getByRole("button", { name: "Berikutnya", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Riwayat diperbarui" })
    .waitFor();
  check(
    (await page.getByText("Halaman 2 dari 3", { exact: true }).count()) === 1,
    "pagination advances",
  );
  reply = "read-error";
  await page.getByRole("button", { name: "Sebelumnya", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Riwayat belum dapat" })
    .waitFor();
  check(
    (await page.getByText("Halaman 2 dari 3", { exact: true }).count()) === 1,
    "failed read retains prior page",
  );
  await visit();
  await prepare();
  await page.clock.install();
  reply = "hang";
  await input()
    .getByRole("button", { name: "Simpan absensi", exact: true })
    .click();
  await page.clock.fastForward(31000);
  await page.clock.resume();
  await page
    .getByRole("alert")
    .filter({ hasText: "Hasil penyimpanan" })
    .waitFor();
  check(
    await input()
      .getByRole("button", { name: "Simpan absensi", exact: true })
      .isDisabled(),
    "30 second timeout locks blind retries",
  );
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
