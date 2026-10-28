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
  process.env.FAMILIES_QA_OUTPUT ?? join(root, "docs/verification/families");
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
  entryPoints: [join(root, "tests/ui/families-fixture.tsx")],
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

  let writes = 0,
    mode = "ok",
    lastCommand;
  await page.route("**/api/families", async (route) => {
    const request = route.request(),
      data = await page.evaluate(() => window.familiesFixture);
    if (request.method() === "POST") {
      writes++;
      const c = request.postDataJSON().command;
      lastCommand = c;
      if (c.type === "guardian") {
        if (c.remove)
          data.guardians = data.guardians.filter(
            (g) =>
              g.student_id !== c.studentId ||
              g.parent_id !== c.parentId ||
              g.relationship !== c.relationship,
          );
        else if (
          !data.guardians.some(
            (g) =>
              g.student_id === c.studentId &&
              g.parent_id === c.parentId &&
              g.relationship === c.relationship,
          )
        )
          data.guardians.push({
            id: id(800 + writes),
            student_id: c.studentId,
            parent_id: c.parentId,
            relationship: c.relationship,
          });
      } else {
        const old = data.families.find((f) => f.id === c.id);
        const members = c.studentIds.map(
          (student_id, i) =>
            old?.members.find((m) => m.student_id === student_id) ?? {
              student_id,
              legacy_order: 1000 + i,
            },
        );
        for (const family of data.families)
          if (family.id !== c.id)
            family.members = family.members.filter(
              (m) => !c.studentIds.includes(m.student_id),
            );
        if (old) {
          old.name = c.name;
          old.members = members;
        } else
          data.families.push({ id: id(900 + writes), name: c.name, members });
      }
      data.revision++;
      await page.evaluate((d) => (window.familiesFixture = d), data);
    }
    await new Promise((r) => setTimeout(r, 100));
    await route.fulfill({
      status: mode === "ok" ? 200 : 503,
      json:
        mode === "ok"
          ? {
              code: request.method() === "POST" ? "saved" : undefined,
              families: data,
              message: "Saved",
            }
          : { message: "Tidak tersedia" },
    });
  });
  const input = () =>
    page.getByRole("textbox", { name: "Nama / kode grup", exact: true });
  const groupList = () =>
    page.locator("li").filter({
      has: page.getByRole("button", { name: "Edit grup", exact: true }),
    });
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
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base);
    await input().waitFor();
    await geometry("families " + width);
    await a11y("families " + width);
    await page.getByText(/^Daftar relasi terverifikasi/).click();
    await page.getByText(/^Daftar grup saudara/).click();
    await geometry("expanded lists " + width);
    await a11y("expanded lists " + width);
    await page.getByText(/^Daftar relasi terverifikasi/).click();
    await page.getByText(/^Daftar grup saudara/).click();
    await page.screenshot({
      path: join(out, "families-" + width + ".png"),
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.getByText(/^Daftar relasi terverifikasi/).click();
  await page.getByText(/^Daftar grup saudara/).click();
  check(
    (await page
      .getByRole("button", { name: "Cabut relasi", exact: true })
      .count()) === 20,
    "guardian pagination",
  );
  check(
    (await page
      .getByRole("button", { name: "Edit grup", exact: true })
      .count()) === 20,
    "group pagination",
  );
  await page
    .getByRole("navigation", { name: "Halaman grup saudara" })
    .getByRole("button", { name: "Berikutnya" })
    .click();
  check(
    (await page
      .getByRole("button", { name: "Edit grup", exact: true })
      .count()) === 5,
    "next group page",
  );
  await page
    .getByRole("searchbox", { name: "Cari grup", exact: true })
    .fill("Grup 0");
  await page.getByRole("button", { name: "Edit grup", exact: true }).click();
  check(
    await page.getByRole("checkbox", { name: /Anggota Nonaktif/ }).isChecked(),
    "inactive existing member retained",
  );
  await page
    .getByRole("combobox", { name: /^Siswa \/ Calon Siswa/ })
    .selectOption(id(11));
  await page
    .getByRole("combobox", { name: /^Akun Orang Tua/ })
    .selectOption(id(200));
  await page
    .getByRole("searchbox", { name: "Cari calon anggota", exact: true })
    .fill("Siswa 2");
  await page
    .getByRole("checkbox", { name: "Siswa 2 (002)", exact: true })
    .check();
  await page
    .getByRole("searchbox", { name: "Cari calon anggota", exact: true })
    .fill("No matching account");
  check(
    await page
      .getByText(/Terpilih:/)
      .textContent()
      .then((t) => t.includes("Siswa 2")),
    "hidden selection retained during search",
  );
  await page
    .getByRole("searchbox", { name: "Cari calon anggota", exact: true })
    .fill("");
  const before = writes;
  await page
    .getByRole("button", { name: "Simpan perubahan grup", exact: true })
    .evaluate((e) => {
      e.click();
      e.click();
    });
  await page.getByRole("alertdialog").getByRole("button", {name:"Lanjutkan",exact:true}).click();
  await page
    .getByText("Perubahan tersimpan dan relasi telah dikonfirmasi.")
    .waitFor();
  check(writes === before + 1, "double group save sends one request");
  check(
    JSON.stringify(lastCommand.studentIds) ===
      JSON.stringify([id(999), id(10), id(12)]),
    "retained legacy order before new members",
  );
  check(
    (await page
      .getByRole("combobox", { name: /^Siswa \/ Calon Siswa/ })
      .inputValue()) === id(11),
    "group save preserves guardian draft",
  );
  await page
    .getByRole("button", { name: "Verifikasi dan hubungkan", exact: true })
    .click();
  await page.getByRole("alertdialog").getByRole("button", {name:"Lanjutkan",exact:true}).click();
  await page.waitForFunction(
    () =>
      document.querySelector("div[aria-busy]")?.getAttribute("aria-busy") ===
      "false",
  );
  check(lastCommand.type === "guardian", "guardian command sent");
  await page
    .getByRole("searchbox", { name: "Cari relasi", exact: true })
    .fill("Siswa 1 (001)");
  await page.getByRole("button", { name: "Cabut relasi", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", {name:"Lanjutkan",exact:true}).click();
  await page.waitForFunction(
    () =>
      document.querySelector("div[aria-busy]")?.getAttribute("aria-busy") ===
      "false",
  );
  check(lastCommand.remove === true, "guardian revocation");
  await input().fill("Draft group");

  await page
    .getByRole("button", { name: "Muat ulang relasi", exact: true })
    .click();
  await page.getByRole("alertdialog").getByRole("button", {name:"Batal",exact:true}).click();
  await page.getByRole("alertdialog").waitFor({state:"hidden"});
  check(
    (await input().inputValue()) === "Draft group",
    "reload cancellation preserves draft",
  );

  await page
    .getByRole("checkbox", { name: "Siswa 44 (0044)", exact: true })
    .check();
  mode = "ambiguous";
  await page.getByRole("button", { name: "Buat grup", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("div[aria-busy]")?.getAttribute("aria-busy") ===
      "false",
  );
  check(
    await page
      .getByRole("button", { name: "Buat grup", exact: true })
      .isDisabled(),
    "uncertain write blocks retry",
  );
  const saved = writes;
  mode = "ok";
  await page
    .getByRole("button", { name: "Muat ulang relasi", exact: true })
    .click();
  await page.getByRole("alertdialog").getByRole("button", {name:"Lanjutkan",exact:true}).click();
  await page.getByRole("alertdialog").waitFor({state:"hidden"});
  await page.getByText("Relasi berhasil dimuat ulang.").waitFor();
  check(saved === writes, "reload never repeats write");
  await page
    .getByRole("searchbox", { name: "Cari grup", exact: true })
    .fill("Draft group");
  check(
    (await groupList().count()) === 1,
    "ambiguous committed group recovered once",
  );
  await page.setViewportSize({ width: 812, height: 375 });
  await geometry("landscape");
  await page
    .getByRole("button", { name: "Muat ulang relasi", exact: true })
    .focus();
  await page.keyboard.press("Tab");
  check(
    await page.evaluate(() => document.activeElement?.tagName === "SELECT"),
    "keyboard reaches guardian form",
  );
  await page.goto(base + "/?empty=1");
  await input().waitFor();
  check(
    await page
      .getByRole("button", { name: "Verifikasi dan hubungkan", exact: true })
      .isDisabled(),
    "empty catalog disables link",
  );
  check(
    await page
      .getByRole("button", { name: "Buat grup", exact: true })
      .isDisabled(),
    "empty catalog disables group creation",
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
