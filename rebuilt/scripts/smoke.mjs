import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const port = 3274;
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
});
let logs = '';
child.stdout.on('data', (chunk) => { logs += chunk.toString(); });
child.stderr.on('data', (chunk) => { logs += chunk.toString(); });
child.on('error', (error) => { logs += error.message; });
const checks = [];
try {
  let ready = false;
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch { /* Startup only; bounded readiness polling. */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.ok(ready, `Production server did not become ready: ${logs}`);
  const home = await fetch(origin);
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('x-powered-by'), null);
  const html = await home.text();
  assert.match(html, /<html[^>]*lang="id"/);
  assert.match(html, /SiM-Murid/);
  assert.match(html, /href="\/login"/);
  assert.match(html, /id="main-content"/);
  checks.push('Home 200, Indonesian metadata, main landmark, login link, no X-Powered-By');
  const stylePath = html.match(/href="([^"]+\.css[^"]*)"/u)?.[1];
  assert.ok(stylePath, 'Built CSS reference missing');
  const css = await fetch(new URL(stylePath.replaceAll('&amp;', '&'), origin));
  assert.equal(css.status, 200);
  const cssText = await css.text();
  assert.match(cssText, /\.bg-background/);
  checks.push('Compiled Tailwind CSS asset returns 200 with application utility styles');
  const foundation = await fetch(`${origin}/foundation`);
  assert.equal(foundation.status, 200);
  assert.match(await foundation.text(), /Tahap 25/);
  checks.push('Foundation page 200 and accurate remaining-scope information');
  const missing = await fetch(`${origin}/nonexistent-foundation-route`);
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /Halaman tidak ditemukan/);
  checks.push('Unknown route returns custom 404');
  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await health.json(), { status: 'ok', application: 'sim-murid', stage: 25, scope: 'liveness' });
  checks.push('Health JSON identifies liveness only, no secrets or database-ready claims');
  console.log(JSON.stringify({ status: 'passed', checks, limitations: ['HTTP smoke test; no visual browser or hydration validation', 'Authentication integration covered by separate live tests'] }, null, 2));
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 5000))]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}
