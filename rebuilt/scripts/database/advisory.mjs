import { readFile,writeFile } from 'node:fs/promises';
import { createIsolatedDatabase,projectRoot } from './harness.mjs';
const {db}=await createIsolatedDatabase();
try {
  const results=await db.exec(await readFile(`${projectRoot}scripts/database/verify-foundation.sql`,'utf8'));
  const [tables,functions,foreignKeys]=results;
  const issues=[];
  if(tables.rows.length!==24)issues.push('Expected 24 foundation tables');
  for(const t of tables.rows){
    if(!t.rls_enabled)issues.push(`RLS off: ${t.schema_name}.${t.table_name}`);
    if(t.anon_can_read||t.authenticated_can_read)issues.push(`Unexpected client read grant: ${t.schema_name}.${t.table_name}`);
  }
  if(functions.rows.some((f)=>f.security_definer))issues.push('Unexpected SECURITY DEFINER');
  for(const fk of foreignKeys.rows)issues.push(`FK index missing: ${fk.unindexed_foreign_key}`);
  const report={status:issues.length?'failed':'passed',kind:'local custom catalog checks, NOT Supabase platform Advisors',engine:'PGlite PostgreSQL 18.6',issues,tables:tables.rows,functions:functions.rows,unindexedForeignKeys:foreignKeys.rows};
  await writeFile(`${projectRoot}docs/verification/stage-04-advisory.json`,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(issues.length)process.exitCode=1;
} finally {await db.close();}
