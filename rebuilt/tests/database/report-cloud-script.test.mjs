import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createIsolatedDatabase} from '../../scripts/database/harness.mjs';
test('Scoped cloud D10 verification is valid SQL and rolls all disposable fixtures back',async()=>{
 const {db}=await createIsolatedDatabase();try{const sql=await readFile(new URL('../../scripts/database/verify-report-revisions.sql',import.meta.url),'utf8');await db.exec(sql);assert.equal((await db.query('select count(*)::int n from public.profiles')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from sim_murid_private.report_revisions')).rows[0].n,0);}finally{await db.close();}
});
