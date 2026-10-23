-- Preserve pg-safeupdate, caller checks, transaction, audit and replay behavior.
begin;
create or replace function public.app_settings_write(p_actor uuid,p_session uuid,p_request uuid,p_revision bigint,p_command jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare rev bigint; old sim_murid_private.settings_requests%rowtype; kind text; target uuid; nm text; result jsonb; n integer:=0; total integer; dt date; finish date; previous text; slot text;
begin
 perform 1 from public.profiles where id=p_actor for share;
 perform 1 from public.user_roles where user_id=p_actor for share;
 if not public.app_onboarding_ready(p_actor,p_session) or not exists(select 1 from public.user_roles where user_id=p_actor and role_code='admin') then return jsonb_build_object('code','denied');end if;
 if p_request is null or p_revision is null or p_command is null or jsonb_typeof(p_command)<>'object' then return jsonb_build_object('code','invalid');end if;
 select revision into rev from sim_murid_private.settings_state for update;
 select * into old from sim_murid_private.settings_requests where id=p_request;
 if found then
  if old.actor=p_actor and old.command=p_command then return old.result;end if;
  return jsonb_build_object('code','request_conflict');
 end if;
 if p_revision<>rev then return jsonb_build_object('code','stale');end if;
 kind=p_command->>'type';
 if kind='profile' then
  if length(btrim(p_command#>>'{profile,name}')) not between 1 and 200 or jsonb_typeof(p_command#>'{profile,identity_data}') is distinct from 'object' or jsonb_typeof(p_command#>'{profile,address_data}') is distinct from 'object' then return jsonb_build_object('code','invalid');end if;
  insert into public.school_profile(name,identity_data,address_data,updated_by) values(btrim(p_command#>>'{profile,name}'),p_command#>'{profile,identity_data}',p_command#>'{profile,address_data}',p_actor)
  on conflict(singleton_key) do update set name=excluded.name,identity_data=excluded.identity_data,address_data=excluded.address_data,updated_by=p_actor returning id into target;
 elsif kind in ('subject','memorization') then
  target=(p_command->>'id')::uuid;nm=btrim(p_command->>'name');
  if nm is null or length(nm) not between 1 and (case when kind='subject' then 150 else 200 end) or nm~'[[:cntrl:]]' or (kind='subject' and position(',' in nm)>0) or jsonb_typeof(p_command->'active') is distinct from 'boolean' then return jsonb_build_object('code','invalid');end if;
  if kind='memorization' then nm=replace(nm,';',',');end if;
  if target is null then
   if kind='subject' then insert into public.subjects(code,name,sort_order,active) values('MP_'||upper(left(replace(gen_random_uuid()::text,'-',''),28)),nm,(select coalesce(max(sort_order),0)+1 from public.subjects),(p_command->>'active')::boolean) returning id into target;
   else insert into public.memorization_catalog(name,active) values(nm,(p_command->>'active')::boolean) returning id into target;end if;
  else
   if kind='subject' then update public.subjects set name=nm,active=(p_command->>'active')::boolean where id=target;
   else update public.memorization_catalog set name=nm,active=(p_command->>'active')::boolean where id=target;end if;
   if not found then return jsonb_build_object('code','not_found');end if;
  end if;
 elsif kind='deactivate' then
  target=(p_command->>'id')::uuid;
  if p_command->>'catalog'='subject' then update public.subjects set active=false where id=target;
  elsif p_command->>'catalog'='memorization' then update public.memorization_catalog set active=false where id=target;
  else return jsonb_build_object('code','invalid');end if;
  if not found then return jsonb_build_object('code','not_found');end if;
 elsif kind='holiday' then
  dt=(p_command->>'start')::date;finish=(p_command->>'end')::date;target=(p_command->>'id')::uuid;nm=btrim(p_command->>'description');
  if dt is null or finish is null or dt<'1900-01-01' or finish>'2200-12-31' or finish<dt or finish-dt>365 or nm is null or length(nm) not between 1 and 500 then return jsonb_build_object('code','invalid');end if;
  total=finish-dt+1;
  if target is not null then
   if dt<>finish then return jsonb_build_object('code','invalid');end if;
   update public.holidays set holiday_date=dt,description=nm where id=target;
   if not found then return jsonb_build_object('code','not_found');end if;n=1;
  else
   insert into public.holidays(holiday_date,description,created_by) select dt+s,nm,p_actor from generate_series(0,finish-dt)s on conflict(holiday_date) do nothing;
   get diagnostics n=row_count;
  end if;
 elsif kind='holiday_delete' then
  target=(p_command->>'id')::uuid;delete from public.holidays where id=target;
  if not found then return jsonb_build_object('code','not_found');end if;
 elsif kind in ('logo','logo_clear') then
  slot=p_command->>'slot';previous=p_command->>'path';
  if slot is null or slot not in ('school','cooperative') or (kind='logo' and (previous is null or previous!~'^[a-f0-9-]{36}\.png$')) then return jsonb_build_object('code','invalid');end if;
  if not exists(select 1 from public.school_profile) then return jsonb_build_object('code','profile_required');end if;
  select asset_data->>slot into previous from public.school_profile where singleton_key='main';
  if previous is not null then insert into sim_murid_private.school_asset_gc(path) values(previous) on conflict do nothing;end if;
  update public.school_profile set asset_data=case when kind='logo' then jsonb_set(asset_data,array[slot],to_jsonb(p_command->>'path')) else asset_data-slot end,updated_by=p_actor where singleton_key='main' returning id into target;
 else return jsonb_build_object('code','invalid');
 end if;
 update sim_murid_private.settings_state set revision=revision+1 where singleton=true returning revision into rev;
 result=jsonb_build_object('code','saved','revision',rev,'added',n,'skipped',coalesce(total,0)-n);
 insert into sim_murid_private.settings_requests(id,actor,command,result) values(p_request,p_actor,p_command,result);
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id,metadata)
 values(p_actor,'user','settings.'||kind,'settings',target,p_request,jsonb_build_object('revision',rev,'added',n,'skipped',coalesce(total,0)-n));
 return result;
exception when unique_violation then return jsonb_build_object('code','duplicate');
 when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or check_violation then return jsonb_build_object('code','invalid');
end;$$;


commit;
