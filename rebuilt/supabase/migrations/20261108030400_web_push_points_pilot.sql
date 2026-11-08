begin;
-- Explicit, expiring pilot membership; no role-wide enrolment and no automatic activation.
alter table sim_murid_private.push_settings add column points_pilot_enabled boolean not null default false;
create table sim_murid_private.push_point_pilot_members(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),expires_at timestamptz not null,
 revoked_at timestamptz,
 check(expires_at>created_at and expires_at<=created_at+interval '30 days')
);
alter table sim_murid_private.push_point_pilot_members enable row level security;
revoke all on sim_murid_private.push_point_pilot_members from public,anon,authenticated;
grant select,insert,update,delete on sim_murid_private.push_point_pilot_members to service_role;
create function sim_murid_private.push_point_pilot_allowed(p_user uuid,p_created timestamptz) returns boolean
language sql stable security invoker set search_path='' as $$
 select coalesce((select s.points_pilot_enabled and m.revoked_at is null and m.expires_at>now() and m.created_at<=p_created
 from sim_murid_private.push_settings s join sim_murid_private.push_point_pilot_members m on m.user_id=p_user where s.singleton=true),false)
$$;
-- Dispatch membership is separate from source authorization: removing a pilot member
-- must not remove their access to an otherwise authorized existing inbox/click.
create function sim_murid_private.push_dispatch_eligible(p_event uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select sim_murid_private.push_eligible(p_event) and coalesce((select case when e.category='test' then true else
 sim_murid_private.push_point_pilot_allowed(e.recipient_id,pe.created_at) end
 from sim_murid_private.push_events e left join sim_murid_private.point_events pe on pe.id=e.source_id where e.id=p_event),false)
$$;
revoke all on function sim_murid_private.push_point_pilot_allowed(uuid,timestamptz),sim_murid_private.push_dispatch_eligible(uuid) from public,anon,authenticated;
grant execute on function sim_murid_private.push_point_pilot_allowed(uuid,timestamptz),sim_murid_private.push_dispatch_eligible(uuid) to service_role;

-- Existing enqueue/dedup/fan-out contract, plus fail-closed pilot gate.
create or replace function public.app_push_enqueue(p_inbox uuid,p_category text,p_source uuid,p_dedup text,p_occurred timestamptz,p_expires timestamptz,p_subscription uuid default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare i sim_murid_private.inbox%rowtype;e sim_murid_private.push_events%rowtype;cfg sim_murid_private.push_settings%rowtype;oid uuid;sid uuid;begin
 select * into cfg from sim_murid_private.push_settings for share;
 if not cfg.enabled or (p_category='test' and not cfg.test_enabled) or (p_category<>'test' and not(p_category=any(cfg.categories))) then return jsonb_build_object('code','disabled');end if;
 if p_category not in('test','points') or p_occurred is null or p_expires is null or p_occurred>now() or p_expires<=now() or p_expires>p_occurred+interval '24 hours' or (p_category='test' and (p_expires>p_occurred+interval '5 minutes' or p_subscription is null)) then return jsonb_build_object('code','invalid');end if;
 select * into i from sim_murid_private.inbox where id=p_inbox;if not found then return jsonb_build_object('code','not_found');end if;
 -- A member can only receive events created after their explicit enrolment.
 if p_category='points' and not exists(select 1 from sim_murid_private.point_events pe where pe.id=p_source and sim_murid_private.push_point_pilot_allowed(i.recipient_id,pe.created_at)) then return jsonb_build_object('code','disabled');end if;
 -- Serialize event idempotency and fan-out as a single transaction.
 perform pg_advisory_xact_lock(hashtextextended('push-event:'||p_dedup,0));
 select * into e from sim_murid_private.push_events where dedup_key=p_dedup;
 if found then if e.inbox_id<>p_inbox or e.category<>p_category or e.source_id<>p_source then return jsonb_build_object('code','request_conflict');end if;return jsonb_build_object('code','duplicate','id',e.id);end if;
 if exists(select 1 from sim_murid_private.push_events where inbox_id=p_inbox and category=p_category) then return jsonb_build_object('code','request_conflict');end if;
 if p_category='test' and not exists(select 1 from sim_murid_private.push_subscriptions where id=p_subscription and user_id=i.recipient_id and status='active') then return jsonb_build_object('code','denied');end if;
 if p_category<>'test' and not exists(select 1 from sim_murid_private.push_preferences where user_id=i.recipient_id and p_category=any(categories)) then return jsonb_build_object('code','disabled');end if;
 insert into sim_murid_private.outbox(idempotency_key,channel,event_type,aggregate_type,aggregate_id,payload)
 values('push:'||p_dedup,'push',case when p_category='test' then 'device.test' else 'point.alert' end,'inbox',p_inbox,jsonb_build_object('recipient_id',i.recipient_id,'inbox_id',p_inbox)) returning id into oid;
 insert into sim_murid_private.push_events(outbox_id,inbox_id,recipient_id,category,source_id,dedup_key,occurred_at,expires_at)
 values(oid,p_inbox,i.recipient_id,p_category,p_source,p_dedup,p_occurred,p_expires) returning * into e;
 if not sim_murid_private.push_dispatch_eligible(e.id) then raise exception 'Push source denied' using errcode='42501';end if;
 insert into sim_murid_private.push_deliveries(event_id,subscription_id,binding_version,available_at)
 select e.id,s.id,s.binding_version,case when p_category='test' then now() else sim_murid_private.push_not_before(i.recipient_id,now()) end
 from sim_murid_private.push_subscriptions s where s.user_id=i.recipient_id and s.status='active' and s.enabled_at<=p_occurred and(s.expires_at is null or s.expires_at>now()) and(p_subscription is null or s.id=p_subscription) on conflict do nothing;
 update sim_murid_private.push_events set materialized_at=now() where id=e.id;
 perform sim_murid_private.push_refresh_outbox(e.id);
 return jsonb_build_object('code','saved','id',e.id);
exception when insufficient_privilege then return jsonb_build_object('code','denied');
 when unique_violation then return jsonb_build_object('code','request_conflict');
 when check_violation or not_null_violation then return jsonb_build_object('code','invalid');end$$;

create or replace function public.app_push_claim() returns jsonb language plpgsql security invoker set search_path='' as $$
declare d sim_murid_private.push_deliveries%rowtype;e sim_murid_private.push_events%rowtype;s sim_murid_private.push_subscriptions%rowtype;cfg sim_murid_private.push_settings%rowtype;nb timestamptz;begin
 select * into cfg from sim_murid_private.push_settings for share;
 update sim_murid_private.push_deliveries set status='ambiguous',locked_until=null,claim_token=null,last_error_code='claim_expired' where status='processing' and locked_until<=now();
 -- Cancellation does not depend on sender flag, and never resends an uncertain attempt.
 for d in select * from sim_murid_private.push_deliveries where status in('queued','retry_wait') order by available_at,id for update skip locked limit 100 loop
 select * into e from sim_murid_private.push_events where id=d.event_id;
 select * into s from sim_murid_private.push_subscriptions where id=d.subscription_id;
 if e.expires_at<=now() or(s.expires_at is not null and s.expires_at<=now()) then
 update sim_murid_private.push_deliveries set status='expired' where id=d.id;continue;end if;
 if not cfg.enabled or s.status<>'active' or s.user_id<>e.recipient_id or s.binding_version<>d.binding_version or not sim_murid_private.push_dispatch_eligible(e.id) or (e.category='test' and not cfg.test_enabled) or(e.category<>'test' and (not(e.category=any(cfg.categories)) or not exists(select 1 from sim_murid_private.push_preferences where user_id=e.recipient_id and e.category=any(categories)))) then
 update sim_murid_private.push_deliveries set status='cancelled',last_error_code='eligibility_changed' where id=d.id;continue;end if;
 if not cfg.dispatch_enabled or d.available_at>now() then continue;end if;
 nb=case when e.category='test' then now() else sim_murid_private.push_not_before(e.recipient_id,now()) end;
 if nb>now() then update sim_murid_private.push_deliveries set available_at=nb where id=d.id;continue;end if;
 if d.attempts>=5 then update sim_murid_private.push_deliveries set status='failed_permanent',last_error_code='retry_limit' where id=d.id;continue;end if;
 update sim_murid_private.push_deliveries set status='processing',attempts=attempts+1,locked_until=now()+interval '120 seconds',claim_token=gen_random_uuid() where id=d.id returning * into d;
 return jsonb_build_object('code','claimed','delivery',to_jsonb(d),'subscription',jsonb_build_object('id',s.id,'installation_id',s.installation_id,'user_id',s.user_id,'endpoint_ciphertext',s.endpoint_ciphertext,'keys_ciphertext',s.keys_ciphertext,'encryption_key_version',s.encryption_key_version,'vapid_key_version',s.vapid_key_version),'expires_at',e.expires_at);
 end loop;return jsonb_build_object('code','empty');end$$;

create or replace function public.app_push_preflight(p_id uuid,p_token uuid,p_binding bigint) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d sim_murid_private.push_deliveries%rowtype;e sim_murid_private.push_events%rowtype;s sim_murid_private.push_subscriptions%rowtype;c sim_murid_private.push_settings%rowtype;nb timestamptz;begin
 select * into d from sim_murid_private.push_deliveries where id=p_id for update;
 if not found or d.status<>'processing' or d.claim_token is distinct from p_token or d.binding_version<>p_binding or d.locked_until<=now()+interval '12 seconds' then return jsonb_build_object('code','stale');end if;
 select * into e from sim_murid_private.push_events where id=d.event_id;select * into s from sim_murid_private.push_subscriptions where id=d.subscription_id;select * into c from sim_murid_private.push_settings;
 if e.expires_at<=now()+interval '1 second' or(s.expires_at is not null and s.expires_at<=now()) then update sim_murid_private.push_deliveries set status='expired',claim_token=null,locked_until=null,last_error_code='ttl_expired' where id=d.id;return jsonb_build_object('code','expired');end if;
 if not c.enabled or not c.dispatch_enabled or (e.category='test' and not c.test_enabled) or(e.category<>'test' and (not(e.category=any(c.categories)) or not exists(select 1 from sim_murid_private.push_preferences where user_id=e.recipient_id and e.category=any(categories)))) or s.status<>'active' or s.binding_version<>p_binding or s.user_id<>e.recipient_id or not sim_murid_private.push_dispatch_eligible(e.id) then
 update sim_murid_private.push_deliveries set status='cancelled',claim_token=null,locked_until=null,last_error_code='eligibility_changed' where id=d.id;return jsonb_build_object('code','cancelled');end if;
 -- Preferences may change or quiet hours may begin after claim/DNS resolution.
 nb=case when e.category='test' then now() else sim_murid_private.push_not_before(e.recipient_id,now()) end;
 if nb>now() then
 update sim_murid_private.push_deliveries set status=case when nb>=e.expires_at then 'expired' else 'retry_wait' end,available_at=nb,attempts=greatest(0,attempts-1),claim_token=null,locked_until=null,last_error_code=case when nb>=e.expires_at then 'ttl_expired' else 'quiet_hours' end where id=d.id;
 return jsonb_build_object('code','deferred');end if;
 return jsonb_build_object('code','ready','event_ref',e.id,'delivery_ref',d.delivery_ref,'category',e.category,'expires_at',e.expires_at);end$$;

-- Preserve threshold/R02/R03 and the final existing recipient UNION verbatim.
create or replace function public.app_point_notify(p_student uuid,p_month date,p_event uuid) returns void language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare pe sim_murid_private.point_events%rowtype;iid uuid;r jsonb;recipient uuid;title text;message text;key text;cfg sim_murid_private.service_settings%rowtype;begin
 select * into pe from sim_murid_private.point_events where id=p_event and student_id=p_student and date_trunc('month',event_date)::date=p_month and base_points<0 and cancelled_at is null;if not found then return;end if;
 r=public.app_point_replay(p_student,p_month);select * into cfg from sim_murid_private.service_settings;
 if (r->>'level')::integer<cfg.point_threshold and not exists(select 1 from jsonb_array_elements(r->'events')x where (x->>'id')::uuid=p_event and(x->>'r02'='true' or x->>'r03'='true')) then return;end if;
 title='Pemberitahuan poin kedisiplinan';message='Saldo '||(r->>'balance')||', tingkat '||(r->>'level')||'. Silakan lihat riwayat kedisiplinan. R02/R03 merupakan penanda tindak lanjut, bukan keputusan pengeluaran siswa.';
 for recipient in select p_student union select parent_id from sim_murid_private.student_guardians where student_id=p_student and revoked_at is null union select c.homeroom_teacher_id from sim_murid_private.enrollments e join public.classes c on c.id=e.class_id where e.student_id=p_student and e.ended_at is null and c.homeroom_teacher_id is not null and sim_murid_private.homeroom_access(c.homeroom_teacher_id,c.id) union select user_id from public.user_assignments where assignment_code='counselor' and public.app_ops_role(user_id,'teacher') and revoked_at is null and valid_from<=public.app_ops_today() and(valid_until is null or valid_until>=public.app_ops_today()) union select user_id from public.user_roles where role_code='admin' and(r->>'level')::integer>=3 loop
 key='point:'||p_event::text||':'||recipient::text;
 insert into sim_murid_private.inbox(recipient_id,dedup_key,title,message,entity_id) values(recipient,key,title,message,p_event) on conflict(dedup_key) do nothing returning id into iid;
 -- This is still the domain transaction. No backfill on a duplicate inbox and no network IO.
 if iid is not null then perform public.app_push_enqueue(iid,'points',pe.id,key,pe.created_at,pe.created_at+interval '24 hours');end if;
 if cfg.email_enabled then insert into sim_murid_private.outbox(idempotency_key,channel,event_type,aggregate_type,aggregate_id,payload) select key||':email','email','point','point_event',p_event,jsonb_build_object('recipient_id',recipient,'email',p.contact_email,'title',title,'message',message) from public.profiles p join sim_murid_private.auth_accounts a on a.user_id=p.id where p.id=recipient and p.status='active' and a.verified_contact_email=p.contact_email on conflict(idempotency_key) do nothing;end if;
 if cfg.whatsapp_enabled then insert into sim_murid_private.outbox(idempotency_key,channel,event_type,aggregate_type,aggregate_id,payload) select key||':whatsapp','whatsapp','point','point_event',p_event,jsonb_build_object('recipient_id',recipient,'phone',p.phone,'title',title,'message',message) from public.profiles p where p.id=recipient and p.status='active' and p.phone~'^\+[1-9][0-9]{7,14}$' on conflict(idempotency_key) do nothing;end if;
 end loop;end$$;

-- Prompt cancellation on source, assignment, relation, pilot and preference changes.
-- Time-based expiry is also rechecked by maintenance/claim/preflight.
create function sim_murid_private.push_cancel_points() returns trigger language plpgsql security invoker set search_path='' as $$begin
 -- Match enqueue/claim lock order: settings -> delivery -> durable worker wake.
 perform 1 from sim_murid_private.push_settings where singleton=true for share;
 update sim_murid_private.push_deliveries d set status='cancelled',claim_token=null,locked_until=null,last_error_code='point_scope_changed'
 from sim_murid_private.push_events e where e.id=d.event_id and e.category='points' and d.status in('queued','retry_wait','processing')
 and (not sim_murid_private.push_dispatch_eligible(e.id) or not exists(select 1 from sim_murid_private.push_settings c where c.enabled and 'points'=any(c.categories))
 or not exists(select 1 from sim_murid_private.push_preferences p where p.user_id=e.recipient_id and 'points'=any(p.categories)));
 return null;end$$;
revoke all on function sim_murid_private.push_cancel_points() from public,anon,authenticated;
grant execute on function sim_murid_private.push_cancel_points() to service_role;
create trigger push_points_scope after update or delete on sim_murid_private.student_guardians for each statement execute function sim_murid_private.push_cancel_points();
create trigger push_points_scope after update or delete on sim_murid_private.enrollments for each statement execute function sim_murid_private.push_cancel_points();
create trigger push_points_scope after update or delete on sim_murid_private.push_point_pilot_members for each statement execute function sim_murid_private.push_cancel_points();
create trigger push_points_scope after update or delete on sim_murid_private.push_preferences for each statement execute function sim_murid_private.push_cancel_points();
create trigger push_points_scope after update or delete on public.classes for each statement execute function sim_murid_private.push_cancel_points();
create trigger push_points_scope after update or delete on public.user_assignments for each statement execute function sim_murid_private.push_cancel_points();
create trigger push_points_scope after update or delete on public.user_roles for each statement execute function sim_murid_private.push_cancel_points();
create trigger push_points_scope after insert or update or delete on sim_murid_private.point_events for each statement execute function sim_murid_private.push_cancel_points();
create trigger push_points_scope after update on sim_murid_private.push_settings for each statement execute function sim_murid_private.push_cancel_points();

create or replace function public.app_push_maintenance(p_enabled boolean,p_test boolean,p_categories text[]) returns jsonb language plpgsql security invoker set search_path='' as $$
declare n integer;k integer;begin
 update sim_murid_private.push_deliveries set status='ambiguous',claim_token=null,locked_until=null,last_error_code='lease_expired' where status='processing' and locked_until<=now();
 update sim_murid_private.push_deliveries d set status='expired',claim_token=null,locked_until=null,last_error_code='ttl_expired' from sim_murid_private.push_events e where e.id=d.event_id and d.status in('queued','retry_wait') and e.expires_at<=now();
 update sim_murid_private.push_deliveries d set status='cancelled',claim_token=null,locked_until=null,last_error_code='channel_disabled' from sim_murid_private.push_events e,sim_murid_private.push_settings c where e.id=d.event_id and d.status in('queued','retry_wait','processing') and (not coalesce(p_enabled,false) or not c.enabled or (e.category='test' and (not coalesce(p_test,false) or not c.test_enabled)) or (e.category<>'test' and (not(e.category=any(coalesce(p_categories,'{}'))) or not(e.category=any(c.categories)))));
 get diagnostics n=row_count;
 update sim_murid_private.push_deliveries d set status='cancelled',claim_token=null,locked_until=null,last_error_code='point_scope_changed'
 from sim_murid_private.push_events e where e.id=d.event_id and e.category='points' and d.status in('queued','retry_wait','processing') and not sim_murid_private.push_dispatch_eligible(e.id);
 get diagnostics k=row_count;n=n+k;
return jsonb_build_object('code','saved','cancelled',n);end$$;

create or replace function public.app_push_status(p_actor uuid,p_session uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select case when not public.app_onboarding_ready(p_actor,p_session) or not public.app_education_admin(p_actor,p_session) then null else jsonb_build_object(
 'points_pilot',(select jsonb_build_object('enabled',points_pilot_enabled,'active_members',(select count(*) from sim_murid_private.push_point_pilot_members where revoked_at is null and expires_at>now())) from sim_murid_private.push_settings where singleton=true),
 'counts',(select coalesce(jsonb_object_agg(status,n),'{}') from(select status,count(*)::integer n from sim_murid_private.push_deliveries group by status)x),
 'errors',(select coalesce(jsonb_object_agg(last_error_code,n),'{}') from(select last_error_code,count(*)::integer n from sim_murid_private.push_deliveries where last_error_code is not null and created_at>now()-interval '24 hours' group by last_error_code)x),
 'alarm',exists(select 1 from sim_murid_private.push_deliveries where (status in('queued','retry_wait') and available_at<now()-interval '5 minutes') or (status='failed_permanent' and last_error_code in('vapid_invalid','provider_unauthorized','key_version_unavailable') and created_at>now()-interval '24 hours')),
 'oldest_ready_at',(select min(available_at) from sim_murid_private.push_deliveries where status in('queued','retry_wait') and available_at<=now()),
 'worker',(select jsonb_build_object('last_started',last_started,'last_finished',last_finished,'last_metrics',last_metrics,'scheduler_enabled',scheduler_enabled) from sim_murid_private.push_worker_state where singleton=true),
 'database_dispatch',(select enabled and dispatch_enabled from sim_murid_private.push_settings)) end
$$;
commit;
