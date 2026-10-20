import {createIsolatedDatabase} from './harness.mjs';
import {writeFile} from 'node:fs/promises';
const {db}=await createIsolatedDatabase();
try {
const {rows}=await db.query(`select p.proname, p.proargnames, p.proargtypes::oid[] as argtypes, p.pronargdefaults, p.prorettype::regtype::text as result from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'app_%' order by p.proname`);
const {rows:types}=await db.query('select oid,typname from pg_type');const names=new Map(types.map(t=>[t.oid,t.typname]));
const map=t=>['uuid','text','varchar','date','timestamptz','timestamp','time'].includes(t)?'string':['int2','int4','int8','numeric'].includes(t)?'number':t==='bool'?'boolean':t==='jsonb'||t==='json'?'Json':['_uuid','_text','text[]','uuid[]'].includes(t)?'string[]':t==='void'?'undefined':(()=>{throw Error('Unknown type '+t)})();
let out='/** RPC contracts generated from isolated migration replay; not proof of cloud deployment. */\nimport type {Database as CloudDatabase, Json} from "./cloud.types";\nexport type Database = Omit<CloudDatabase,"public"> & { public: Omit<CloudDatabase["public"],"Functions"> & { Functions: {\n';
for(const r of rows){out+=`${r.proname}: { Args: {${r.argtypes.map((t,i)=>`${r.proargnames[i]}${i>=r.argtypes.length-r.pronargdefaults?'?':''}: ${map(names.get(t))}${i>=r.argtypes.length-r.pronargdefaults?' | null':''}`).join('; ')} }; Returns: ${map(r.result==='boolean'?'bool':r.result==='integer'?'int4':r.result)} };\n`;}
out+='} } };\n';out=out.replaceAll('Args: { }','Args: Record<never, never>');await writeFile(new URL('../../src/lib/supabase/runtime.types.ts',import.meta.url),out);
}finally{await db.close();}
