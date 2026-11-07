begin;

-- No network or scheduler. Secrets are encrypted by the trusted server (WP-03).
alter table sim_murid_private.outbox drop constraint outbox_channel_check;
alter table sim_murid_private.outbox add constraint outbox_channel_check check(channel in ('email','whatsapp','internal','push'));

create table sim_murid_private.push_settings (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false, dispatch_enabled boolean not null default false,
 test_enabled boolean not null default false, categories text[] not null default '{}',
 check(categories <@ array['points','schedule','reports','surveys','follow_up','documents']::text[])
);
insert into sim_murid_private.push_settings default values;

create function sim_murid_private.push_cipher_valid(p_value jsonb) returns boolean language sql immutable security invoker set search_path='' as $$
 select coalesce(jsonb_typeof(p_value)='object' and p_value-array['iv','ciphertext','tag']='{}'::jsonb
 and (p_value->>'iv')~'^[A-Za-z0-9_-]{16}$' and (p_value->>'tag')~'^[A-Za-z0-9_-]{22}$'
 and length(p_value->>'ciphertext') between 2 and 16000 and (p_value->>'ciphertext')~'^[A-Za-z0-9_-]+$'
 and jsonb_typeof(p_value->'iv')='string' and jsonb_typeof(p_value->'tag')='string' and jsonb_typeof(p_value->'ciphertext')='string',false)
$$;

create table sim_murid_private.push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 installation_id uuid not null unique, endpoint_hash text not null unique check(endpoint_hash ~ '^[a-f0-9]{64}$'),
 subscription_hash text not null check(subscription_hash ~ '^[a-f0-9]{64}$'),
 endpoint_ciphertext jsonb not null, keys_ciphertext jsonb not null,
 encryption_key_version text not null check(length(encryption_key_version) between 1 and 80),
 vapid_key_version text not null check(length(vapid_key_version) between 1 and 80),
 binding_version bigint not null default 1 check(binding_version>0),
 binding_secret_hash text not null check(binding_secret_hash ~ '^[a-f0-9]{64}$'),
 last_authorized_session_id uuid not null,
 label text not null default '' check(length(label)<=80),
 status text not null default 'active' check(status in ('active','disabled','revoked','invalid','expired')),
 created_at timestamptz not null default now(), enabled_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(), revoked_at timestamptz, expires_at timestamptz,
 check(expires_at is null or expires_at>enabled_at),
 check(sim_murid_private.push_cipher_valid(endpoint_ciphertext)),
 check(sim_murid_private.push_cipher_valid(keys_ciphertext))
);
create index push_subscriptions_user on sim_murid_private.push_subscriptions(user_id,status);
create index push_subscriptions_session on sim_murid_private.push_subscriptions(last_authorized_session_id);

create table sim_murid_private.push_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 revision bigint not null default 0 check(revision>=0),
 categories text[] not null default '{}', quiet_start time not null default '21:00', quiet_end time not null default '06:00',
 timezone text not null default 'Asia/Jakarta', updated_at timestamptz not null default now(),
 check(categories <@ array['points','schedule','reports','surveys','follow_up','documents']::text[])
);

create table sim_murid_private.push_events (
 id uuid primary key default gen_random_uuid(), outbox_id uuid not null unique references sim_murid_private.outbox(id) on delete cascade,
 inbox_id uuid not null references sim_murid_private.inbox(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 category text not null check(category in ('points','test')),
 source_id uuid not null, dedup_key text not null unique check(length(dedup_key) between 1 and 300),
 occurred_at timestamptz not null, expires_at timestamptz not null, materialized_at timestamptz,
 unique(inbox_id,category),
 check(expires_at>occurred_at and expires_at<=occurred_at+interval '24 hours')
);
create index push_events_recipient on sim_murid_private.push_events(recipient_id);
create index push_events_inbox on sim_murid_private.push_events(inbox_id);

create table sim_murid_private.push_deliveries (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references sim_murid_private.push_events(id) on delete cascade,
 subscription_id uuid not null references sim_murid_private.push_subscriptions(id) on delete cascade,
 binding_version bigint not null check(binding_version>0), delivery_ref uuid not null default gen_random_uuid() unique,
 status text not null default 'queued' check(status in ('queued','processing','accepted','retry_wait','failed_permanent','ambiguous','expired','cancelled')),
 attempts integer not null default 0 check(attempts between 0 and 5), available_at timestamptz not null default now(),
 locked_until timestamptz, claim_token uuid, provider_code integer check(provider_code between 100 and 599),
 accepted_at timestamptz, last_error_code text check(length(last_error_code)<=80), created_at timestamptz not null default now(),
 unique(event_id,subscription_id,binding_version),
 check((status='processing')=(locked_until is not null and claim_token is not null))
);
create index push_delivery_ready on sim_murid_private.push_deliveries(available_at,id) where status in ('queued','retry_wait');
create index push_delivery_subscription on sim_murid_private.push_deliveries(subscription_id);

create function public.app_push_cancel(p_event uuid) returns jsonb language plpgsql security invoker set search_path='' as $$begin
 update sim_murid_private.push_deliveries set status='cancelled',claim_token=null,locked_until=null,last_error_code='source_cancelled' where event_id=p_event and status in('queued','retry_wait','processing');
 return jsonb_build_object('code','saved');end$$;

create function sim_murid_private.push_refresh_outbox(p_event uuid) returns void language plpgsql security invoker set search_path='' as $$
declare oid uuid;st text;n integer;begin
 select outbox_id into oid from sim_murid_private.push_events where id=p_event;
 perform 1 from sim_murid_private.outbox where id=oid for update;
 select case when bool_or(status in('queued','retry_wait')) then 'queued'
 when bool_or(status='processing') then 'processing' when bool_or(status='ambiguous') then 'ambiguous'
 when bool_or(status='failed_permanent') then 'failed' when bool_or(status='accepted') then 'sent' else 'cancelled' end,
 coalesce(max(attempts),0) into st,n from sim_murid_private.push_deliveries where event_id=p_event;
 update sim_murid_private.outbox set status=st,attempts=n,updated_at=now() where id=oid and channel='push';
end$$;
create function sim_murid_private.push_delivery_rollup() returns trigger language plpgsql security invoker set search_path='' as $$begin
 perform sim_murid_private.push_refresh_outbox(new.event_id);return new;end$$;
create trigger push_delivery_rollup after insert or update of status on sim_murid_private.push_deliveries for each row execute function sim_murid_private.push_delivery_rollup();

-- Read projection deliberately excludes endpoints, hashes and encrypted credentials.
create function public.app_push_devices(p_actor uuid,p_session uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select case when public.app_auth_principal(p_actor,p_session) is null then null else
 coalesce((select jsonb_agg(jsonb_build_object('id',id,'installation_id',installation_id,'label',label,'status',status,
 'binding_version',binding_version,'vapid_key_version',vapid_key_version,'last_seen_at',last_seen_at,'expires_at',expires_at) order by created_at desc)
 from sim_murid_private.push_subscriptions where user_id=p_actor),'[]'::jsonb) end
$$;

create function public.app_push_register(p_actor uuid,p_session uuid,p_data jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s sim_murid_private.push_subscriptions%rowtype; iid uuid; h text; changed boolean;begin
 -- Owner lock serializes the five-device limit. Unique installation/endpoint constraints arbitrate cross-owner races.
 perform 1 from public.profiles where id=p_actor for update;
 if public.app_auth_principal(p_actor,p_session) is null then return jsonb_build_object('code','denied');end if;
 if not (select enabled from sim_murid_private.push_settings) then return jsonb_build_object('code','disabled');end if;
 if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>40000 then return jsonb_build_object('code','invalid');end if;
 iid=(p_data->>'installation_id')::uuid;h=p_data->>'endpoint_hash';
 if iid is null or h is null then return jsonb_build_object('code','invalid');end if;
 if (p_data->>'expires_at')::timestamptz<=now() then return jsonb_build_object('code','invalid');end if;
 select * into s from sim_murid_private.push_subscriptions where installation_id=iid for update;
 if found and s.user_id<>p_actor then
 -- A released installation may change owners only with the old revoke-only credential.
 if s.status<>'revoked' or (p_data->>'previous_binding_secret_hash') is distinct from s.binding_secret_hash then return jsonb_build_object('code','conflict');end if;
 end if;
 if exists(select 1 from sim_murid_private.push_subscriptions where endpoint_hash=h and id is distinct from s.id) then return jsonb_build_object('code','conflict');end if;
 if s.id is null and (select count(*) from sim_murid_private.push_subscriptions where user_id=p_actor and status='active')>=5 then return jsonb_build_object('code','device_limit');end if;
 if s.id is not null and (s.status<>'active' or s.user_id<>p_actor) and (select count(*) from sim_murid_private.push_subscriptions where user_id=p_actor and status='active')>=5 then return jsonb_build_object('code','device_limit');end if;
 changed=s.id is not null and (s.status<>'active' or s.endpoint_hash is distinct from h or s.subscription_hash is distinct from p_data->>'subscription_hash' or s.vapid_key_version is distinct from p_data->>'vapid_key_version');
 if s.id is null then
 insert into sim_murid_private.push_subscriptions(user_id,installation_id,endpoint_hash,subscription_hash,endpoint_ciphertext,keys_ciphertext,encryption_key_version,vapid_key_version,binding_secret_hash,last_authorized_session_id,label,expires_at)
 values(p_actor,iid,h,p_data->>'subscription_hash',p_data->'endpoint_ciphertext',p_data->'keys_ciphertext',p_data->>'encryption_key_version',p_data->>'vapid_key_version',p_data->>'binding_secret_hash',p_session,coalesce(p_data->>'label',''),(p_data->>'expires_at')::timestamptz) returning * into s;
 else
 update sim_murid_private.push_subscriptions set user_id=p_actor,endpoint_hash=h,subscription_hash=p_data->>'subscription_hash',endpoint_ciphertext=p_data->'endpoint_ciphertext',keys_ciphertext=p_data->'keys_ciphertext',encryption_key_version=p_data->>'encryption_key_version',vapid_key_version=p_data->>'vapid_key_version',binding_secret_hash=p_data->>'binding_secret_hash',last_authorized_session_id=p_session,label=coalesce(p_data->>'label',''),expires_at=(p_data->>'expires_at')::timestamptz,last_seen_at=now(),status='active',revoked_at=null,binding_version=binding_version+case when changed then 1 else 0 end,enabled_at=case when changed then now() else enabled_at end where id=s.id returning * into s;
 if changed then update sim_murid_private.push_deliveries set status='cancelled',claim_token=null,locked_until=null,last_error_code='binding_changed' where subscription_id=s.id and status in ('queued','retry_wait','processing');end if;
 end if;
 return jsonb_build_object('code','saved','id',s.id,'binding_version',s.binding_version);
exception when unique_violation then return jsonb_build_object('code','conflict');
 when invalid_text_representation or check_violation or not_null_violation or datetime_field_overflow then return jsonb_build_object('code','invalid');end$$;

create function public.app_push_revoke(p_actor uuid,p_session uuid,p_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$begin
 perform 1 from public.profiles where id=p_actor for update;
 if public.app_auth_principal(p_actor,p_session) is null then return jsonb_build_object('code','denied');end if;
 update sim_murid_private.push_subscriptions set status='revoked',revoked_at=coalesce(revoked_at,now()) where id=p_id and user_id=p_actor;
 if not found then return jsonb_build_object('code','not_found');end if;
 update sim_murid_private.push_deliveries set status='cancelled',claim_token=null,locked_until=null,last_error_code='revoked' where subscription_id=p_id and status in ('queued','retry_wait','processing');
 return jsonb_build_object('code','saved');end$$;

-- WP-03 hashes a high-entropy HttpOnly installation credential on the server.
-- This capability permits revocation only, never reading or sending as its owner.
create function public.app_push_release(p_installation uuid,p_secret_hash text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare sid uuid;begin
 update sim_murid_private.push_subscriptions set status='revoked',revoked_at=coalesce(revoked_at,now()) where installation_id=p_installation and binding_secret_hash=p_secret_hash returning id into sid;
 if sid is not null then update sim_murid_private.push_deliveries set status='cancelled',claim_token=null,locked_until=null,last_error_code='installation_released' where subscription_id=sid and status in('queued','retry_wait','processing');end if;
 return jsonb_build_object('code','saved');end$$;

create function public.app_push_preferences(p_actor uuid,p_session uuid,p_revision bigint default null,p_data jsonb default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r sim_murid_private.push_preferences%rowtype;c text[];begin
 perform 1 from public.profiles where id=p_actor for update;
 if public.app_auth_principal(p_actor,p_session) is null then return jsonb_build_object('code','denied');end if;
 insert into sim_murid_private.push_preferences(user_id) values(p_actor) on conflict do nothing;
 select * into r from sim_murid_private.push_preferences where user_id=p_actor for update;
 if p_data is not null then
 if r.revision is distinct from p_revision then return jsonb_build_object('code','stale');end if;
 if jsonb_typeof(p_data->'categories') is distinct from 'array' or not exists(select 1 from pg_timezone_names where name=p_data->>'timezone') then return jsonb_build_object('code','invalid');end if;
 select coalesce(array_agg(distinct value),'{}') into c from jsonb_array_elements_text(p_data->'categories');
 update sim_murid_private.push_preferences set categories=c,quiet_start=(p_data->>'quiet_start')::time,quiet_end=(p_data->>'quiet_end')::time,timezone=p_data->>'timezone',revision=revision+1,updated_at=now() where user_id=p_actor returning * into r;
 update sim_murid_private.push_deliveries d set status='cancelled',claim_token=null,locked_until=null,last_error_code='preference_changed' from sim_murid_private.push_events e where d.event_id=e.id and e.recipient_id=p_actor and e.category<>'test' and not(e.category=any(c)) and d.status in('queued','retry_wait','processing');
 end if;
 return jsonb_build_object('code','saved','preferences',to_jsonb(r));
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or check_violation or not_null_violation then return jsonb_build_object('code','invalid');end$$;

-- Fail closed for categories whose domain resolver is not implemented until WP-07.
create function sim_murid_private.push_eligible(p_event uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((select p.status='active' and i.recipient_id=e.recipient_id and
 case when e.category='test' then true when e.category='points' then exists(
 select 1 from sim_murid_private.point_events pe where pe.id=e.source_id and pe.cancelled_at is null and pe.base_points<0 and i.entity_id=pe.id and i.dedup_key='point:'||pe.id::text||':'||e.recipient_id::text and
 (e.recipient_id=pe.student_id or exists(select 1 from sim_murid_private.student_guardians where student_id=pe.student_id and parent_id=e.recipient_id and revoked_at is null)
 or exists(select 1 from sim_murid_private.enrollments en join public.classes c on c.id=en.class_id where en.student_id=pe.student_id and en.ended_at is null and c.homeroom_teacher_id=e.recipient_id and sim_murid_private.homeroom_access(e.recipient_id,c.id))
 or exists(select 1 from public.user_assignments where user_id=e.recipient_id and assignment_code='counselor' and public.app_ops_role(user_id,'teacher') and revoked_at is null and valid_from<=public.app_ops_today() and(valid_until is null or valid_until>=public.app_ops_today()))
 or (public.app_ops_role(e.recipient_id,'admin') and (public.app_point_replay(pe.student_id,date_trunc('month',pe.event_date)::date)->>'level')::integer>=3))) else false end
 from sim_murid_private.push_events e join public.profiles p on p.id=e.recipient_id join sim_murid_private.inbox i on i.id=e.inbox_id where e.id=p_event),false)
$$;

create function sim_murid_private.push_not_before(p_user uuid,p_at timestamptz) returns timestamptz language plpgsql stable security invoker set search_path='' as $$
declare r sim_murid_private.push_preferences%rowtype;local_at timestamp;begin
 select * into r from sim_murid_private.push_preferences where user_id=p_user;
 if not found then return p_at;end if;
 local_at=p_at at time zone r.timezone;
 if r.quiet_start=r.quiet_end then return p_at;end if;
 if (r.quiet_start<r.quiet_end and local_at::time>=r.quiet_start and local_at::time<r.quiet_end) or
 (r.quiet_start>r.quiet_end and (local_at::time>=r.quiet_start or local_at::time<r.quiet_end)) then
 return (local_at::date+r.quiet_end+case when r.quiet_start>r.quiet_end and local_at::time>=r.quiet_start then interval '1 day' else interval '0' end) at time zone r.timezone;
 end if;return p_at;end$$;

create function public.app_push_enqueue(p_inbox uuid,p_category text,p_source uuid,p_dedup text,p_occurred timestamptz,p_expires timestamptz,p_subscription uuid default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare i sim_murid_private.inbox%rowtype;e sim_murid_private.push_events%rowtype;cfg sim_murid_private.push_settings%rowtype;oid uuid;sid uuid;begin
 select * into cfg from sim_murid_private.push_settings for share;
 if not cfg.enabled or (p_category='test' and not cfg.test_enabled) or (p_category<>'test' and not(p_category=any(cfg.categories))) then return jsonb_build_object('code','disabled');end if;
 if p_category not in('test','points') or p_occurred is null or p_expires is null or p_occurred>now() or p_expires<=now() or p_expires>p_occurred+interval '24 hours' or (p_category='test' and (p_expires>p_occurred+interval '5 minutes' or p_subscription is null)) then return jsonb_build_object('code','invalid');end if;
 select * into i from sim_murid_private.inbox where id=p_inbox;if not found then return jsonb_build_object('code','not_found');end if;
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
 if not sim_murid_private.push_eligible(e.id) then raise exception 'Push source denied' using errcode='42501';end if;
 insert into sim_murid_private.push_deliveries(event_id,subscription_id,binding_version,available_at)
 select e.id,s.id,s.binding_version,case when p_category='test' then now() else sim_murid_private.push_not_before(i.recipient_id,now()) end
 from sim_murid_private.push_subscriptions s where s.user_id=i.recipient_id and s.status='active' and s.enabled_at<=p_occurred and(s.expires_at is null or s.expires_at>now()) and(p_subscription is null or s.id=p_subscription) on conflict do nothing;
 update sim_murid_private.push_events set materialized_at=now() where id=e.id;
 perform sim_murid_private.push_refresh_outbox(e.id);
 return jsonb_build_object('code','saved','id',e.id);
exception when insufficient_privilege then return jsonb_build_object('code','denied');
 when unique_violation then return jsonb_build_object('code','request_conflict');
 when check_violation or not_null_violation then return jsonb_build_object('code','invalid');end$$;

create function public.app_push_claim() returns jsonb language plpgsql security invoker set search_path='' as $$
declare d sim_murid_private.push_deliveries%rowtype;e sim_murid_private.push_events%rowtype;s sim_murid_private.push_subscriptions%rowtype;cfg sim_murid_private.push_settings%rowtype;nb timestamptz;begin
 select * into cfg from sim_murid_private.push_settings for share;
 update sim_murid_private.push_deliveries set status='ambiguous',locked_until=null,claim_token=null,last_error_code='claim_expired' where status='processing' and locked_until<=now();
 -- Cancellation does not depend on sender flag, and never resends an uncertain attempt.
 for d in select * from sim_murid_private.push_deliveries where status in('queued','retry_wait') order by available_at,id for update skip locked limit 100 loop
 select * into e from sim_murid_private.push_events where id=d.event_id;
 select * into s from sim_murid_private.push_subscriptions where id=d.subscription_id;
 if e.expires_at<=now() or(s.expires_at is not null and s.expires_at<=now()) then
 update sim_murid_private.push_deliveries set status='expired' where id=d.id;continue;end if;
 if not cfg.enabled or s.status<>'active' or s.user_id<>e.recipient_id or s.binding_version<>d.binding_version or not sim_murid_private.push_eligible(e.id) or (e.category='test' and not cfg.test_enabled) or(e.category<>'test' and (not(e.category=any(cfg.categories)) or not exists(select 1 from sim_murid_private.push_preferences where user_id=e.recipient_id and e.category=any(categories)))) then
 update sim_murid_private.push_deliveries set status='cancelled',last_error_code='eligibility_changed' where id=d.id;continue;end if;
 if not cfg.dispatch_enabled or d.available_at>now() then continue;end if;
 nb=case when e.category='test' then now() else sim_murid_private.push_not_before(e.recipient_id,now()) end;
 if nb>now() then update sim_murid_private.push_deliveries set available_at=nb where id=d.id;continue;end if;
 if d.attempts>=5 then update sim_murid_private.push_deliveries set status='failed_permanent',last_error_code='retry_limit' where id=d.id;continue;end if;
 update sim_murid_private.push_deliveries set status='processing',attempts=attempts+1,locked_until=now()+interval '120 seconds',claim_token=gen_random_uuid() where id=d.id returning * into d;
 return jsonb_build_object('code','claimed','delivery',to_jsonb(d),'subscription',jsonb_build_object('id',s.id,'endpoint_ciphertext',s.endpoint_ciphertext,'keys_ciphertext',s.keys_ciphertext,'encryption_key_version',s.encryption_key_version,'vapid_key_version',s.vapid_key_version),'expires_at',e.expires_at);
 end loop;return jsonb_build_object('code','empty');end$$;

create function public.app_push_complete(p_id uuid,p_token uuid,p_binding bigint,p_status text,p_provider_code integer default null,p_retry_after integer default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d sim_murid_private.push_deliveries%rowtype;s sim_murid_private.push_subscriptions%rowtype;target text;begin
 if p_status not in('accepted','retry_wait','failed_permanent','ambiguous','cancelled') or p_status is null or (p_status='accepted' and (p_provider_code is null or p_provider_code not between 200 and 299)) then return jsonb_build_object('code','invalid');end if;
 select * into d from sim_murid_private.push_deliveries where id=p_id for update;
 if not found or d.status<>'processing' or d.claim_token is distinct from p_token or d.binding_version is distinct from p_binding or d.locked_until<=now() then return jsonb_build_object('code','stale');end if;
 select * into s from sim_murid_private.push_subscriptions where id=d.subscription_id;
 target=case when s.status<>'active' or s.binding_version<>p_binding then 'cancelled' when p_provider_code in(404,410) or (p_status='retry_wait' and d.attempts>=5) then 'failed_permanent' else p_status end;
 update sim_murid_private.push_deliveries set status=target,claim_token=null,locked_until=null,provider_code=p_provider_code,accepted_at=case when target='accepted' then now() else null end,
 available_at=now()+make_interval(secs=>greatest(least(3600,ceil(60*power(2,d.attempts-1)*(1+random()*0.3)))::integer,least(86400,greatest(0,coalesce(p_retry_after,0))))) where id=d.id;
 if p_provider_code in(404,410) then
 update sim_murid_private.push_subscriptions set status='invalid',revoked_at=now() where id=s.id and binding_version=p_binding;
 update sim_murid_private.push_deliveries set status='cancelled',claim_token=null,locked_until=null,last_error_code='endpoint_invalid' where subscription_id=s.id and status in('queued','retry_wait','processing');end if;
 return jsonb_build_object('code','saved','status',target);
exception when check_violation then return jsonb_build_object('code','invalid');end$$;

-- Revoke bindings even for already-expired sessions explicitly revoked later.
create function sim_murid_private.push_revocation() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if tg_table_name='app_sessions' then
 if new.revoked_at is not null and new.revocation_reason is distinct from 'expired' then
 update sim_murid_private.push_subscriptions set status='revoked',revoked_at=coalesce(revoked_at,now()) where user_id=new.user_id and last_authorized_session_id=new.auth_session_id and status in('active','disabled');end if;
 else
 if new.status<>'active' then update sim_murid_private.push_subscriptions set status='revoked',revoked_at=coalesce(revoked_at,now()) where user_id=new.id and status in('active','disabled');end if;
 end if;
 update sim_murid_private.push_deliveries d set status='cancelled',locked_until=null,claim_token=null,last_error_code='revoked' from sim_murid_private.push_subscriptions s where d.subscription_id=s.id and s.status='revoked' and d.status in('queued','retry_wait','processing');
 return new;end$$;
create trigger push_session_revocation after update of revoked_at,revocation_reason on sim_murid_private.app_sessions for each row execute function sim_murid_private.push_revocation();
create trigger push_account_revocation after update of status on public.profiles for each row when(old.status is distinct from new.status) execute function sim_murid_private.push_revocation();

do $$declare t text;r record;begin
 foreach t in array array['push_settings','push_subscriptions','push_preferences','push_events','push_deliveries'] loop
 execute format('alter table sim_murid_private.%I enable row level security',t);
 execute format('revoke all on sim_murid_private.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on sim_murid_private.%I to service_role',t);
 end loop;
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname like 'app_push_%') or(n.nspname='sim_murid_private' and p.proname like 'push_%') loop
 execute format('revoke all on function %s from public,anon,authenticated',r.signature);
 execute format('grant execute on function %s to service_role',r.signature);
 end loop;
end$$;
-- Preserve the existing session API while covering expired bindings on explicit revoke-all.
create or replace function public.app_session_revoke(p_actor uuid,p_auth_session uuid,p_username text default null,p_session uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare actor jsonb; owner_id uuid; revoked integer; self_revoked boolean;
begin
 -- Serialize the caller role/session and target login/revocation using identity locks in UUID order.
 select id into owner_id from public.profiles where username=coalesce(p_username,(select username from public.profiles where id=p_actor));
 if owner_id is null then return null; end if;
 perform 1 from public.profiles where id in (p_actor,owner_id) order by id for update;
 perform 1 from public.user_roles where user_id=p_actor for update;
 actor=public.app_auth_principal(p_actor,p_auth_session);
 if actor is null or not public.app_onboarding_ready(p_actor,p_auth_session) or (owner_id<>p_actor and not (actor->>'is_admin')::boolean) then return null; end if;
 if p_session is not null and not exists(select 1 from sim_murid_private.app_sessions where id=p_session and user_id=owner_id) then return null; end if;
 update sim_murid_private.push_subscriptions set status='revoked',revoked_at=coalesce(revoked_at,now()) where user_id=owner_id and (p_session is null or last_authorized_session_id=(select auth_session_id from sim_murid_private.app_sessions where id=p_session and user_id=owner_id)) and status in('active','disabled');
 update sim_murid_private.push_deliveries d set status='cancelled',claim_token=null,locked_until=null,last_error_code='session_revoked' from sim_murid_private.push_subscriptions s where d.subscription_id=s.id and s.user_id=owner_id and s.status='revoked' and d.status in('queued','retry_wait','processing');
 self_revoked=exists(select 1 from sim_murid_private.app_sessions where user_id=p_actor and user_id=owner_id and auth_session_id=p_auth_session and (p_session is null or id=p_session));
 update sim_murid_private.app_sessions set revoked_at=now(),revocation_reason=case when owner_id=p_actor then 'owner_revoked' else 'admin_revoked' end
 where user_id=owner_id and (p_session is null or id=p_session) and revoked_at is null;
 get diagnostics revoked=row_count;
 if revoked>0 then
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id,metadata)
 values(p_actor,'user','auth.session_revoke','profile',owner_id,gen_random_uuid(),jsonb_build_object('count',revoked,'scope',case when p_session is null then 'all' else 'one' end));
 end if;
 return jsonb_build_object('revoked',revoked,'signed_out',self_revoked);
end;
$$;
-- Push retries are per-delivery; legacy admin retries must not requeue a parent only.
create or replace function public.app_jobs_admin(p_actor uuid,p_session uuid,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$begin
 if not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_command->>'type'='tick' then return public.app_jobs_tick(coalesce((p_command->>'dryRun')::boolean,true));
 elsif p_command->>'type'='retry' then
 update sim_murid_private.outbox set status='queued',available_at=now() where id=(p_command->>'id')::uuid and status='failed' and channel<>'push' and attempts<5;
 if not found then return jsonb_build_object('code','not_found');end if;
 return jsonb_build_object('code','saved','id',p_command->>'id');
 else return jsonb_build_object('code','invalid');end if;end$$;
commit;
