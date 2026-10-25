begin;
create table sim_murid_private.teacher_assignment_receipts (
 request_id uuid primary key, actor_id uuid not null references public.profiles(id), target_id uuid not null references public.profiles(id), fingerprint text not null, assignment_id uuid not null references public.user_assignments(id), created_at timestamptz not null default now()
);
create index teacher_assignment_receipts_actor_idx on sim_murid_private.teacher_assignment_receipts(actor_id);
create index teacher_assignment_receipts_target_idx on sim_murid_private.teacher_assignment_receipts(target_id);
create index teacher_assignment_receipts_assignment_idx on sim_murid_private.teacher_assignment_receipts(assignment_id);
alter table sim_murid_private.teacher_assignment_receipts enable row level security;
revoke all on sim_murid_private.teacher_assignment_receipts from public,anon,authenticated;
grant select,insert on sim_murid_private.teacher_assignment_receipts to service_role;
-- Service-only invoker: session/admin and target eligibility are rechecked in this transaction.
create function public.app_teacher_assignments(p_actor uuid,p_session uuid,p_target uuid,p_command jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare req uuid; task text; starts date; ends date; item uuid; previous record; result jsonb; action text;
begin
 if not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 perform 1 from public.profiles where id=p_target and status='active' for update;
 if not found or not exists(select 1 from public.user_roles where user_id=p_target and role_code='teacher') then return jsonb_build_object('code','not_found');end if;
 if p_command is not null then
  if jsonb_typeof(p_command)<>'object' or p_command->>'requestId' is null then return jsonb_build_object('code','invalid');end if;
  req=(p_command->>'requestId')::uuid;
  -- Serialise receipts across targets too, so a request cannot be reused on another teacher.
  perform pg_advisory_xact_lock(hashtextextended(req::text,0));
  select actor_id,target_id,fingerprint into previous from sim_murid_private.teacher_assignment_receipts where request_id=req;
  if found then
   if previous.actor_id<>p_actor or previous.target_id<>p_target or previous.fingerprint<>encode(sha256(convert_to(p_command::text,'UTF8')),'hex') then return jsonb_build_object('code','request_conflict');end if;
  else
   action=p_command->>'action';
   if action='assign' then
    if p_command-array['requestId','action','code','validFrom','validUntil']<>'{}'::jsonb then return jsonb_build_object('code','invalid');end if;
    task=p_command->>'code'; starts=(p_command->>'validFrom')::date; ends=nullif(p_command->>'validUntil','')::date;
    if task is null or task not in('school_head','committee_treasurer','savings_manager','student_mentor','counselor') or starts is null or starts<date '1900-01-01' or starts>date '2199-12-31' or (ends is not null and (ends<starts or ends>date '2199-12-31')) then return jsonb_build_object('code','invalid');end if;
    if exists(select 1 from public.user_assignments where user_id=p_target and assignment_code=task and scope_class_id is null and revoked_at is null and daterange(valid_from,valid_until,'[]') && daterange(starts,ends,'[]')) then return jsonb_build_object('code','overlap');end if;
    insert into public.user_assignments(user_id,assignment_code,valid_from,valid_until,assigned_by) values(p_target,task,starts,ends,p_actor) returning id into item;
   elsif action='revoke' then
    if p_command-array['requestId','action','id','reason']<>'{}'::jsonb or length(btrim(coalesce(p_command->>'reason','')))<5 or length(p_command->>'reason')>500 then return jsonb_build_object('code','invalid');end if;
    item=(p_command->>'id')::uuid;
    update public.user_assignments set revoked_at=now() where id=item and user_id=p_target and scope_class_id is null and assignment_code in('school_head','committee_treasurer','savings_manager','student_mentor','counselor') and revoked_at is null;
    if not found then return jsonb_build_object('code','not_found');end if;
   else return jsonb_build_object('code','invalid');end if;
   insert into sim_murid_private.teacher_assignment_receipts(request_id,actor_id,target_id,fingerprint,assignment_id) values(req,p_actor,p_target,encode(sha256(convert_to(p_command::text,'UTF8')),'hex'),item);
   insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id,metadata) values(p_actor,'user','user.assignment.'||action||'.'||coalesce(task,(select assignment_code from public.user_assignments where id=item)),'profile',p_target,req,jsonb_build_object('id',item,'reasonProvided',action='revoke'));
  end if;
 end if;
 select coalesce(jsonb_agg(row_data order by created_at desc,id),'[]'::jsonb) into result from (select id,created_at,jsonb_build_object('id',id,'code',assignment_code,'valid_from',valid_from,'valid_until',valid_until,'revoked_at',revoked_at) row_data from public.user_assignments where user_id=p_target and scope_class_id is null and assignment_code in('school_head','committee_treasurer','savings_manager','student_mentor','counselor') order by created_at desc,id limit 500) rows;
 return jsonb_build_object('code','ok','rows',result);
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then return jsonb_build_object('code','invalid');
end;$$;
revoke all on function public.app_teacher_assignments(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.app_teacher_assignments(uuid,uuid,uuid,jsonb) to service_role;
commit;
