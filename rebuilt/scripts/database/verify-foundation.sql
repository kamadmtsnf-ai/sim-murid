-- Read-only catalog checks. Can run after migrations on the selected target.
select n.nspname as schema_name,c.relname as table_name,c.relrowsecurity as rls_enabled,
 has_table_privilege('anon',c.oid,'SELECT') as anon_can_read,
 has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_can_read
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','sim_murid_private') and c.relkind='r'
order by n.nspname,c.relname;

select n.nspname as schema_name,p.proname,p.prosecdef as security_definer,p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='sim_murid_private' order by p.proname;

select c.conname as unindexed_foreign_key,n.nspname as schema_name,t.relname as table_name
from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
where c.contype='f' and n.nspname in ('public','sim_murid_private')
 and not exists (
  select 1 from pg_index i where i.indrelid=c.conrelid and i.indisvalid
  and (i.indkey::smallint[])[0:cardinality(c.conkey)-1] @> c.conkey
 );
