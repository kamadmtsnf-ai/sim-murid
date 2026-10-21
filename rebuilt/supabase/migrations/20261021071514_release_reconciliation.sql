
begin;
create table sim_murid_private.reconciliation_runs(id uuid primary key default gen_random_uuid(),created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),source_checksum text not null,report jsonb not null);
create index reconciliation_actor on sim_murid_private.reconciliation_runs(created_by);
create function public.app_jobs_tick(p_dry_run boolean default true) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare today date:=public.app_ops_today();h integer:=extract(hour from now() at time zone 'Asia/Jakarta');recipient record;n integer:=0;students integer;recorded integer;begin
 select count(*) into students from sim_murid_private.enrollments e join public.academic_years y on y.id=e.academic_year_id where y.is_active and e.ended_at is null;
 select count(distinct student_id) into recorded from sim_murid_private.student_attendance where attendance_date=today and voided_at is null;
 if h in(15,17,19,21,23) and students>0 and recorded<students and not exists(select 1 from public.holidays where holiday_date=today) then
 for recipient in select distinct p.id,p.contact_email from sim_murid_private.teacher_duty_roster d join public.profiles p on p.id=d.teacher_id join sim_murid_private.auth_accounts a on a.user_id=p.id where d.weekday=extract(isodow from today) and p.status='active' and a.verified_contact_email=p.contact_email and public.app_education_task(p.id,'duty_teacher') loop
 n=n+1;if not p_dry_run and(select email_enabled from sim_murid_private.service_settings) then insert into sim_murid_private.outbox(idempotency_key,channel,event_type,aggregate_type,aggregate_id,payload) values('duty:'||today::text||':'||recipient.id::text,'email','duty','profile',recipient.id,jsonb_build_object('recipient_id',recipient.id,'email',recipient.contact_email,'title','Pengingat absensi guru piket','message','Absensi hari ini belum lengkap. Silakan periksa modul absensi.')) on conflict(idempotency_key) do nothing;end if;end loop;end if;
 if not p_dry_run and extract(day from today)=1 then perform public.app_point_reset((date_trunc('month',today)-interval '1 month')::date);end if;
 if not p_dry_run then
 -- Stage21 slips are inserted once into the durable delivery queue, independently of sending.
 insert into sim_murid_private.slip_deliveries(slip_id,recipient_id,email) select s.id,p.id,p.contact_email from sim_murid_private.withdrawal_slips s cross join public.profiles p join sim_murid_private.auth_accounts a on a.user_id=p.id where p.status='active' and p.contact_email=a.verified_contact_email and(public.app_ops_role(p.id,'admin') or public.app_education_task(p.id,'savings_manager')) and not exists(select 1 from sim_murid_private.savings_transactions r where r.reverses_id=s.transaction_id) on conflict(slip_id,recipient_id) do nothing;
 end if;
 return jsonb_build_object('code','saved','dryRun',p_dry_run,'reminderCandidates',n,'date',today,'hourWib',h);end$$;
create function public.app_jobs_admin(p_actor uuid,p_session uuid,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$begin
 if not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_command->>'type'='tick' then return public.app_jobs_tick(coalesce((p_command->>'dryRun')::boolean,true));
 elsif p_command->>'type'='retry' then update sim_murid_private.outbox set status='queued',available_at=now() where id=(p_command->>'id')::uuid and status='failed';return jsonb_build_object('code','saved');
 else return jsonb_build_object('code','invalid');end if;end$$;
create function public.app_delivery_worker(p_action text,p_id uuid default null,p_status text default null,p_provider text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare r sim_murid_private.outbox%rowtype;begin
 if p_action='claim' then
 update sim_murid_private.outbox set status='ambiguous',last_error_code='claim_expired' where status='processing' and locked_until<now();
 select * into r from sim_murid_private.outbox where status in('queued','failed') and attempts<5 and available_at<=now() and channel in('email','whatsapp') order by available_at for update skip locked limit 1;if not found then return jsonb_build_object('code','empty');end if;
 if not exists(select 1 from public.profiles p join sim_murid_private.auth_accounts a on a.user_id=p.id where p.id=(r.payload->>'recipient_id')::uuid and p.status='active' and((r.channel='email' and p.contact_email=r.payload->>'email' and a.verified_contact_email=p.contact_email) or(r.channel='whatsapp' and p.phone=r.payload->>'phone'))) then update sim_murid_private.outbox set status='cancelled',last_error_code='recipient_changed' where id=r.id;return jsonb_build_object('code','empty');end if;
 update sim_murid_private.outbox set status='processing',attempts=attempts+1,locked_until=now()+interval '2 minutes' where id=r.id;return jsonb_build_object('code','claimed','delivery',to_jsonb(r));
 elsif p_action='complete' and p_status in('sent','failed','ambiguous') then
 update sim_murid_private.outbox set status=p_status,provider_message_id=left(p_provider,200),last_error_code=case when p_status='sent' then null else p_status end,available_at=now()+interval '1 minute'*power(2,attempts),locked_until=null where id=p_id and status='processing';return jsonb_build_object('code','saved');end if;return jsonb_build_object('code','invalid');end$$;
create function public.app_ai_run(p_actor uuid,p_session uuid,p_action text,p_data jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare cfg sim_murid_private.ai_configs%rowtype;target uuid;cached_analysis sim_murid_private.ai_analyses%rowtype;essays jsonb;begin
 if not public.app_survey_manager(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_action='prepare' then
 select * into cfg from sim_murid_private.ai_configs where provider=p_data->>'provider';if not found then return jsonb_build_object('code','not_configured');end if;
 select coalesce(jsonb_agg(text),'[]') into essays from(select left(r.answers->>(q->>'code'),1500)text from sim_murid_private.survey_respondents r cross join lateral jsonb_array_elements(r.instrument)q where r.period_id=(p_data->>'periodId')::uuid and r.submitted_at is not null and q->>'kind'='essay' and length(btrim(r.answers->>(q->>'code')))>0 order by md5(r.user_id::text||(q->>'code')) limit 150)x;
 if jsonb_array_length(essays)<5 then return jsonb_build_object('code','incomplete');end if;
 insert into sim_murid_private.ai_analyses(period_id,scope,source_hash,status,model) values((p_data->>'periodId')::uuid,cfg.provider,md5(essays::text||cfg.model),'running',cfg.model) on conflict(period_id,scope,source_hash) do nothing returning id into target;
 if target is null then select * into cached_analysis from sim_murid_private.ai_analyses where period_id=(p_data->>'periodId')::uuid and scope=cfg.provider and source_hash=md5(essays::text||cfg.model);return jsonb_build_object('code','cached','analysis',to_jsonb(cached_analysis));end if;
 return jsonb_build_object('code','saved','id',target,'essays',essays,'config',to_jsonb(cfg));
 elsif p_action='complete' then
 update sim_murid_private.ai_analyses set status=case when p_data->>'error' is null then 'succeeded' else 'failed' end,result=p_data->'result',error_code=p_data->>'error',tokens=p_data->'tokens' where id=(p_data->>'id')::uuid and status='running';return jsonb_build_object('code','saved');
 elsif p_action='invalidate' then delete from sim_murid_private.ai_analyses where period_id=(p_data->>'periodId')::uuid and status<>'running';return jsonb_build_object('code','saved');end if;return jsonb_build_object('code','invalid');end$$;
-- Index every FK introduced by these migrations; private tables never become client-accessible.
do $$declare r record;cols text;begin for r in select c.conname,c.conrelid,c.conkey,n.nspname,t.relname from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where c.contype='f' and n.nspname='sim_murid_private' and not exists(select 1 from pg_index i where i.indrelid=c.conrelid and i.indisvalid and(i.indkey::smallint[])[0:cardinality(c.conkey)-1] @> c.conkey) loop select string_agg(quote_ident(a.attname),',' order by u.ord) into cols from unnest(r.conkey)with ordinality u(num,ord)join pg_attribute a on a.attrelid=r.conrelid and a.attnum=u.num;execute format('create index %I on %I.%I(%s)',left(r.conname,52)||'_idx',r.nspname,r.relname,cols);end loop;end$$;
alter table sim_murid_private.reconciliation_runs enable row level security;
revoke all on sim_murid_private.reconciliation_runs from public,anon,authenticated;
grant select,insert on sim_murid_private.reconciliation_runs to service_role;
do $$declare r record;begin for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and(p.proname like 'app_jobs_%' or p.proname in('app_delivery_worker','app_ai_run')) loop execute format('revoke all on function %s from public,anon,authenticated',r.signature);execute format('grant execute on function %s to service_role',r.signature);end loop;end$$;

create function public.app_survey_required(p_actor uuid,p_session uuid) returns boolean language sql stable security invoker set search_path='' as $$select public.app_onboarding_ready(p_actor,p_session) and exists(select 1 from sim_murid_private.survey_periods p join public.user_roles ur on ur.user_id=p_actor and ur.role_code=any(p.targets) where p.kind='main' and public.app_survey_open(p.id) and not exists(select 1 from sim_murid_private.survey_respondents r where r.period_id=p.id and r.user_id=p_actor and r.submitted_at is not null))$$;
revoke all on function public.app_survey_required(uuid,uuid) from public,anon,authenticated;
grant execute on function public.app_survey_required(uuid,uuid) to service_role;

-- Managed Supabase only; isolated replay has no pg_cron module.
do $$begin if exists(select 1 from pg_available_extensions where name='pg_cron') then
 execute 'create extension if not exists pg_cron with schema pg_catalog';
 execute $q$select cron.schedule('sim-services-hourly','0 * * * *','select public.app_jobs_tick(false)')$q$;
 end if;end$$;
commit;
