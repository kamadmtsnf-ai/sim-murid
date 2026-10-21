
begin;
create table sim_murid_private.inbox(id uuid primary key default gen_random_uuid(),recipient_id uuid not null references public.profiles(id),dedup_key text not null unique,title text not null,message text not null,entity_id uuid,read_at timestamptz,created_at timestamptz not null default now());
create index inbox_recipient on sim_murid_private.inbox(recipient_id,created_at desc);
create table sim_murid_private.service_settings(singleton boolean primary key default true check(singleton),email_enabled boolean not null default false,whatsapp_enabled boolean not null default false,point_threshold integer not null default 2 check(point_threshold between 0 and 5),peer_min integer not null default 5 check(peer_min between 5 and 100),affective_subject_id uuid references public.subjects(id));
insert into sim_murid_private.service_settings(singleton) values(true);
create index service_settings_subject on sim_murid_private.service_settings(affective_subject_id);
create function public.app_point_notify(p_student uuid,p_month date,p_event uuid) returns void language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare r jsonb;recipient uuid;title text;message text;key text;cfg sim_murid_private.service_settings%rowtype;begin
 if not exists(select 1 from sim_murid_private.point_events where id=p_event and base_points<0) then return;end if;
 r=public.app_point_replay(p_student,p_month);select * into cfg from sim_murid_private.service_settings;
 if (r->>'level')::integer<cfg.point_threshold and not exists(select 1 from jsonb_array_elements(r->'events')x where (x->>'id')::uuid=p_event and(x->>'r02'='true' or x->>'r03'='true')) then return;end if;
 title='Pemberitahuan poin kedisiplinan';message='Saldo '||(r->>'balance')||', tingkat '||(r->>'level')||'. Silakan lihat riwayat kedisiplinan. R02/R03 merupakan penanda tindak lanjut, bukan keputusan pengeluaran siswa.';
 for recipient in select p_student union select parent_id from sim_murid_private.student_guardians where student_id=p_student and revoked_at is null union select c.homeroom_teacher_id from sim_murid_private.enrollments e join public.classes c on c.id=e.class_id where e.student_id=p_student and e.ended_at is null and c.homeroom_teacher_id is not null union select user_id from public.user_assignments where assignment_code='counselor' and revoked_at is null and valid_from<=public.app_ops_today() and(valid_until is null or valid_until>=public.app_ops_today()) union select user_id from public.user_roles where role_code='admin' and(r->>'level')::integer>=3 loop
 key='point:'||p_event::text||':'||recipient::text;
 insert into sim_murid_private.inbox(recipient_id,dedup_key,title,message,entity_id) values(recipient,key,title,message,p_event) on conflict(dedup_key) do nothing;
 if cfg.email_enabled then insert into sim_murid_private.outbox(idempotency_key,channel,event_type,aggregate_type,aggregate_id,payload) select key||':email','email','point','point_event',p_event,jsonb_build_object('recipient_id',recipient,'email',p.contact_email,'title',title,'message',message) from public.profiles p join sim_murid_private.auth_accounts a on a.user_id=p.id where p.id=recipient and p.status='active' and a.verified_contact_email=p.contact_email on conflict(idempotency_key) do nothing;end if;
 if cfg.whatsapp_enabled then insert into sim_murid_private.outbox(idempotency_key,channel,event_type,aggregate_type,aggregate_id,payload) select key||':whatsapp','whatsapp','point','point_event',p_event,jsonb_build_object('recipient_id',recipient,'phone',p.phone,'title',title,'message',message) from public.profiles p where p.id=recipient and p.status='active' and p.phone~'^\+[1-9][0-9]{7,14}$' on conflict(idempotency_key) do nothing;end if;
 end loop;end$$;
create function public.app_point_reset(p_month date) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare sid uuid;n integer:=0;begin
 if p_month<>date_trunc('month',p_month)::date or p_month>=date_trunc('month',public.app_ops_today())::date then return jsonb_build_object('code','invalid');end if;
 insert into sim_murid_private.job_runs(job_key,job_type,business_date,status,started_at) values('point-reset:'||p_month::text,'point-reset',p_month,'running',now()) on conflict(job_key) do nothing;
 for sid in select distinct student_id from sim_murid_private.enrollments e join public.academic_years y on y.id=e.academic_year_id where p_month>=make_date(y.start_year,7,1) and p_month<make_date(y.start_year+1,7,1) loop
 insert into sim_murid_private.point_month_snapshots(student_id,month,snapshot) values(sid,p_month,public.app_point_replay(sid,p_month)) on conflict(student_id,month) do nothing;if found then n=n+1;end if;
 end loop;
 update sim_murid_private.job_runs set status='succeeded',finished_at=now(),result_summary=jsonb_build_object('snapshotsAdded',n) where job_key='point-reset:'||p_month::text;
 return jsonb_build_object('code','saved','added',n);end$$;
create function public.app_point_admin(p_actor uuid,p_session uuid,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare sid uuid;mo date;sub uuid;n integer:=0;r jsonb;begin
 if not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_command->>'type'='settings' then update sim_murid_private.service_settings set email_enabled=(p_command->>'email')::boolean,whatsapp_enabled=coalesce((p_command->>'whatsapp')::boolean,false),point_threshold=(p_command->>'threshold')::integer,affective_subject_id=(p_command->>'subjectId')::uuid;return jsonb_build_object('code','saved');
 elsif p_command->>'type'='reset' then return public.app_point_reset((p_command->>'month')::date);
 elsif p_command->>'type'='affective' then
 mo=(p_command->>'month')::date;select affective_subject_id into sub from sim_murid_private.service_settings;if sub is null then return jsonb_build_object('code','not_configured');end if;
 insert into sim_murid_private.affective_scores(student_id,month,subject_id,score,source) select student_id,month,sub,round(greatest(0,least(100,((snapshot->>'balance')::numeric+50)/150*100))),snapshot from sim_murid_private.point_month_snapshots where month=mo on conflict(student_id,month,subject_id) do nothing;get diagnostics n=row_count;return jsonb_build_object('code','saved','added',n);
 elsif p_command->>'type'='rebuild' then
 sid=(p_command->>'studentId')::uuid;mo=(p_command->>'month')::date;r=public.app_point_replay(sid,mo);return jsonb_build_object('code','saved','replay',r);
 else return jsonb_build_object('code','invalid');end if;end$$;
do $$declare t text;r record;begin foreach t in array array['inbox','service_settings'] loop execute format('alter table sim_murid_private.%I enable row level security',t);execute format('revoke all on sim_murid_private.%I from public,anon,authenticated',t);execute format('grant select,insert,update,delete on sim_murid_private.%I to service_role',t);end loop;for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('app_point_notify','app_point_reset','app_point_admin') loop execute format('revoke all on function %s from public,anon,authenticated',r.signature);execute format('grant execute on function %s to service_role',r.signature);end loop;end$$;

create function public.app_point_ranking(p_month date) returns jsonb language sql stable security invoker set search_path='' as $$select coalesce(jsonb_agg(z),'[]') from(select x,row_number()over(partition by x->>'class_id' order by(x#>>'{snapshot,balance}')::integer desc,(x#>>'{snapshot,violations}')::integer,x->>'student_id')class_rank,row_number()over(order by(x#>>'{snapshot,balance}')::integer desc,(x#>>'{snapshot,violations}')::integer,x->>'student_id')global_rank from(select jsonb_build_object('student_id',p.id,'name',p.full_name,'class_id',e.class_id,'class_name',c.name,'snapshot',coalesce(s.snapshot,public.app_point_replay(p.id,p_month)))x from public.profiles p join sim_murid_private.enrollments e on e.student_id=p.id join public.classes c on c.id=e.class_id join public.academic_years y on y.id=e.academic_year_id left join sim_murid_private.point_month_snapshots s on s.student_id=p.id and s.month=p_month where p_month>=make_date(y.start_year,7,1) and p_month<make_date(y.start_year+1,7,1))q)z$$;
revoke all on function public.app_point_ranking(date) from public,anon,authenticated;
grant execute on function public.app_point_ranking(date) to service_role;
commit;
