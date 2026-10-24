/** Actual Kenaikan dan ijazah UI with isolated Auth/HTTP/Storage boundaries. */
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
  process.env.PROMOTIONS_QA_OUTPUT ??
  join(root, "docs/verification/promotions");
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
  entryPoints: [join(root, "tests/ui/promotions-fixture.tsx")],
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
          path: join(root, "tests/ui/promotions-navigation-shim.ts"),
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Promotions QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
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
  page.on("dialog", (d) => d.accept());
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  let outcome = "success",
    readFailure = false,
    readDelay = 0,
    posts = [],
    assetPosts = [],
    preparedTarget = "",
    preparedSlot = "IJAZAH",
    newId = id(900);
  await page.route("**/api/learning/promotions", async (route) => {
    const r = route.request(),
      data = await page.evaluate(() => window.promotionsFixture);
    if (r.method() === "GET") {
      if (readDelay) await new Promise((r) => setTimeout(r, readDelay));
      await route.fulfill(
        readFailure
          ? { status: 503, json: { message: "Offline" } }
          : { status: 200, json: { data } },
      );
      return;
    }
    const body = r.postDataJSON(),
      c = body.command;
    posts.push(c);
    if (outcome === "hang") return;
    if (outcome === "network") {
      await route.abort();
      return;
    }
    if (outcome === "stale") {
      await route.fulfill({
        status: 409,
        json: { code: "stale", message: "Data berubah. Muat ulang." },
      });
      return;
    }
    if (outcome === "malformed") {
      await route.fulfill({ status: 200, json: { message: "Saved" } });
      return;
    }
    if (c.type === "promote" || c.type === "place")
      data.rows = data.rows.map((row) => {
        const item = c.items.find((i) => i.studentId === row.student_id);
        return item
          ? {
              ...row,
              class_id: item.classId,
              role: item.classId ? "student" : "alumni",
              diploma: item.classId
                ? row.diploma
                : (row.diploma ?? {
                    metadata: {},
                    view_override: "deny",
                    download_override: "deny",
                  }),
            }
          : row;
      });
    if (c.type === "diploma")
      data.rows = data.rows.map((row) =>
        row.student_id === c.studentId
          ? { ...row, diploma: { ...row.diploma, metadata: c.metadata } }
          : row,
      );
    if (c.type === "access") {
      if (c.scope === "global")
        data.extra.access = { allow_view: c.view, allow_download: c.download };
      else
        data.rows = data.rows.map((row) =>
          c.studentIds.includes(row.student_id)
            ? {
                ...row,
                diploma: {
                  ...row.diploma,
                  view_override: c.view,
                  download_override: c.download,
                },
              }
            : row,
        );
    }
    data.revision = route.request().postDataJSON().revision + 1;
    await page.evaluate((d) => (window.promotionsFixture = d), data);
    await route.fulfill({
      status: 200,
      json: {
        result: { code: "saved" },
        code: "saved",
        data,
        message: "Perubahan berhasil disimpan.",
      },
    });
  });
  await page.route("**/api/learning/assets", async (route) => {
    const c = route.request().postDataJSON();
    assetPosts.push(c);
    if (outcome === "asset-network") {
      await route.abort();
      return;
    }
    if (c.action === "prepare") {
      preparedTarget = c.targetId;
      preparedSlot = c.slot;
      await route.fulfill({
        status: 200,
        json: {
          id: newId,
          upload: {
            path: "diploma/" + c.targetId + "/" + newId,
            token: "signed-token",
          },
        },
      });
      return;
    }
    if (outcome === "asset-error") {
      await route.fulfill({ status: 400, json: { message: "Berkas rusak" } });
      return;
    }
    const data = await page.evaluate(() => window.promotionsFixture);
    data.rows = data.rows.map((row) =>
      c.action === "delete"
        ? { ...row, assets: row.assets.filter((a) => a.id !== c.id) }
        : row.student_id === preparedTarget
          ? {
              ...row,
              assets: [
                ...row.assets.filter((a) => a.slot !== preparedSlot),
                {
                  id: newId,
                  slot: preparedSlot,
                  filename: "baru.pdf",
                  mime: "application/pdf",
                },
              ],
            }
          : row,
    );
    await page.evaluate((d) => (window.promotionsFixture = d), data);
    await route.fulfill({
      status: 200,
      json: {
        code: "saved",
        id: c.id,
        action: c.action,
        message: "Berkas berhasil diperbarui.",
      },
    });
  });
  await page.route("**/api/learning/assets/*", async (route) => {
    if (outcome === "download-error")
      await route.fulfill({ status: 403, json: { message: "Denied" } });
    else
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        body: Buffer.from("%PDF-1.4\n%%EOF"),
      });
  });
  async function visit(mode = "normal", width = 1440, height = 900) {
    outcome = "success";
    readFailure = false;
    await page.setViewportSize({ width, height });
    await page.goto(base + "/?mode=" + mode);
    await page
      .getByRole("heading", { name: "Kenaikan dan ijazah", exact: true })
      .waitFor();
  }
  async function source() {
    await page
      .getByRole("combobox", { name: "Tahun ajaran asal", exact: true })
      .selectOption(id(70));
    await page
      .getByRole("combobox", { name: "Tahun ajaran tujuan", exact: true })
      .selectOption(id(71));
  }
  async function documents() {
    await page
      .getByRole("tab", { name: "Alumni & dokumen", exact: true })
      .click();
  }
  async function alumni(n) {
    return page.locator("article").filter({
      has: page.getByRole("heading", { name: "Pengguna " + n, exact: true }),
    });
  }
  async function acknowledge() {
    await page.getByRole("dialog").getByRole("checkbox").check();
  }
  for (const [width, height] of [
    [320, 740],
    [768, 1024],
    [1440, 900],
  ]) {
    await visit("normal", width, height);
    if (width === 1440) {
      await page
        .getByRole("tab", { name: "Kenaikan & penempatan", exact: true })
        .focus();
      await page.keyboard.press("ArrowRight");
      check(
        (await page
          .getByRole("tab", { name: "Alumni & dokumen", exact: true })
          .getAttribute("aria-selected")) === "true",
        "ArrowRight changes tab",
      );
      await page.keyboard.press("ArrowLeft");
      check(
        (await page
          .getByRole("tab", { name: "Kenaikan & penempatan", exact: true })
          .getAttribute("aria-selected")) === "true",
        "ArrowLeft restores mapping tab",
      );
    }
    await source();
    await geometry(page, "mapping " + width);
    await a11y(page, "mapping " + width);
    check(
      (
        await page
          .getByRole("combobox", { name: "Tahun ajaran tujuan", exact: true })
          .locator("option")
          .allTextContents()
      ).includes("2027/2028"),
      "paired target year " + width,
    );
    const box = page.getByRole("checkbox", { name: /^Pengguna 1 / });
    if (width === 320) await box.tap();
    else await box.check();
    const dest = page.getByRole("combobox", {
      name: "Kelas tujuan untuk Pengguna 1",
      exact: true,
    });
    check((await dest.inputValue()) === "", "no implicit graduation " + width);
    const options = await dest.locator("option").allTextContents();
    check(
      options.includes("8A — 2027/2028") &&
        !options.some(
          (s) =>
            s.includes("7 Baru") || s.includes("Arsip") || s.includes("Alumni"),
        ),
      "destination year/level/archive filtered " + width,
    );
    await dest.selectOption(id(31));
    await page
      .getByLabel("Alasan / referensi keputusan")
      .fill("Keputusan rapat");
    await page.getByRole("button", { name: "Tinjau pemetaan" }).click();
    await page.getByRole("dialog").waitFor();
    await geometry(page, "confirm " + width);
    await a11y(page, "confirm " + width);
    check(
      await page
        .getByRole("button", { name: "Konfirmasi simpan" })
        .isDisabled(),
      "ack required " + width,
    );
    for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
    check(
      await page
        .getByRole("dialog")
        .evaluate((e) => e.contains(document.activeElement)),
      "focus trapped " + width,
    );
    await acknowledge();
    await page
      .getByRole("button", { name: "Konfirmasi simpan" })
      .scrollIntoViewIfNeeded();
    const b = await page
      .getByRole("button", { name: "Konfirmasi simpan" })
      .boundingBox();
    check(
      b && b.y >= 0 && b.y + b.height <= height,
      "footer reachable " + width,
    );
    await page.keyboard.press("Escape");
    check(
      await page
        .getByRole("button", { name: "Tinjau pemetaan" })
        .evaluate((e) => e === document.activeElement),
      "focus returned " + width,
    );
    await documents();
    const card = await alumni(4);
    if (width === 320) {
      await card.locator("summary").focus();
      await page.keyboard.press("Enter");
      check(
        await card.locator("details").evaluate((e) => e.open),
        "metadata details keyboard expandable",
      );
    }
    await card
      .getByRole("button", { name: "Edit metadata", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    check(
      (await page.getByLabel("Nomor ijazah", { exact: true }).inputValue()) ===
        "IJAZAH-4",
      "metadata correct target " + width,
    );
    await geometry(page, "metadata " + width);
    await a11y(page, "metadata " + width);
    await page.getByLabel("Nomor ijazah", { exact: true }).fill("BARU");
    await page
      .getByRole("button", { name: "Simpan metadata" })
      .scrollIntoViewIfNeeded();
    const mb = await page
      .getByRole("button", { name: "Simpan metadata" })
      .boundingBox();
    check(
      mb && mb.y >= 0 && mb.y + mb.height <= height,
      "metadata footer reachable " + width,
    );
    if (width === 1440) {
      page.removeAllListeners("dialog");
      page.on("dialog", (d) => d.dismiss());
      await page.keyboard.press("Escape");
      check(
        (await page.getByRole("dialog").count()) === 1,
        "dirty cancellation keeps modal open",
      );
      check(
        (await page
          .getByLabel("Nomor ijazah", { exact: true })
          .inputValue()) === "BARU",
        "dirty cancellation preserves draft",
      );
      page.removeAllListeners("dialog");
      page.on("dialog", (d) => d.accept());
    }
    await page.keyboard.press("Escape");
    await (await alumni(5))
      .getByRole("button", { name: "Edit metadata", exact: true })
      .click();
    check(
      (await page.getByLabel("Nomor ijazah", { exact: true }).inputValue()) ===
        "IJAZAH-5",
      "switch alumni does not reuse previous metadata " + width,
    );
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "Akses ijazah", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Cakupan", exact: true })
      .selectOption("global");
    check(
      await page
        .getByRole("checkbox", { name: "Global boleh mengunduh", exact: true })
        .isChecked(),
      "global existing download prefilled " + width,
    );
    check(
      !(await page
        .getByRole("checkbox", { name: "Global boleh melihat", exact: true })
        .isChecked()),
      "global view independent " + width,
    );
    await geometry(page, "access " + width);
    await a11y(page, "access " + width);
    if (width === 320) {
      await page.setViewportSize({ width: 740, height: 320 });
      await geometry(page, "landscape");
    }
    await page.setViewportSize({ width, height });
    await documents();
    await page.screenshot({
      path: join(out, "promotions-" + width + ".png"),
      fullPage: true,
    });
  }
  await visit();
  await source();
  await page.getByRole("checkbox", { name: /^Pengguna 1 / }).check();
  await page
    .getByRole("combobox", {
      name: "Kelas tujuan untuk Pengguna 1",
      exact: true,
    })
    .selectOption(id(31));
  await page.getByLabel("Alasan / referensi keputusan").fill("Keputusan rapat");
  await page.getByRole("button", { name: "Tinjau pemetaan" }).click();
  await acknowledge();
  const before = posts.length;
  await page
    .getByRole("button", { name: "Konfirmasi simpan" })
    .evaluate((e) => {
      e.click();
      e.click();
    });
  await page
    .getByText("Perubahan berhasil disimpan.", { exact: true })
    .waitFor();
  check(posts.length === before + 1, "double click executes one mapping");
  check(
    posts.at(-1).items[0].expectedClassId === id(30) &&
      posts.at(-1).items[0].classId === id(31),
    "command retains expected source and explicit target",
  );
  await page.getByRole("checkbox", { name: /^Pengguna 2 / }).check();
  await page
    .getByRole("combobox", {
      name: "Kelas tujuan untuk Pengguna 2",
      exact: true,
    })
    .selectOption("alumni");
  await page.getByLabel("Alasan / referensi keputusan").fill("Lulus kelas 9");
  await page.getByRole("button", { name: "Tinjau pemetaan" }).click();
  await acknowledge();
  await page.getByRole("button", { name: "Konfirmasi simpan" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  check(
    posts.at(-1).items[0].classId === null,
    "grade 9 graduates only with explicit alumni target",
  );
  await documents();
  await (await alumni(4))
    .getByRole("button", { name: "Edit metadata", exact: true })
    .click();
  await page.getByLabel("Nomor ijazah", { exact: true }).fill("BARU-4");
  await page.getByRole("button", { name: "Simpan metadata" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  check(
    (await (await alumni(4)).getByText("BARU-4", { exact: true }).count()) ===
      1,
    "metadata save reflected",
  );
  check(posts.at(-1).studentId === id(103), "metadata saves correct alumni");
  await page.getByRole("tab", { name: "Akses ijazah", exact: true }).click();
  await page.getByRole("checkbox", { name: /^Pengguna 4 / }).check();
  await page
    .getByRole("combobox", { name: "Izin melihat", exact: true })
    .selectOption("inherit");
  await page
    .getByRole("combobox", { name: "Izin mengunduh", exact: true })
    .selectOption("deny");
  await page.getByRole("button", { name: "Tinjau pengaturan akses" }).click();
  await acknowledge();
  await page.getByRole("button", { name: "Konfirmasi simpan" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  check(
    posts.at(-1).view === "inherit" && posts.at(-1).download === "deny",
    "individual access independent policies",
  );
  await page
    .getByRole("combobox", { name: "Cakupan", exact: true })
    .selectOption("global");
  await page
    .getByRole("checkbox", { name: "Global boleh melihat", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Global boleh mengunduh", exact: true })
    .uncheck();
  await page.getByRole("button", { name: "Tinjau pengaturan akses" }).click();
  await acknowledge();
  await page.getByRole("button", { name: "Konfirmasi simpan" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  check(
    posts.at(-1).scope === "global" &&
      posts.at(-1).view === true &&
      posts.at(-1).download === false,
    "global access saves separate flags",
  );
  await documents();
  await (await alumni(4))
    .getByRole("button", { name: "Unggah / ganti berkas" })
    .click();
  const assetCount = assetPosts.length;
  await page.getByLabel("Berkas dokumen", { exact: true }).setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a document"),
  });
  await page.getByRole("button", { name: "Unggah dan validasi" }).click();
  check(
    assetPosts.length === assetCount,
    "invalid file rejected before prepare",
  );
  await page.getByLabel("Berkas dokumen", { exact: true }).setInputFiles({
    name: "baru.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4"),
  });
  await page.getByRole("button", { name: "Unggah dan validasi" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  check(
    assetPosts
      .slice(-2)
      .map((c) => c.action)
      .join(",") === "prepare,finalize",
    "upload prepares, transfers and finalizes",
  );
  check(
    (await page.evaluate(() => window.storageUploads.length)) === 1,
    "signed storage upload once",
  );
  check(
    (await (await alumni(4)).getByText(/baru.pdf/).count()) === 1,
    "finalized asset replaces current slot",
  );
  await (await alumni(4))
    .getByRole("button", { name: "Unduh IJAZAH", exact: true })
    .click();
  await page.getByText("Berkas siap diunduh.", { exact: true }).waitFor();
  check(true, "download success feedback");
  outcome = "download-error";
  await (await alumni(4))
    .getByRole("button", { name: "Unduh IJAZAH", exact: true })
    .click();
  await page
    .getByText("Berkas belum dapat diunduh. Periksa akses dan coba kembali.", {
      exact: true,
    })
    .waitFor();
  check(true, "download denied feedback");
  outcome = "success";
  await (await alumni(4))
    .getByRole("button", { name: "Hapus IJAZAH", exact: true })
    .click();
  check(
    await page.getByRole("button", { name: "Konfirmasi hapus" }).isDisabled(),
    "delete requires acknowledgement",
  );
  await acknowledge();
  await page.getByRole("button", { name: "Konfirmasi hapus" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  check(
    (await (await alumni(4))
      .getByRole("button", { name: "Hapus IJAZAH", exact: true })
      .count()) === 0,
    "delete readback removes asset",
  );
  readDelay = 500;
  await page
    .getByRole("button", { name: "Muat ulang data", exact: true })
    .click();
  check(
    await page.getByRole("button", { name: "Memuat…" }).isDisabled(),
    "loading locks reads",
  );
  await page.getByText("Data berhasil diperbarui.", { exact: true }).waitFor();
  readDelay = 0;
  readFailure = true;
  await page
    .getByRole("button", { name: "Muat ulang data", exact: true })
    .click();
  await page
    .getByText("Data belum dapat dimuat. Data sebelumnya tetap ditampilkan.", {
      exact: true,
    })
    .waitFor();
  check(
    (await page.locator("article").count()) > 0,
    "failed read retains snapshot",
  );
  readFailure = false;
  await visit("large");
  await source();
  await page.getByRole("checkbox", { name: /^Pengguna 1 / }).check();
  await page
    .getByRole("combobox", {
      name: "Kelas tujuan untuk Pengguna 1",
      exact: true,
    })
    .selectOption(id(31));
  await page.getByRole("button", { name: "Berikutnya", exact: true }).click();
  check(
    (await page.getByText(/1 siswa dipilih/).count()) === 1,
    "mapping persists across pagination",
  );
  await page.getByRole("button", { name: "Sebelumnya", exact: true }).click();
  check(
    await page.getByRole("checkbox", { name: /^Pengguna 1 / }).isChecked(),
    "selection restored on previous page",
  );
  await page.getByLabel("Cari siswa", { exact: true }).fill("not found");
  check(
    (await page
      .getByText("Tidak ada siswa sesuai tahun ajaran dan pencarian.", {
        exact: true,
      })
      .count()) === 1,
    "search empty state",
  );
  await documents();
  check(
    (await page.locator("article").count()) === 20,
    "alumni pagination limits cards",
  );
  await page.getByRole("button", { name: "Berikutnya", exact: true }).click();
  await geometry(page, "large alumni");
  await page.evaluate(() => {
    window.promotionsFixture.rows = window.promotionsFixture.rows.filter(
      (r) =>
        r.role !== "alumni" ||
        r.student_id === "00000000-0000-4000-8000-000000000103",
    );
  });
  await page
    .getByRole("button", { name: "Muat ulang data", exact: true })
    .click();
  await page.getByText("Data berhasil diperbarui.", { exact: true }).waitFor();
  check(
    await page
      .getByRole("button", { name: "Sebelumnya", exact: true })
      .isDisabled(),
    "pagination resets after refreshed roster shrinks",
  );
  await visit("empty", 320);
  await documents();
  check(
    (await page
      .getByText("Tidak ada alumni sesuai pencarian dan hak akses Anda.", {
        exact: true,
      })
      .count()) === 1,
    "empty alumni state",
  );
  await geometry(page, "empty");
  await visit("readonly", 320);
  check(
    (await page.getByRole("tab").count()) === 1,
    "read-only role only documents tab",
  );
  check(
    (await page
      .getByRole("button", { name: "Edit metadata", exact: true })
      .count()) === 0,
    "read-only role no admin actions",
  );
  check(
    (await page.getByRole("link", { name: "Lihat IJAZAH" }).count()) === 0,
    "view denied link hidden",
  );
  await a11y(page, "read-only");
  for (const failure of ["network", "malformed", "stale"]) {
    await visit();
    outcome = failure;
    await documents();
    await (await alumni(4))
      .getByRole("button", { name: "Edit metadata", exact: true })
      .click();
    await page.getByLabel("Nomor ijazah", { exact: true }).fill("TEST");
    const count = posts.length;
    await page.getByRole("button", { name: "Simpan metadata" }).click();
    await page
      .getByRole("button", { name: "Muat ulang halaman", exact: true })
      .waitFor();
    check(
      await page.getByRole("button", { name: "Simpan metadata" }).isDisabled(),
      failure + " blocks retry",
    );
    check(posts.length === count + 1, failure + " one request");
  }
  await visit();
  await documents();
  outcome = "asset-network";
  await (await alumni(4))
    .getByRole("button", { name: "Hapus IJAZAH", exact: true })
    .click();
  await acknowledge();
  await page.getByRole("button", { name: "Konfirmasi hapus" }).click();
  await page
    .getByRole("button", { name: "Muat ulang untuk memeriksa berkas" })
    .waitFor();
  check(
    await page.getByRole("button", { name: "Konfirmasi hapus" }).isDisabled(),
    "uncertain delete blocks retry",
  );
  await visit();
  await documents();
  outcome = "hang";
  await page.clock.install();
  await (await alumni(4))
    .getByRole("button", { name: "Edit metadata", exact: true })
    .click();
  await page.getByLabel("Nomor ijazah", { exact: true }).fill("TIMEOUT");
  await page.getByRole("button", { name: "Simpan metadata" }).click();
  await page.clock.fastForward(31000);
  await page
    .getByRole("button", { name: "Muat ulang halaman", exact: true })
    .waitFor();
  check(
    await page.getByRole("button", { name: "Simpan metadata" }).isDisabled(),
    "write timeout blocks blind retry",
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
