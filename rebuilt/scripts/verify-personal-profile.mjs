/** Actual Profil pribadi UI with isolated HTTP boundaries. */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd();
const out =
  process.env.PROFILE_QA_OUTPUT ??
  join(root, "docs/verification/personal-profile");
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
  entryPoints: [join(root, "tests/ui/personal-profile-fixture.tsx")],
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
          path: join(root, "tests/ui/personal-profile-navigation-shim.ts"),
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
      '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Profil pribadi QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const checks = [],
  errors = [],
  accessibility = [];
let browser, page;
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
  let acceptDialogs = true,
    mode = "ok",
    reads = 0,
    writes = 0,
    lastInput,
    stored,
    version = 0;
  page.on("dialog", (d) => (acceptDialogs ? d.accept() : d.dismiss()));
  await page.route("**/api/account/profile", async (route) => {
    const r = route.request();
    stored ??= await page.evaluate(() =>
      structuredClone(window.personalProfileFixture),
    );
    await new Promise((r) => setTimeout(r, 150));
    if (r.method() === "GET") {
      reads++;
      if (mode === "read-offline") return route.abort();
      if (mode === "read-malformed")
        return route.fulfill({ json: { profile: { bad: true } } });
      return route.fulfill({ json: { profile: stored } });
    }
    writes++;
    lastInput = r.postDataJSON();
    if (mode === "offline") return route.abort();
    if (mode === "401") return route.fulfill({ status: 401, body: "not JSON" });
    if (["400", "403", "409", "503"].includes(mode))
      return route.fulfill({
        status: Number(mode),
        json: { message: "Permintaan gagal " + mode },
      });
    if (mode === "malformed")
      return route.fulfill({ json: { message: "success without profile" } });
    if (mode === "json") return route.fulfill({ body: "invalid JSON" });
    if (mode === "wrong-user")
      return route.fulfill({
        json: { profile: { ...lastInput, username: "foreign" } },
      });
    stored = {
      ...lastInput,
      updated_at:
        "2026-10-23T12:00:" +
        String(version++).padStart(2, "0") +
        ".654321+00:00",
    };
    if (mode === "committed")
      return route.fulfill({
        status: 503,
        json: { message: "Status belum dapat dipastikan" },
      });
    return route.fulfill({
      json: { profile: stored, message: "Profil berhasil diperbarui." },
    });
  });
  const button = (name) => page.getByRole("button", { name, exact: true }),
    field = (name) => page.locator("#profile-" + name),
    save = () => button("Simpan profil"),
    reload = () => button("Muat ulang"),
    inspect = () => button("Periksa status penyimpanan");
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
    if (g.s > g.w + 1)
      console.log(
        await page.evaluate(() =>
          Array.from(document.querySelectorAll("main *"))
            .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
            .map((e) => ({
              tag: e.tagName,
              cls: e.className,
              width: e.getBoundingClientRect().width,
              right: e.getBoundingClientRect().right,
            }))
            .slice(0, 15),
        ),
      );
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
  async function fresh(query = "") {
    stored = null;
    await page.goto(base + query);
    await field("full_name").waitFor();
    mode = "ok";
  }
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await fresh("/?long=1");
    await geometry("long profile " + width);
    await a11y("profile " + width);
    await page.screenshot({
      path: join(out, "profile-" + width + ".png"),
      fullPage: true,
    });
  }
  await fresh();
  check(
    (await field("phone").inputValue()) === "081234567890",
    "phone leading zero retained",
  );
  await field("full_name").fill(" ");
  let count = writes;
  await save().click();
  check(writes === count, "empty name blocked before network");
  check(
    (await field("full_name").getAttribute("aria-invalid")) === "true",
    "name error explicit",
  );
  check(
    await field("full_name").evaluate((e) => document.activeElement === e),
    "name error focused",
  );
  await field("full_name").fill("Nama baru");
  await field("contact_email").fill("bad@");
  await save().click();
  check(
    (await field("contact_email").getAttribute("aria-invalid")) === "true",
    "email validation explicit",
  );
  await field("contact_email").fill("Contact@Example.org");
  await field("bio").fill(" Bio baru\nBaris dua ");
  count = reads;
  acceptDialogs = false;
  await reload().click();
  acceptDialogs = true;
  check(
    reads === count && (await field("full_name").inputValue()) === "Nama baru",
    "cancel reload preserves dirty values",
  );
  count = writes;
  await save().evaluate((e) => {
    e.click();
    e.click();
  });
  await idle();
  check(writes === count + 1, "synchronous submit lock");
  check(
    lastInput.updated_at === "2026-10-23T10:11:12.123456+00:00",
    "microsecond timestamp preserved",
  );
  check(lastInput.contact_email === "contact@example.org", "email normalized");
  check(
    (await field("bio").inputValue()) === "Bio baru\nBaris dua",
    "server normalized draft applied",
  );
  check(
    (await page.getByRole("status").innerText()) ===
      "Profil berhasil diperbarui.",
    "same email does not imply lost verification",
  );
  check(
    (await page.locator("html").getAttribute("data-refreshes")) === "1",
    "shell refreshed after confirmed save",
  );
  await field("contact_email").fill("new@example.org");
  await save().click();
  await idle();
  check(
    await page
      .getByRole("status")
      .getByText(/Email kontak berubah/)
      .isVisible(),
    "email-change warning accurate",
  );
  for (const failure of ["400", "403"]) {
    mode = failure;
    await field("full_name").fill("Draf " + failure);
    await save().click();
    await idle();
    check(
      (await field("full_name").inputValue()) === "Draf " + failure,
      failure + " preserves input",
    );
    check(await save().isEnabled(), failure + " controls recover");
  }
  mode = "committed";
  await field("full_name").fill("Commit tanpa respons");
  await save().click();
  await idle();
  check(await save().isDisabled(), "ambiguous write blocks resend");
  count = writes;
  mode = "ok";
  await inspect().click();
  await idle();
  check(writes === count, "status check performs no write");
  check(
    await save().isEnabled(),
    "matched persisted content resolves uncertainty",
  );
  check(
    await page
      .getByRole("status")
      .getByText("Profil tersimpan sesuai perubahan Anda.")
      .isVisible(),
    "persisted save confirmation",
  );
  for (const failure of [
    "offline",
    "json",
    "malformed",
    "wrong-user",
    "409",
    "503",
  ]) {
    mode = failure;
    await field("full_name").fill("Draf " + failure);
    await save().click();
    await idle();
    check(
      (await field("full_name").inputValue()) === "Draf " + failure,
      failure + " retains draft",
    );
    check(await save().isDisabled(), failure + " prevents unsafe resend");
    await geometry(failure);
    mode = "ok";
    await inspect().click();
    await idle();
    check(
      await save().isDisabled(),
      failure + " differing persisted data requires review",
    );
    await reload().click();
    await idle();
    check(
      await save().isEnabled(),
      failure + " reload restores current version",
    );
  }
  mode = "offline";
  await field("full_name").fill("Tetap dipertahankan");
  await save().click();
  await idle();
  for (const failure of ["read-offline", "read-malformed"]) {
    mode = failure;
    await inspect().click();
    await idle();
    check(
      (await field("full_name").inputValue()) === "Tetap dipertahankan",
      failure + " retains draft",
    );
    check(await save().isDisabled(), failure + " blocks write");
  }
  mode = "read-offline";
  await reload().click();
  await idle();
  check(
    (await field("full_name").inputValue()) === "Tetap dipertahankan",
    "reload outage preserves draft",
  );
  mode = "ok";
  await reload().click();
  await idle();
  mode = "401";
  await field("full_name").fill("Sesi berakhir");
  await save().click();
  await idle();
  check(
    (await page.locator("html").getAttribute("data-destination")) ===
      "/login?expired=1",
    "401 redirects before JSON parsing",
  );
  check(
    (await field("full_name").inputValue()) === "Sesi berakhir",
    "401 draft retained until navigation",
  );
  await fresh("/?empty=1");
  check(
    (await field("phone").inputValue()) === "" &&
      (await field("bio").inputValue()) === "",
    "empty optional fields supported",
  );
  await save().click();
  await idle();
  check(await save().isEnabled(), "empty optional profile saves");
  await a11y("optional empty");
  await page.setViewportSize({ width: 320, height: 850 });
  await field("phone").fill("+62 (812) 123-456");
  await save().tap();
  await idle();
  check(
    lastInput.phone === "+62 (812) 123-456",
    "mobile touch and international phone",
  );
  await geometry("mobile saved");
  await page.setViewportSize({ width: 844, height: 390 });
  await field("full_name").focus();
  await page.keyboard.press("Tab");
  check(
    await field("phone").evaluate((e) => document.activeElement === e),
    "keyboard focus sequence",
  );
  await geometry("landscape");
  await a11y("landscape");
  await field("bio").fill("A".repeat(2000));
  check(
    await page.getByText("2.000 / 2.000 karakter", { exact: true }).isVisible(),
    "bio limit counter",
  );
  await geometry("maximum bio");
  await save().click();
  await idle();
  check(lastInput.bio.length === 2000, "maximum bio preserved");
  await fresh();
  await field("full_name").fill("Perubahan sebelum pindah halaman");
  check(
    await page.evaluate(() => {
      const e = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    }),
    "dirty draft registers exit protection",
  );
  mode = "401";
  const completed = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/account/profile") &&
      r.request().method() === "POST",
  );
  await save().click();
  await page.evaluate(() => window.unmountPersonalProfile());
  await completed;
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  check(
    (await page.locator("html").getAttribute("data-destination")) === null,
    "late 401 after unmount does not redirect another page",
  );
  check(
    await page.evaluate(() => {
      const e = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(e);
      return !e.defaultPrevented;
    }),
    "unmount removes dirty listener",
  );
  for (const scenario of ["loading", "error"]) {
    await page.goto(base + "/?" + scenario + "=1");
    await page.getByRole("heading", { level: 1 }).waitFor();
    await geometry(scenario);
    await a11y(scenario);
    if (scenario === "error") {
      check(
        !(await page.content()).includes("private detail"),
        "internal error hidden",
      );
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
