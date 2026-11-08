begin;
-- WP-07 rollout is explicit and off by default. follow_up is intentionally not supported:
-- action-plan owners are free text, without a verified account relationship.
alter table sim_murid_private.push_settings add column expanded_pilot_categories text[] not null default '{}' check(expanded_pilot_categories <@ array['schedule','reports','surveys','documents']::text[]);
alter table sim_murid_private.push_events drop constraint push_events_category_check;
alter table sim_murid_private.push_events add constraint push_events_category_check check(category in('test','points','schedule','reports','surveys','documents'));
create table sim_murid_private.push_category_members(
 category text not null check(category in('schedule','reports','surveys','documents')),
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),expires_at timestamptz not null,revoked_at timestamptz,
 primary key(category,user_id),check(expires_at>created_at and expires_at<=created_at+interval '30 days')
);
create table sim_murid_private.push_sources(
 id uuid primary key default gen_random_uuid(),category text not null check(category in('schedule','reports','surveys','documents')),
 kind text not null check(kind in('lesson','student_duty','report','survey','student_document')),
 entity_id uuid not null,version bigint not null check(version>0),latest_version bigint not null check(latest_version>=version),
 class_id uuid references public.classes(id),owner_id uuid references public.profiles(id),
 occurred_at timestamptz not null,expires_at timestamptz not null,
 unique(kind,entity_id,version),check(expires_at>occurred_at and expires_at<=occurred_at+interval '24 hours'),
 check((category='schedule' and kind in('lesson','student_duty') and class_id is not null and class_id=entity_id and owner_id is null)
 or(category='reports' and kind='report' and class_id is not null and owner_id is not null)
 or(category='surveys' and kind='survey' and class_id is null and owner_id is null)
 or(category='documents' and kind='student_document' and class_id is null and owner_id is not null))
);
create index push_sources_latest on sim_murid_private.push_sources(kind,entity_id,latest_version desc);
create index push_category_member_user on sim_murid_private.push_category_members(user_id);
create index push_source_class on sim_murid_private.push_sources(class_id);
create index push_source_owner on sim_murid_private.push_sources(owner_id);
create index push_events_source on sim_murid_private.push_events(source_id);
create index push_delivery_pending_event on sim_murid_private.push_deliveries(event_id) where status in('queued','retry_wait','processing');

do $$declare t text;begin foreach t in array array['push_category_members','push_sources'] loop
 execute format('alter table sim_murid_private.%I enable row level security',t);
 execute format('revoke all on sim_murid_private.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on sim_murid_private.%I to service_role',t);end loop;end$$;
create function sim_murid_private.push_category_capacity() returns trigger language plpgsql security invoker set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended('push-cohort:'||new.category,0));
 if new.revoked_at is null and new.expires_at>now() and (select count(*) from sim_murid_private.push_category_members where category=new.category and user_id<>new.user_id and revoked_at is null and expires_at>now())>=200 then raise exception 'Push cohort capacity reached' using errcode='23514';end if;return new;end$$;
create trigger push_cohort_capacity before insert or update on sim_murid_private.push_category_members for each row execute function sim_murid_private.push_category_capacity();
create function sim_murid_private.push_expanded_allowed(p_category text,p_user uuid,p_at timestamptz) returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((select p_category=any(c.expanded_pilot_categories) and m.revoked_at is null and m.created_at<=p_at and m.expires_at>now()
 from sim_murid_private.push_settings c join sim_murid_private.push_category_members m on m.category=p_category and m.user_id=p_user where c.singleton=true),false)
$$;
-- Sessionless resource predicate, mirroring the class reader for affected recipients only.
-- Expired Auth sessions do not automatically revoke an opted-in device.
create function sim_murid_private.push_class_scope(p_user uuid,p_class uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((select case when r.role_code='teacher' then sim_murid_private.homeroom_access(p_user,c.id) or exists(select 1 from sim_murid_private.lesson_schedules l where l.class_id=c.id and l.teacher_id=p_user and l.archived_at is null)
 when r.role_code='student' then exists(select 1 from sim_murid_private.enrollments e where e.class_id=c.id and e.student_id=p_user and e.ended_at is null and e.starts_on<=public.app_ops_today())
 when r.role_code='parent' then exists(select 1 from sim_murid_private.enrollments e join sim_murid_private.student_guardians g on g.student_id=e.student_id where e.class_id=c.id and g.parent_id=p_user and g.revoked_at is null and e.ended_at is null and e.starts_on<=public.app_ops_today()) else false end
 from public.classes c join public.academic_years y on y.id=c.academic_year_id join public.user_roles r on r.user_id=p_user
 where c.id=p_class and c.archived_at is null and y.is_active),false)
$$;
create function sim_murid_private.push_owner_scope(p_user uuid,p_owner uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id where p.id=p_owner and p.status='active' and r.role_code in('student','applicant','alumni'))
 and (p_user=p_owner or (public.app_ops_role(p_user,'parent') and exists(select 1 from sim_murid_private.student_guardians where parent_id=p_user and student_id=p_owner and revoked_at is null)))
$$;
create function sim_murid_private.push_source_key(p_source uuid,p_user uuid) returns text language sql stable security invoker set search_path='' as $$
 select case s.category when 'schedule' then 'schedule:'||s.kind||':'||s.entity_id||':'||s.version||':'||p_user
 when 'reports' then 'report:'||s.entity_id||':'||p_user
 when 'surveys' then 'survey:'||s.entity_id||':'||p_user||':'||to_char(s.occurred_at at time zone 'Asia/Jakarta','YYYY-MM-DD')
 when 'documents' then 'document:'||s.entity_id||':1:'||p_user end from sim_murid_private.push_sources s where s.id=p_source
$$;
create function sim_murid_private.push_extended_scope(p_source uuid,p_user uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((select p.status='active' and case s.category
 when 'schedule' then sim_murid_private.push_class_scope(p_user,s.class_id)
 when 'reports' then exists(select 1 from sim_murid_private.report_snapshots r where r.id=s.entity_id and r.student_id=s.owner_id and r.class_id=s.class_id and sim_murid_private.push_owner_scope(p_user,r.student_id))
 when 'surveys' then exists(select 1 from sim_murid_private.survey_periods sp join public.user_roles ur on ur.user_id=p_user where sp.id=s.entity_id and ur.role_code=any(sp.targets))
 when 'documents' then exists(select 1 from sim_murid_private.student_documents d where d.id=s.entity_id and d.owner_id=s.owner_id and d.state='ready' and d.sha256 is not null and sim_murid_private.push_owner_scope(p_user,d.owner_id)) else false end
 from sim_murid_private.push_sources s join public.profiles p on p.id=p_user where s.id=p_source),false)
$$;
create function sim_murid_private.push_extended_dispatch(p_source uuid,p_user uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select sim_murid_private.push_extended_scope(p_source,p_user) and coalesce((select sim_murid_private.push_expanded_allowed(s.category,p_user,s.occurred_at)
 and not exists(select 1 from sim_murid_private.push_sources newer where newer.kind=s.kind and newer.entity_id=s.entity_id and newer.latest_version>s.latest_version)
 and (s.category<>'surveys' or exists(select 1 from sim_murid_private.survey_periods sp where sp.id=s.entity_id and sp.kind='main' and public.app_survey_open(sp.id)
 and s.version=to_char(public.app_ops_today(),'YYYYMMDD')::bigint and not exists(select 1 from sim_murid_private.survey_respondents r where r.period_id=sp.id and r.user_id=p_user and r.submitted_at is not null)))
 from sim_murid_private.push_sources s where s.id=p_source),false)
$$;

create or replace function sim_murid_private.push_eligible(p_event uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((select p.status='active' and i.recipient_id=e.recipient_id and
 case when e.category='test' then true when e.category='points' then exists(
 select 1 from sim_murid_private.point_events pe where pe.id=e.source_id and pe.cancelled_at is null and pe.base_points<0 and i.entity_id=pe.id and i.dedup_key='point:'||pe.id::text||':'||e.recipient_id::text and
 (e.recipient_id=pe.student_id or exists(select 1 from sim_murid_private.student_guardians where student_id=pe.student_id and parent_id=e.recipient_id and revoked_at is null)
 or exists(select 1 from sim_murid_private.enrollments en join public.classes c on c.id=en.class_id where en.student_id=pe.student_id and en.ended_at is null and c.homeroom_teacher_id=e.recipient_id and sim_murid_private.homeroom_access(e.recipient_id,c.id))
 or exists(select 1 from public.user_assignments where user_id=e.recipient_id and assignment_code='counselor' and public.app_ops_role(user_id,'teacher') and revoked_at is null and valid_from<=public.app_ops_today() and(valid_until is null or valid_until>=public.app_ops_today()))
 or (public.app_ops_role(e.recipient_id,'admin') and (public.app_point_replay(pe.student_id,date_trunc('month',pe.event_date)::date)->>'level')::integer>=3))) when e.category in('schedule','reports','surveys','documents') then exists(select 1 from sim_murid_private.push_sources ps where ps.id=e.source_id and ps.category=e.category and i.entity_id=ps.entity_id and i.dedup_key=sim_murid_private.push_source_key(ps.id,e.recipient_id) and sim_murid_private.push_extended_scope(ps.id,e.recipient_id)) else false end
 from sim_murid_private.push_events e join public.profiles p on p.id=e.recipient_id join sim_murid_private.inbox i on i.id=e.inbox_id where e.id=p_event),false)
$$;

create or replace function sim_murid_private.push_dispatch_eligible(p_event uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select sim_murid_private.push_eligible(p_event) and coalesce((select case when e.category='test' then true when e.category='points' then sim_murid_private.push_point_pilot_allowed(e.recipient_id,pe.created_at) else sim_murid_private.push_extended_dispatch(e.source_id,e.recipient_id) end
 from sim_murid_private.push_events e left join sim_murid_private.point_events pe on pe.id=e.source_id where e.id=p_event),false)
$$;

create or replace function public.app_push_enqueue(p_inbox uuid,p_category text,p_source uuid,p_dedup text,p_occurred timestamptz,p_expires timestamptz,p_subscription uuid default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare i sim_murid_private.inbox%rowtype;e sim_murid_private.push_events%rowtype;cfg sim_murid_private.push_settings%rowtype;oid uuid;sid uuid;begin
 select * into cfg from sim_murid_private.push_settings for share;
 if not cfg.enabled or (p_category='test' and not cfg.test_enabled) or (p_category<>'test' and not(p_category=any(cfg.categories))) then return jsonb_build_object('code','disabled');end if;
 if p_category not in('test','points','schedule','reports','surveys','documents') or p_occurred is null or p_expires is null or p_occurred>now() or p_expires<=now() or p_expires>p_occurred+interval '24 hours' or (p_category='test' and (p_expires>p_occurred+interval '5 minutes' or p_subscription is null)) then return jsonb_build_object('code','invalid');end if;
 select * into i from sim_murid_private.inbox where id=p_inbox;if not found then return jsonb_build_object('code','not_found');end if;
 -- A member can only receive events created after their explicit enrolment.
 if p_category='points' and not exists(select 1 from sim_murid_private.point_events pe where pe.id=p_source and sim_murid_private.push_point_pilot_allowed(i.recipient_id,pe.created_at)) then return jsonb_build_object('code','disabled');end if;
 if p_category in('schedule','reports','surveys','documents') and not exists(select 1 from sim_murid_private.push_sources ps where ps.id=p_source and ps.category=p_category and ps.occurred_at=p_occurred and ps.expires_at=p_expires and sim_murid_private.push_expanded_allowed(p_category,i.recipient_id,ps.occurred_at)) then return jsonb_build_object('code','disabled');end if;
 -- Serialize event idempotency and fan-out as a single transaction.
 perform pg_advisory_xact_lock(hashtextextended('push-event:'||p_dedup,0));
 select * into e from sim_murid_private.push_events where dedup_key=p_dedup;
 if found then if e.inbox_id<>p_inbox or e.category<>p_category or e.source_id<>p_source then return jsonb_build_object('code','request_conflict');end if;return jsonb_build_object('code','duplicate','id',e.id);end if;
 if exists(select 1 from sim_murid_private.push_events where inbox_id=p_inbox and category=p_category) then return jsonb_build_object('code','request_conflict');end if;
 if p_category='test' and not exists(select 1 from sim_murid_private.push_subscriptions where id=p_subscription and user_id=i.recipient_id and status='active') then return jsonb_build_object('code','denied');end if;
 if p_category<>'test' and not exists(select 1 from sim_murid_private.push_preferences where user_id=i.recipient_id and p_category=any(categories)) then return jsonb_build_object('code','disabled');end if;
 insert into sim_murid_private.outbox(idempotency_key,channel,event_type,aggregate_type,aggregate_id,payload)
 values('push:'||p_dedup,'push',case p_category when 'test' then 'device.test' when 'points' then 'point.alert' when 'schedule' then 'schedule.changed' when 'reports' then 'report.published' when 'surveys' then 'survey.reminder' else 'document.ready' end,'inbox',p_inbox,jsonb_build_object('recipient_id',i.recipient_id,'inbox_id',p_inbox)) returning id into oid;
 insert into sim_murid_private.push_events(outbox_id,inbox_id,recipient_id,category,source_id,dedup_key,occurred_at,expires_at)
 values(oid,p_inbox,i.recipient_id,p_category,p_source,p_dedup,p_occurred,p_expires) returning * into e;
 if not sim_murid_private.push_dispatch_eligible(e.id) then raise exception 'Push source denied' using errcode='42501';end if;
 insert into sim_murid_private.push_deliveries(event_id,subscription_id,binding_version,available_at)
 select e.id,s.id,s.binding_version,case when p_category='test' then now() else sim_murid_private.push_not_before(i.recipient_id,now()) end
 from sim_murid_private.push_subscriptions s where s.user_id=i.recipient_id and s.status='active' and s.enabled_at<=p_occurred and(s.expires_at is null or s.expires_at>now()) and(p_subscription is null or s.id=p_subscription) on conflict do nothing;
 update sim_murid_private.push_events set materialized_at=now() where id=e.id;
 if p_category='schedule' then update sim_murid_private.push_deliveries set available_at=greatest(available_at,p_occurred+interval '60 seconds') where event_id=e.id;end if;
 perform sim_murid_private.push_refresh_outbox(e.id);
 return jsonb_build_object('code','saved','id',e.id);
exception when insufficient_privilege then return jsonb_build_object('code','denied');
 when unique_violation then return jsonb_build_object('code','request_conflict');
 when check_violation or not_null_violation then return jsonb_build_object('code','invalid');end$$;

create or replace function public.app_push_open(p_actor uuid,p_session uuid,p_ref uuid,p_mark boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare e sim_murid_private.push_events%rowtype;i sim_murid_private.inbox%rowtype;begin
 if not public.app_onboarding_ready(p_actor,p_session) then return null;end if;
 select pe.* into e from sim_murid_private.push_deliveries d join sim_murid_private.push_events pe on pe.id=d.event_id where d.delivery_ref=p_ref and pe.recipient_id=p_actor;
 if not found or not sim_murid_private.push_eligible(e.id) then return null;end if;
 select * into i from sim_murid_private.inbox where id=e.inbox_id and recipient_id=p_actor;
 if not found then return null;end if;
 if p_mark and i.read_at is null then
 -- Preserve the existing notification writer's operations revision discipline.
 perform 1 from sim_murid_private.operations_state where singleton=true for update;
 update sim_murid_private.inbox set read_at=coalesce(read_at,now()) where id=e.inbox_id and recipient_id=p_actor and read_at is null returning * into i;
 if found then update sim_murid_private.operations_state set revision=revision+1 where singleton=true;
 else select * into i from sim_murid_private.inbox where id=e.inbox_id and recipient_id=p_actor;end if;
 end if;
 return jsonb_build_object('category',e.category,'context',(select jsonb_build_object('owner_id',s.owner_id,'class_id',s.class_id,'year_id',c.academic_year_id,'semester',(select semester from sim_murid_private.report_snapshots where id=s.entity_id and s.kind='report')) from sim_murid_private.push_sources s left join public.classes c on c.id=s.class_id where s.id=e.source_id and s.category=e.category),'id',i.id,'title',i.title,'message',i.message,'created_at',i.created_at,'read_at',i.read_at);
end$$;

-- Canonical source projection. Only trusted domain triggers/reminder worker call this.
create function sim_murid_private.push_emit_source(p_kind text,p_entity uuid,p_version bigint,p_only uuid default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare cat text;cls uuid;owner uuid;at_time timestamptz:=now();deadline timestamptz;src sim_murid_private.push_sources%rowtype;previous sim_murid_private.push_sources%rowtype;m record;iid uuid;k text;enqueued jsonb;begin
 select case p_kind when 'lesson' then 'schedule' when 'student_duty' then 'schedule' when 'report' then 'reports' when 'survey' then 'surveys' when 'student_document' then 'documents' end into cat;
 perform 1 from sim_murid_private.push_settings where singleton=true and enabled and cat=any(categories) and cat=any(expanded_pilot_categories) for share;
 if not found or p_version is null or p_version<1 then return null;end if;
 if cat='schedule' then
 select c.id into cls from public.classes c join public.academic_years y on y.id=c.academic_year_id where c.id=p_entity and c.archived_at is null and y.is_active;if not found then return null;end if;
 deadline=at_time+interval '1 hour';
 elsif cat='reports' then
 select student_id,class_id,published_at into owner,cls,at_time from sim_murid_private.report_snapshots where id=p_entity;if not found or p_version<>1 then return null;end if;deadline=at_time+interval '24 hours';
 elsif cat='documents' then
 select owner_id,updated_at into owner,at_time from sim_murid_private.student_documents where id=p_entity and state='ready' and sha256 is not null;if not found or p_version<>1 then return null;end if;deadline=at_time+interval '24 hours';
 elsif cat='surveys' then
 select least(at_time+interval '24 hours',(ends_on+1)::timestamp at time zone 'Asia/Jakarta') into deadline from sim_murid_private.survey_periods where id=p_entity and kind='main' and public.app_survey_open(id);
 if not found or p_version<>to_char(public.app_ops_today(),'YYYYMMDD')::bigint then return null;end if;
 else return null;end if;
 if deadline<=now() or at_time>now() then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended('push-source:'||p_kind||':'||p_entity,0));
 select * into previous from sim_murid_private.push_sources where kind=p_kind and entity_id=p_entity order by latest_version desc limit 1 for update;
 if found and p_version<=previous.latest_version then
 if cat<>'surveys' then return previous.id;end if;src=previous;
 elsif cat='schedule' and previous.id is not null and previous.occurred_at>now()-interval '60 seconds'
 and not exists(select 1 from sim_murid_private.push_events e join sim_murid_private.inbox i on i.id=e.inbox_id left join sim_murid_private.push_deliveries d on d.event_id=e.id where e.source_id=previous.id and(i.read_at is not null or d.attempts>0 or d.status<>'queued')) then
 -- Merge only unread, never-attempted deliveries. Once any IO/read is possible, use a new event.
 update sim_murid_private.push_sources set latest_version=p_version,occurred_at=at_time,expires_at=deadline where id=previous.id returning * into src;
 update sim_murid_private.push_events set occurred_at=at_time,expires_at=deadline where source_id=src.id;
 update sim_murid_private.push_deliveries d set available_at=greatest(at_time+interval '60 seconds',sim_murid_private.push_not_before(e.recipient_id,at_time)) from sim_murid_private.push_events e where e.id=d.event_id and e.source_id=src.id and d.status='queued';
 update sim_murid_private.inbox i set created_at=at_time from sim_murid_private.push_events e where e.inbox_id=i.id and e.source_id=src.id and i.read_at is null;
 else
 insert into sim_murid_private.push_sources(category,kind,entity_id,version,latest_version,class_id,owner_id,occurred_at,expires_at) values(cat,p_kind,p_entity,p_version,p_version,cls,owner,at_time,deadline) returning * into src;
 end if;
 update sim_murid_private.push_deliveries d set status='cancelled',claim_token=null,locked_until=null,last_error_code='source_superseded'
 from sim_murid_private.push_events e join sim_murid_private.push_sources s on s.id=e.source_id where e.id=d.event_id and s.kind=p_kind and s.entity_id=p_entity and s.latest_version<src.latest_version and d.status in('queued','retry_wait','processing');
 for m in select user_id from sim_murid_private.push_category_members where category=cat and(p_only is null or user_id=p_only) and revoked_at is null and expires_at>now() and created_at<=src.occurred_at order by user_id limit 200 loop
 if not sim_murid_private.push_extended_dispatch(src.id,m.user_id) or not exists(select 1 from sim_murid_private.push_preferences where user_id=m.user_id and cat=any(categories)) then continue;end if;
 k=sim_murid_private.push_source_key(src.id,m.user_id);
 insert into sim_murid_private.inbox(recipient_id,dedup_key,title,message,entity_id) values(m.user_id,k,
 case cat when 'schedule' then 'Perubahan jadwal dan piket' when 'reports' then 'Rapor tersedia' when 'surveys' then 'Pengingat survei wajib' else 'Dokumen terverifikasi tersedia' end,
 case cat when 'schedule' then 'Jadwal kelas telah diperbarui. Buka Jadwal dan Piket untuk melihat versi terbaru.' when 'reports' then 'Snapshot rapor telah diterbitkan. Buka menu Rapor untuk melihat detail.' when 'surveys' then 'Masih ada survei wajib yang belum diselesaikan. Buka menu Survei.' else 'Dokumen telah selesai diverifikasi. Buka Biodata dan dokumen untuk melihatnya.' end,p_entity) on conflict(dedup_key) do nothing returning id into iid;
 if iid is not null then enqueued=public.app_push_enqueue(iid,cat,src.id,k,src.occurred_at,src.expires_at);if enqueued->>'code' not in('saved','duplicate','disabled','denied') then raise exception 'Push queue invariant failed' using errcode='23514';end if;end if;
 end loop;
 return src.id;
end$$;

-- Category 1: committed lesson/duty changes, scoped to the affected class(es).
create function sim_murid_private.push_schedule_changed() returns trigger language plpgsql security invoker set search_path='' as $$
declare v bigint;k text;begin
 if tg_op='UPDATE' and (to_jsonb(new)-'updated_at') is not distinct from (to_jsonb(old)-'updated_at') then return null;end if;
 select revision+1 into v from sim_murid_private.education_state;
 k=case when tg_table_name='lesson_schedules' then 'lesson' else 'student_duty' end;
 if tg_op<>'INSERT' then perform sim_murid_private.push_emit_source(k,old.class_id,v);end if;
 if tg_op='INSERT' or (tg_op='UPDATE' and new.class_id is distinct from old.class_id) then perform sim_murid_private.push_emit_source(k,new.class_id,v);end if;return null;
end$$;
create trigger push_lesson_changed after insert or update or delete on sim_murid_private.lesson_schedules for each row execute function sim_murid_private.push_schedule_changed();
create trigger push_student_duty_changed after insert or update or delete on sim_murid_private.student_duty_assignments for each row execute function sim_murid_private.push_schedule_changed();
-- Category 2: immutable publication only; never drafts or grade edits. D10 remains unchanged.
create function sim_murid_private.push_report_published() returns trigger language plpgsql security invoker set search_path='' as $$begin
 perform sim_murid_private.push_emit_source('report',new.id,1);return null;end$$;
create trigger push_report_published after insert on sim_murid_private.report_snapshots for each row execute function sim_murid_private.push_report_published();
-- Category 4: byte-verified ready transition, NOT approval or issuance of a school certificate.
create function sim_murid_private.push_document_ready() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if new.state='ready' and old.state is distinct from 'ready' and new.sha256 is not null then perform sim_murid_private.push_emit_source('student_document',new.id,1);end if;return null;end$$;
create trigger push_document_ready after update of state on sim_murid_private.student_documents for each row execute function sim_murid_private.push_document_ready();
-- Category 3: bounded daily candidates; called only by the authenticated push worker,
-- using BOTH environment and database flags. Does not tick legacy email/WA/reset jobs.
create function public.app_push_reminders(p_enabled boolean,p_categories text[]) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r record;n integer:=0;day_key bigint:=to_char(public.app_ops_today(),'YYYYMMDD')::bigint;begin
 if not coalesce(p_enabled,false) or not('surveys'=any(coalesce(p_categories,'{}'))) or not exists(select 1 from sim_murid_private.push_settings where enabled and dispatch_enabled and 'surveys'=any(categories) and 'surveys'=any(expanded_pilot_categories)) then return jsonb_build_object('code','saved','created',0);end if;
 for r in select sp.id,m.user_id from sim_murid_private.survey_periods sp join sim_murid_private.push_category_members m on m.category='surveys'
 join public.profiles p on p.id=m.user_id and p.status='active' join public.user_roles ur on ur.user_id=p.id and ur.role_code=any(sp.targets)
 where sp.kind='main' and public.app_survey_open(sp.id) and m.revoked_at is null and m.expires_at>now()
 and exists(select 1 from sim_murid_private.push_preferences where user_id=p.id and 'surveys'=any(categories))
 and exists(select 1 from sim_murid_private.push_subscriptions where user_id=p.id and status='active' and(expires_at is null or expires_at>now()))
 and not exists(select 1 from sim_murid_private.survey_respondents sr where sr.period_id=sp.id and sr.user_id=p.id and sr.submitted_at is not null)
 and not exists(select 1 from sim_murid_private.inbox i where i.dedup_key='survey:'||sp.id||':'||p.id||':'||public.app_ops_today())
 and not exists(select 1 from sim_murid_private.push_sources s where s.kind='survey' and s.entity_id=sp.id and s.version=day_key and m.created_at>s.occurred_at)
 order by sp.id,m.user_id limit 20 loop
 perform sim_murid_private.push_emit_source('survey',r.id,day_key,r.user_id);n=n+1;
 end loop;return jsonb_build_object('code','saved','created',n);
end$$;
revoke all on function public.app_push_reminders(boolean,text[]) from public,anon,authenticated;
grant execute on function public.app_push_reminders(boolean,text[]) to service_role;

create function sim_murid_private.push_cancel_extended() returns trigger language plpgsql security invoker set search_path='' as $$begin
 perform 1 from sim_murid_private.push_settings where singleton=true for share;
 -- A shortened open survey also shortens the provider TTL; never extend an old event.
 update sim_murid_private.push_sources s set expires_at=least(s.expires_at,(sp.ends_on+1)::timestamp at time zone 'Asia/Jakarta')
 from sim_murid_private.survey_periods sp where s.kind='survey' and s.entity_id=sp.id and public.app_survey_open(sp.id) and (sp.ends_on+1)::timestamp at time zone 'Asia/Jakarta'<s.expires_at and (sp.ends_on+1)::timestamp at time zone 'Asia/Jakarta'>s.occurred_at;
 update sim_murid_private.push_events e set expires_at=s.expires_at from sim_murid_private.push_sources s where s.id=e.source_id and s.kind='survey' and e.expires_at>s.expires_at;

 update sim_murid_private.push_deliveries d set status='cancelled',claim_token=null,locked_until=null,last_error_code='extended_scope_changed'
 from sim_murid_private.push_events e where e.id=d.event_id and e.category in('schedule','reports','surveys','documents') and d.status in('queued','retry_wait','processing')
 and (not sim_murid_private.push_dispatch_eligible(e.id) or not exists(select 1 from sim_murid_private.push_settings c where c.enabled and e.category=any(c.categories))
 or not exists(select 1 from sim_murid_private.push_preferences p where p.user_id=e.recipient_id and e.category=any(p.categories)));
 return null;end$$;
create trigger push_extended_scope after update or delete on sim_murid_private.student_guardians for each statement execute function sim_murid_private.push_cancel_extended();
create trigger push_extended_scope after update or delete on sim_murid_private.enrollments for each statement execute function sim_murid_private.push_cancel_extended();
create trigger push_extended_scope after update or delete on sim_murid_private.push_category_members for each statement execute function sim_murid_private.push_cancel_extended();
create trigger push_extended_scope after update or delete on sim_murid_private.push_preferences for each statement execute function sim_murid_private.push_cancel_extended();
create trigger push_extended_scope after update or delete on sim_murid_private.survey_periods for each statement execute function sim_murid_private.push_cancel_extended();
create trigger push_extended_scope after insert or update or delete on sim_murid_private.survey_respondents for each statement execute function sim_murid_private.push_cancel_extended();
create trigger push_extended_scope after update or delete on sim_murid_private.student_documents for each statement execute function sim_murid_private.push_cancel_extended();
create trigger push_extended_scope after update or delete on sim_murid_private.lesson_schedules for each statement execute function sim_murid_private.push_cancel_extended();
create trigger push_extended_scope after update or delete on public.classes for each statement execute function sim_murid_private.push_cancel_extended();
create trigger push_extended_scope after update or delete on public.academic_years for each statement execute function sim_murid_private.push_cancel_extended();
create trigger push_extended_scope after update or delete on public.user_assignments for each statement execute function sim_murid_private.push_cancel_extended();
create trigger push_extended_scope after update or delete on public.user_roles for each statement execute function sim_murid_private.push_cancel_extended();
create trigger push_extended_scope after update or delete on sim_murid_private.push_settings for each statement execute function sim_murid_private.push_cancel_extended();

create or replace function public.app_push_maintenance(p_enabled boolean,p_test boolean,p_categories text[]) returns jsonb language plpgsql security invoker set search_path='' as $$
declare n integer;k integer;begin
 update sim_murid_private.push_deliveries set status='ambiguous',claim_token=null,locked_until=null,last_error_code='lease_expired' where status='processing' and locked_until<=now();
 update sim_murid_private.push_deliveries d set status='expired',claim_token=null,locked_until=null,last_error_code='ttl_expired' from sim_murid_private.push_events e where e.id=d.event_id and d.status in('queued','retry_wait') and e.expires_at<=now();
 update sim_murid_private.push_deliveries d set status='cancelled',claim_token=null,locked_until=null,last_error_code='channel_disabled' from sim_murid_private.push_events e,sim_murid_private.push_settings c where e.id=d.event_id and d.status in('queued','retry_wait','processing') and (not coalesce(p_enabled,false) or not c.enabled or (e.category='test' and (not coalesce(p_test,false) or not c.test_enabled)) or (e.category<>'test' and (not(e.category=any(coalesce(p_categories,'{}'))) or not(e.category=any(c.categories)))));
 get diagnostics n=row_count;
 update sim_murid_private.push_deliveries d set status='cancelled',claim_token=null,locked_until=null,last_error_code='source_scope_changed'
 from sim_murid_private.push_events e where e.id=d.event_id and e.category<>'test' and d.status in('queued','retry_wait','processing') and not sim_murid_private.push_dispatch_eligible(e.id);
 get diagnostics k=row_count;n=n+k;
return jsonb_build_object('code','saved','cancelled',n);end$$;

create or replace function public.app_push_status(p_actor uuid,p_session uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select case when not public.app_onboarding_ready(p_actor,p_session) or not public.app_education_admin(p_actor,p_session) then null else jsonb_build_object(
 'points_pilot',(select jsonb_build_object('enabled',points_pilot_enabled,'active_members',(select count(*) from sim_murid_private.push_point_pilot_members where revoked_at is null and expires_at>now())) from sim_murid_private.push_settings where singleton=true),
 'expanded_pilots',(select expanded_pilot_categories from sim_murid_private.push_settings),
 'held_categories',jsonb_build_array('follow_up'),
 'counts',(select coalesce(jsonb_object_agg(status,n),'{}') from(select status,count(*)::integer n from sim_murid_private.push_deliveries group by status)x),
 'errors',(select coalesce(jsonb_object_agg(last_error_code,n),'{}') from(select last_error_code,count(*)::integer n from sim_murid_private.push_deliveries where last_error_code is not null and created_at>now()-interval '24 hours' group by last_error_code)x),
 'alarm',exists(select 1 from sim_murid_private.push_deliveries where (status in('queued','retry_wait') and available_at<now()-interval '5 minutes') or (status='failed_permanent' and last_error_code in('vapid_invalid','provider_unauthorized','key_version_unavailable') and created_at>now()-interval '24 hours')),
 'oldest_ready_at',(select min(available_at) from sim_murid_private.push_deliveries where status in('queued','retry_wait') and available_at<=now()),
 'worker',(select jsonb_build_object('last_started',last_started,'last_finished',last_finished,'last_metrics',last_metrics,'scheduler_enabled',scheduler_enabled) from sim_murid_private.push_worker_state where singleton=true),
 'database_dispatch',(select enabled and dispatch_enabled from sim_murid_private.push_settings)) end
$$;
do $$declare r record;begin for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='sim_murid_private' and p.proname in('push_category_capacity','push_expanded_allowed','push_class_scope','push_owner_scope','push_source_key','push_extended_scope','push_extended_dispatch','push_emit_source','push_schedule_changed','push_report_published','push_document_ready','push_cancel_extended') loop execute format('revoke all on function %s from public,anon,authenticated',r.sig);execute format('grant execute on function %s to service_role',r.sig);end loop;end$$;
commit;
