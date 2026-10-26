import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {mkdtempSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
test('all main-content landmarks accept keyboard skip focus and no positive literal tabindex reorders navigation',()=>{
 const output=join(mkdtempSync(join(tmpdir(),'sim-a11y-')),'source.json');execFileSync(process.execPath,['scripts/accessibility/source-audit.mjs',output]);const report=JSON.parse(readFileSync(output,'utf8'));assert.ok(report.mains.length);assert.deepEqual(report.missingFocusTarget,[]);assert.deepEqual(report.positiveTabIndex,[]);
});
