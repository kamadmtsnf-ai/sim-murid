begin;
create table sim_murid_private.app_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete restrict,
 auth_session_id uuid not null unique,
 issued_at timestamptz not null default now(), expires_at timestamptz not null,
 remember_me boolean not null default false, revoked_at timestamptz, revocation_reason text,
 device_label text not null default '',
 check(expires_at>issued_at and expires_at<=issued_at+interval '168 hours'),
 check(remember_me or expires_at<=issued_at+interval '1 hour'),
 check(revoked_at is null or revoked_at>=issued_at)
);
create unique index app_sessions_one_unrevoked on sim_murid_private.app_sessions(user_id) where revoked_at is null;
comment on table sim_murid_private.app_sessions is 'Login transaction must revoke expired slot before new insert. No plaintext tokens. auth_session_id checked against verified token at stage 6.';

create table sim_murid_private.security_questions (
 user_id uuid primary key references public.profiles(id) on delete restrict,
 question_code text not null, answer_hash text not null check(length(answer_hash)>=32),
 updated_at timestamptz not null default now()
);
create table sim_murid_private.recovery_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete restrict,
 request_type text not null check(request_type in ('password','session')),
 status text not null default 'pending' check(status in ('pending','verified','completed','rejected','expired')),
 verification_metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(verification_metadata)='object'),
 requested_at timestamptz not null default now(), resolved_at timestamptz,
 resolved_by uuid references public.profiles(id) on delete restrict,
 check(resolved_at is null or resolved_at>=requested_at)
);
create index recovery_requests_user_idx on sim_murid_private.recovery_requests(user_id,requested_at);
create index recovery_requests_actor_idx on sim_murid_private.recovery_requests(resolved_by);
create table sim_murid_private.email_verifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete restrict,
 email_target text not null, otp_hash text not null check(length(otp_hash)>=32),
 created_at timestamptz not null default now(), expires_at timestamptz not null,
 attempts_used smallint not null default 0 check(attempts_used between 0 and 5),
 status text not null default 'pending' check(status in ('pending','verified','expired','superseded','locked')),
 check(expires_at>created_at and expires_at<=created_at+interval '600 seconds')
);
create index email_verifications_user_created_idx on sim_murid_private.email_verifications(user_id,created_at);
create unique index email_verifications_one_pending on sim_murid_private.email_verifications(user_id) where status='pending';
comment on table sim_murid_private.email_verifications is 'Cooldown/day limit and verification transaction implemented at stage 9. Never store plaintext OTP.';

create table sim_murid_private.activity_logs (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete restrict,
 actor_kind text not null check(actor_kind in ('user','system','migration')),
 action text not null check(length(btrim(action))>0), entity_type text, entity_id uuid,
 request_id uuid not null, description text not null default '',
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 created_at timestamptz not null default now(),
 check((actor_kind='user' and actor_id is not null) or (actor_kind<>'user' and actor_id is null))
);
create index activity_logs_actor_time_idx on sim_murid_private.activity_logs(actor_id,created_at desc);
create index activity_logs_entity_idx on sim_murid_private.activity_logs(entity_type,entity_id);
create trigger activity_logs_immutable before update or delete on sim_murid_private.activity_logs for each row execute function sim_murid_private.deny_mutation();
create trigger activity_logs_no_truncate before truncate on sim_murid_private.activity_logs for each statement execute function sim_murid_private.deny_mutation();

create table sim_murid_private.outbox (
 id uuid primary key default gen_random_uuid(), idempotency_key text not null unique check(length(btrim(idempotency_key))>0),
 channel text not null check(channel in ('email','whatsapp','internal')),
 event_type text not null, aggregate_type text not null, aggregate_id uuid not null,
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 status text not null default 'queued' check(status in ('queued','processing','sent','failed','ambiguous','cancelled')),
 attempts integer not null default 0 check(attempts>=0),
 available_at timestamptz not null default now(), locked_until timestamptz,
 provider_message_id text, last_error_code text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index outbox_ready_idx on sim_murid_private.outbox(available_at,id) where status in ('queued','failed');
create table sim_murid_private.job_runs (
 id uuid primary key default gen_random_uuid(), job_key text not null unique check(length(btrim(job_key))>0),
 job_type text not null, business_date date not null,
 status text not null default 'queued' check(status in ('queued','running','succeeded','failed','skipped')),
 attempts integer not null default 0 check(attempts>=0), started_at timestamptz, finished_at timestamptz,
 result_summary jsonb not null default '{}'::jsonb check(jsonb_typeof(result_summary)='object'),
 created_at timestamptz not null default now(), check(finished_at is null or (started_at is not null and finished_at>=started_at))
);
create index job_runs_type_date_idx on sim_murid_private.job_runs(job_type,business_date);

create table sim_murid_private.import_batches (
 id uuid primary key default gen_random_uuid(), source_name text not null,
 source_commit text, source_checksum text, status text not null default 'staged' check(status in ('staged','validating','ready','imported','rejected')),
 created_by uuid references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object')
);
create index import_batches_actor_idx on sim_murid_private.import_batches(created_by);
create table sim_murid_private.import_rows (
 id uuid primary key default gen_random_uuid(), batch_id uuid not null references sim_murid_private.import_batches(id) on delete restrict,
 sheet_name text not null, row_number integer not null check(row_number>=1),
 raw_data jsonb not null, normalized_data jsonb,
 review_status text not null default 'pending' check(review_status in ('pending','valid','ambiguous','invalid','imported')),
 validation_errors jsonb not null default '[]'::jsonb check(jsonb_typeof(validation_errors)='array'),
 created_at timestamptz not null default now(), unique(batch_id,sheet_name,row_number)
);
create index import_rows_review_idx on sim_murid_private.import_rows(batch_id,review_status);
create table sim_murid_private.legacy_id_map (
 id uuid primary key default gen_random_uuid(), batch_id uuid not null references sim_murid_private.import_batches(id) on delete restrict,
 entity_type text not null, source_key text not null, target_id uuid not null,
 created_at timestamptz not null default now(), unique(batch_id,entity_type,source_key)
);
create index legacy_id_map_target_idx on sim_murid_private.legacy_id_map(entity_type,target_id);
comment on table sim_murid_private.legacy_id_map is 'Polymorphic target_id. Per-entity FK reconciliation required before import commit, not a generic enforced foreign key.';

create trigger outbox_touch before update on sim_murid_private.outbox for each row execute function sim_murid_private.touch_updated_at();
create trigger security_questions_touch before update on sim_murid_private.security_questions for each row execute function sim_murid_private.touch_updated_at();
do $$ declare t text; begin
 foreach t in array array['app_sessions','security_questions','recovery_requests','email_verifications','activity_logs','outbox','job_runs','import_batches','import_rows','legacy_id_map'] loop
  execute format('alter table sim_murid_private.%I enable row level security',t);
  execute format('revoke all on table sim_murid_private.%I from public,anon,authenticated',t);
  if t='activity_logs' then
   execute format('grant select,insert on table sim_murid_private.%I to service_role',t);
  else
   execute format('grant select,insert,update,delete on table sim_murid_private.%I to service_role',t);
  end if;
 end loop;
end $$;
grant usage on schema sim_murid_private to service_role;
-- Trigger execution occurs in DB, functions remain non-callable through API.
commit;
