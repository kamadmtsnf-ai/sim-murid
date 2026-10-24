/** Actual Survei UI with isolated Auth/HTTP/Storage boundaries. */
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
  process.env.SURVEYS_QA_OUTPUT ?? join(root, "docs/verification/surveys");
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
  entryPoints: [join(root, "tests/ui/surveys-fixture.tsx")],
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
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(String(e)));
  const accept = (d) => d.accept();
  page.on("dialog", accept);
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  let posts = [],
    outcome = "saved",
    delay = 0,
    readFailure = false;
  await page.route("**/api/services/surveys", async (route) => {
    const req = route.request(),
      data = await page.evaluate(() => window.surveysFixture);
    if (req.method() === "GET")
      return route.fulfill(
        readFailure
          ? { status: 503, json: { message: "Offline" } }
          : { status: 200, json: { data } },
      );
    const c = req.postDataJSON().command;
    posts.push(c);
    if (outcome === "hang") return;
    if (delay) await new Promise((r) => setTimeout(r, delay));
    if (outcome === "stale")
      return route.fulfill({
        status: 409,
        json: { code: "stale", message: "Data berubah. Muat ulang." },
      });
    if (outcome === "malformed")
      return route.fulfill({ status: 200, json: { message: "saved" } });
    let p = data.rows.find((p) => p.id === c.periodId),
      result = { code: "saved" };
    if (c.type === "period") {
      p = {
        id: id(500 + posts.length),
        title: c.title,
        academic_year_id: c.yearId,
        semester: c.semester,
        starts_on: c.start,
        ends_on: c.end,
        status: "open",
        kind: c.kind,
        instrument_version: "SURVEI-1.0",
        response: null,
        plan: null,
        targets: c.targets,
      };
      data.rows.push(p);
      data.revision++;
      result.id = p.id;
    } else if (c.type === "close") {
      p.status = "closed";
      data.revision++;
      result.id = p.id;
    } else if (c.type === "start") {
      p.response = await page.evaluate(() => window.surveyResponse);
      result.response = p.response;
    } else {
      if (p.response.revision !== c.version)
        return route.fulfill({
          status: 409,
          json: { code: "stale", message: "Versi berubah." },
        });
      p.response[c.type.startsWith("peer_") ? "peer_answers" : "answers"] =
        c.answers;
      p.response.revision++;
      if (c.type === "submit") {
        p.response.submitted_at = "2026-10-23T00:00:00Z";
        data.extra.required = [];
      }
      if (c.type === "peer_submit")
        p.response.peer_submitted_at = "2026-10-23T00:00:00Z";
      result.version = p.response.revision;
    }
    await page.evaluate((d) => {
      window.surveysFixture = d;
      sessionStorage.setItem("survey-fixture-server", JSON.stringify(d));
    }, data);
    return route.fulfill(
      outcome === "readback-failure"
        ? { status: 503, json: { message: "Unavailable" } }
        : { status: 200, json: { code: "saved", result, data } },
    );
  });
  const visit = async (mode = "normal") => {
    outcome = "saved";
    delay = 0;
    readFailure = false;
    posts = [];
    await page.goto(base + "/blank");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(base + "/?mode=" + mode);
    await page
      .getByRole("heading", { name: "Survei evaluasi", exact: true })
      .waitFor();
  };
  const editor = () =>
    page.getByRole("region", { name: "Jawaban survei", exact: true });
  const open = async () => {
    await page
      .getByRole("button", { name: "Buka / lanjutkan jawaban", exact: true })
      .first()
      .click();
    await editor().waitFor();
  };
  const q1 = () => editor().locator('[data-code="Q-1"]'),
    q2 = () => editor().locator('[data-code="Q-2"]');
  const saved = () =>
    editor()
      .getByText("Seluruh draft tersimpan di server.", { exact: true })
      .waitFor();
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await visit();
    await open();
    await geometry(page, "survey " + width);
    await a11y(page, "survey " + width);
    await page.screenshot({
      path: join(out, `surveys-${width}.png`),
      fullPage: true,
    });
  }
  await visit("unstarted");
  await open();
  check(
    posts[0].type === "start",
    "new respondent starts through service command",
  );
  await visit();
  await open();
  await editor()
    .getByRole("button", { name: "Kirim final", exact: true })
    .click();
  check(posts.length === 0, "required validation blocks premature final");
  check(
    await q1().evaluate((e) => document.activeElement === e),
    "missing question receives focus",
  );
  await q1().selectOption("4");
  await q1().selectOption("");
  await q2().fill("Saran");
  await editor()
    .getByRole("button", { name: "Simpan sekarang", exact: true })
    .evaluate((e) => {
      e.click();
      e.click();
    });
  await saved();
  check(posts.length === 1, "double submit sends one write");
  check(!("Q-1" in posts[0].answers), "empty Likert does not become zero");
  await q2().fill("Draft tetap");
  page.off("dialog", accept);
  const dismiss = (d) => d.dismiss();
  page.on("dialog", dismiss);
  await page
    .getByRole("button", { name: "Tutup jawaban", exact: true })
    .click();
  check(
    await editor().isVisible(),
    "cancelled discard keeps questionnaire open",
  );
  page.off("dialog", dismiss);
  page.on("dialog", accept);
  await page
    .getByRole("button", { name: "Tutup jawaban", exact: true })
    .click();
  await editor().waitFor({ state: "hidden" });
  await open();
  await page.waitForFunction(
    () => document.querySelector('[data-code="Q-2"]')?.value === "Draft tetap",
    undefined,
    { timeout: 10000 },
  );
  check(
    (await q2().inputValue()) === "Draft tetap",
    "closing and reopening preserves versioned local draft",
  );
  await q1().selectOption("5");
  delay = 700;
  await editor()
    .getByRole("button", { name: "Simpan sekarang", exact: true })
    .evaluate((e) => e.click());
  await q2().fill("Ketikan terbaru selama request");
  await page.waitForFunction(
    () => window.surveysFixture.rows[0].response.revision >= 2,
    undefined,
    { timeout: 10000 },
  );
  check(
    (await q2().inputValue()) === "Ketikan terbaru selama request",
    "typing during save stays in editor",
  );
  check(
    (await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem(
            Object.keys(localStorage).find((k) => k.startsWith("sim-survey:")),
          ),
        ).answers["Q-2"],
    )) === "Ketikan terbaru selama request",
    "new draft survives old acknowledgement",
  );
  delay = 0;
  await saved();
  check(
    posts.at(-1).version === 2,
    "queued autosave uses new respondent revision",
  );
  await editor()
    .getByRole("button", { name: "Kirim final", exact: true })
    .click();
  await editor().getByText("Jawaban terkunci.", { exact: false }).waitFor();
  check(await q1().isDisabled(), "main final locks answers");
  check(
    (await page.evaluate(
      () =>
        Object.keys(localStorage).filter((k) => k.startsWith("sim-survey:"))
          .length,
    )) === 0,
    "final clears device draft",
  );
  await visit("teacher");
  await open();
  await editor().getByText("Rekan Guru", { exact: true }).click();
  await editor().locator("details select").first().selectOption("TT");
  await editor().locator("details select").first().selectOption("");
  await editor().getByRole("button", { name: "Simpan draft rekan" }).click();
  await saved();
  check(
    !("PTS-1" in posts.at(-1).answers[id(3)]),
    "empty peer selection never becomes zero",
  );
  await editor().locator("details select").first().selectOption("TT");
  await editor()
    .getByLabel("Apresiasi atau masukan (opsional)")
    .fill("Terima kasih");
  await page.reload();
  await open();
  await editor().getByText("Rekan Guru", { exact: true }).click();
  check(
    (await editor().locator("details select").first().inputValue()) === "TT",
    "peer draft recovers after reload",
  );
  check(
    (await editor()
      .getByLabel("Apresiasi atau masukan (opsional)")
      .inputValue()) === "Terima kasih",
    "optional peer essay recovers",
  );
  await editor().getByRole("button", { name: "Kirim penilaian rekan" }).click();
  check(
    await editor()
      .getByText("Lengkapi penilaian rekan:", { exact: false })
      .isVisible(),
    "all peer dimensions required",
  );
  for (const s of await editor().locator("details select").all())
    await s.selectOption("TT");
  await editor().getByRole("button", { name: "Kirim penilaian rekan" }).click();
  await editor()
    .getByText("Penilaian rekan sudah dikirim dan terkunci.", { exact: true })
    .waitFor();
  check(
    await editor().locator("details select").first().isDisabled(),
    "peer final locks peer controls",
  );
  check(await q1().isEnabled(), "peer lock leaves main editable");
  await q1().selectOption("4");
  await q2().fill("Saran guru");
  await editor()
    .getByRole("button", { name: "Kirim final", exact: true })
    .click();
  await editor().getByText("Jawaban terkunci.", { exact: false }).waitFor();
  check(true, "teacher can finalize after peer final");
  await visit("large");
  await open();
  check(
    (await editor().locator("[data-code]").count()) === 10,
    "ten questions per page",
  );
  await editor().getByRole("button", { name: "Pertanyaan berikutnya" }).click();
  check(
    await editor().getByText("Halaman 2 / 3", { exact: true }).isVisible(),
    "question pagination works",
  );
  await page.setViewportSize({ width: 740, height: 360 });
  await geometry(page, "large landscape");
  await a11y(page, "large landscape");
  await visit("closed");
  await page
    .getByRole("button", { name: "Lihat jawaban", exact: true })
    .click();
  check(
    (await q2().inputValue()) === "Saran tersimpan" &&
      (await q2().isDisabled()),
    "closed survey offers read-only review",
  );
  await page.getByText("Rencana tindak lanjut", { exact: true }).click();
  check(
    await page.getByText("Perbaikan layanan", { exact: false }).isVisible(),
    "action plan retained",
  );
  await visit("manager");
  check(
    (await page
      .getByRole("button", { name: "Buka / lanjutkan jawaban" })
      .count()) === 0,
    "admin has no respondent action outside target role",
  );
  await page
    .getByText("Buat periode survei utama / mikro", { exact: true })
    .click();
  await page.getByLabel("Judul", { exact: false }).fill("Survei mikro");
  await page
    .getByRole("combobox", { name: "Jenis", exact: true })
    .selectOption("micro");
  await page.getByLabel("Mulai", { exact: true }).fill("2026-10-24");
  await page.getByLabel("Selesai", { exact: true }).fill("2026-10-30");
  await page.getByLabel("Siswa", { exact: true }).check();
  await page
    .getByLabel("Pertanyaan mikro (satu esai wajib per baris)", { exact: true })
    .fill("Bagaimana layanan madrasah?\nApa saran Anda?");
  await page.getByRole("button", { name: "Buat periode", exact: true }).click();
  await page
    .getByRole("heading", { name: "Survei mikro", exact: true })
    .waitFor();
  check(
    posts[0].questions.length === 2 && posts[0].semester === 1,
    "micro creation keeps academic period and questions",
  );
  await a11y(page, "manager");
  await page
    .getByRole("button", { name: "Tutup periode", exact: true })
    .first()
    .click();
  await page.waitForFunction(
    () => window.surveysFixture.rows[0].status === "closed",
    undefined,
    { timeout: 10000 },
  );
  check(posts.at(-1).type === "close", "manager close command retained");
  await visit("empty");
  await a11y(page, "empty");
  check(
    await page
      .getByRole("heading", { name: "Belum ada survei untuk akun Anda" })
      .isVisible(),
    "empty state explicit",
  );
  await visit();
  await page.evaluate(
    ({ user, period }) =>
      localStorage.setItem(
        `sim-survey:${user}:${period}:SURVEI-1.0`,
        JSON.stringify({ version: 99, answers: { "Q-1": 5 } }),
      ),
    { user: id(1), period: id(10) },
  );
  await open();
  await editor()
    .getByText("Draft perangkat berasal dari versi berbeda.", { exact: false })
    .waitFor();
  check(
    (await q1().inputValue()) === "",
    "stale device draft does not overwrite server",
  );
  await visit();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (...args) {
      if (this === localStorage) throw Error("Denied");
      return original.apply(this, args);
    };
  });
  await open();
  await q2().fill("Tanpa storage");
  check(
    await editor()
      .getByText("Penyimpanan perangkat tidak tersedia.", { exact: false })
      .isVisible(),
    "storage failure shown honestly",
  );
  await editor().getByRole("button", { name: "Simpan sekarang" }).click();
  await saved();
  check(
    posts[0].answers["Q-2"] === "Tanpa storage",
    "server save survives denied local storage",
  );
  await visit();
  await open();
  await page.context().setOffline(true);
  await q2().fill("Jawaban offline");
  await editor().getByText("Offline.", { exact: false }).waitFor();
  await page.context().setOffline(false);
  await saved();
  check(
    posts.at(-1).answers["Q-2"] === "Jawaban offline",
    "offline draft synchronizes on reconnect",
  );
  for (const failure of ["stale", "malformed", "readback-failure"]) {
    await visit();
    await open();
    outcome = failure;
    await q2().fill("Pertahankan draft");
    await editor().getByRole("button", { name: "Simpan sekarang" }).click();
    await page.waitForFunction(
      () =>
        document.querySelector(".surveys-panel")?.getAttribute("aria-busy") ===
        "false",
      undefined,
      { timeout: 10000 },
    );
    check(
      await editor()
        .getByRole("button", { name: "Simpan sekarang" })
        .isDisabled(),
      failure + " blocks blind retry",
    );
    check(
      (await q2().inputValue()) === "Pertahankan draft",
      failure + " retains draft",
    );
    outcome = "saved";
    readFailure = true;
    await page
      .getByRole("button", { name: "Muat ulang survei", exact: true })
      .click();
    await page
      .getByText("Data belum dapat dimuat ulang.", { exact: false })
      .waitFor();
    check(
      (await q2().inputValue()) === "Pertahankan draft",
      failure + " failed reload retains editor",
    );
    readFailure = false;
    await page
      .getByRole("button", { name: "Muat ulang survei", exact: true })
      .click();
    await page
      .getByText("Data server berhasil dimuat ulang.", { exact: false })
      .waitFor();
    check(true, failure + " reload recovers");
  }
  await visit();
  await open();
  await q2().fill("Draft setelah logout dibatalkan");
  page.off("dialog", accept);
  const cancelLeave = d => d.type() === "beforeunload" ? d.accept() : d.dismiss();
  page.on("dialog", cancelLeave);
  await page.evaluate(() => {
    window.cancelledLogoutReachedTarget = false;
    const form = document.querySelector('form[action="/api/auth/logout"]');
    form.addEventListener("submit", e => { window.cancelledLogoutReachedTarget = true; e.preventDefault(); }, {once:true});
    form.requestSubmit();
  });
  check(!(await page.evaluate(() => window.cancelledLogoutReachedTarget)), "cancelled dirty logout stops before draft cleanup");
  await editor().getByText("Seluruh draft tersimpan di server.", {exact:true}).waitFor();
  check((await q2().inputValue()) === "Draft setelah logout dibatalkan", "cancelled logout retains answers and autosave continues");
  page.off("dialog", cancelLeave);
  page.on("dialog", accept);
  await visit();
  await open();
  await q2().fill("Logout");
  delay = 700;
  await editor().getByRole("button", { name: "Simpan sekarang" }).click();
  await page.evaluate(() => {
    localStorage.setItem("unrelated-preference", "keep");
    const f = document.querySelector('form[action="/api/auth/logout"]');
    f.addEventListener("submit", (e) => e.preventDefault(), { once: true });
    f.requestSubmit();
  });
  await page.waitForTimeout(900);
  check(
    (await page.evaluate(
      () =>
        Object.keys(localStorage).filter((k) => k.startsWith("sim-survey:"))
          .length,
    )) === 0,
    "logout prevents in-flight save recreating draft",
  );
  check(
    (await page.evaluate(() =>
      localStorage.getItem("unrelated-preference"),
    )) === "keep",
    "logout preserves unrelated preferences",
  );
  await visit();
  await open();
  await page.clock.install();
  outcome = "hang";
  await q2().fill("Timeout draft");
  await editor().getByRole("button", { name: "Simpan sekarang" }).click();
  await page.clock.fastForward(31000);
  await page
    .getByText("Hasil penyimpanan belum dapat dipastikan.", { exact: false })
    .waitFor();
  check(
    await editor()
      .getByRole("button", { name: "Simpan sekarang" })
      .isDisabled(),
    "timeout blocks blind retry",
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
