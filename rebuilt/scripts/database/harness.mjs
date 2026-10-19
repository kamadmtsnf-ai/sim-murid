import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

/** Test-only adapter. Not a replacement for managed Supabase Auth or API. */
export async function createIsolatedDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub','')::uuid;$$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id),not_after timestamptz);
    grant usage on schema public to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to anon,authenticated;
  `);
  const names = (await readdir(`${projectRoot}supabase/migrations`)).filter((name) => name.endsWith('.sql')).sort();
  if (new Set(names.map((name) => name.split('_')[0])).size !== names.length) throw Error('Duplicate migration timestamps');
  try {
    for (const name of names) await db.exec(await readFile(`${projectRoot}supabase/migrations/${name}`, 'utf8'));
    await db.exec(await readFile(`${projectRoot}supabase/seed.sql`, 'utf8'));
  } catch (error) {
    await db.exec('rollback');
    await db.close();
    throw error;
  }
  return { db, migrations: names };
}
