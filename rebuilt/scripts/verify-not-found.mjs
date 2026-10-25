/** Actual production Next server: no auth/data fixtures or cloud writes. */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
const req = createRequire(import.meta.url),
  tools = process.env.UI_TEST_TOOLS ?? join(process.cwd(), "node_modules");
const { chromium } = req(join(tools, "playwright"));
const axe = await readFile(join(tools, "axe-core/axe.min.js"), "utf8");
const portServer = createServer();
await new Promise((r) => portServer.listen(0, "127.0.0.1", r));
const port = portServer.address().port;
await new Promise((r) => portServer.close(r));
const base = process.env.NOT_FOUND_QA_BASE ?? `http://127.0.0.1:${port}`;
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw Error("Local production server required");
const out = process.env.NOT_FOUND_QA_OUTPUT ?? "/tmp/not-found-browser";
await mkdir(out, { recursive: true });
const results = [],
  errors = [];
let browser, server;
if (!process.env.NOT_FOUND_QA_BASE) {
  server = spawn(
    process.execPath,
    [
      join(process.cwd(), "node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { stdio: "pipe" },
  );
  let ready = false;
  for (let i = 0; i < 200; i++) {
    try {
      await fetch(base);
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  if (!ready) {
    server.kill();
    throw Error("Production server did not start");
  }
}
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.UI_CHROMIUM_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [1440, 900],
    [932, 430],
    [160, 568],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on("pageerror", (e) => errors.push(String(e)));
    const response = await page.goto(
      base + "/tautan-tidak-ada-qa/" + "x".repeat(180),
      { waitUntil: "networkidle" },
    );
    assert.equal(response.status(), 404);
    assert.equal(
      await page
        .getByRole("heading", { name: "Halaman tidak ditemukan", exact: true })
        .count(),
      1,
    );
    const main = page.getByRole("main");
    assert.equal(await main.count(), 1);
    const link = page.getByRole("link", {
      name: "Kembali ke beranda",
      exact: true,
    });
    assert.equal(await link.getAttribute("href"), "/");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `overflow ${width}`,
    );
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    assert.equal(
      await main.evaluate((e) => e === document.activeElement),
      true,
      "skip link target receives focus",
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await link.evaluate((e) => e === document.activeElement),
      true,
      "recovery link keyboard reachable",
    );
    assert.ok((await link.boundingBox()).height >= 44);
    const scan = await page
      .addScriptTag({ content: axe })
      .then(() =>
        page.evaluate(() =>
          window.axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          }),
        ),
      );
    assert.equal(scan.violations.length, 0, JSON.stringify(scan.violations));
    await link.scrollIntoViewIfNeeded();
    assert.ok(await link.isVisible());
    await page.screenshot({
      path: join(out, `not-found-${width}.png`),
      fullPage: true,
    });
    await page.setViewportSize({ width: height, height: width });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "orientation overflow",
    );
    if (width === 390) {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.evaluate(
        () => (document.documentElement.style.fontSize = "200%"),
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "text zoom overflow",
      );
      await link.scrollIntoViewIfNeeded();
      assert.ok(await link.isVisible());
    }
    await link.click();
    await page.waitForURL(base + "/");
    await page.waitForFunction(() => document.title.includes("Beranda"));
    results.push({
      width,
      height,
      status: 404,
      skipFocus: true,
      keyboard: true,
      noHorizontalOverflow: true,
      orientation: true,
      axeViolations: 0,
    });
    await page.close();
  }
  const noJs = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const noJsResponse = await noJs.goto(
    base + "/tautan-tidak-ada-tanpa-javascript",
  );
  assert.equal(noJsResponse.status(), 404);
  await noJs
    .getByRole("link", { name: "Kembali ke beranda", exact: true })
    .click();
  await noJs.waitForURL(base + "/");
  await noJs.close();
  results.push({ javaScriptDisabled: true, status: 404, recovery: true });
  assert.equal(errors.length, 0);
  await writeFile(
    join(out, "results.json"),
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(JSON.stringify({ results, errors }));
} finally {
  await browser?.close();
  server?.kill();
}
