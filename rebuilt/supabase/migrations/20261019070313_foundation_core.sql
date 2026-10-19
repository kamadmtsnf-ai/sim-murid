-- New dedicated Rebuilt SiM-Murid database only. Never reset another app.
begin;
create schema if not exists sim_murid_private;
revoke all on schema sim_murid_private from public, anon, authenticated;

create function sim_murid_private.touch_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at := pg_catalog.statement_timestamp(); return new; end;
$$;
create function sim_murid_private.deny_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin raise exception using errcode = '55000', message = 'Immutable record: append a new version instead'; end;
$$;
revoke all on function sim_murid_private.touch_updated_at() from public, anon, authenticated;
revoke all on function sim_murid_private.deny_mutation() from public, anon, authenticated;

-- Integer rupiah without typmod rounding. Upper bound is exactly safe in JS.
create domain public.rupiah_amount as numeric
check (value is null or (value between -9007199254740991 and 9007199254740991 and value = trunc(value)));
create domain public.nonnegative_rupiah as public.rupiah_amount
check (value is null or value >= 0);

create table public.profiles (
 id uuid primary key references auth.users(id) on delete restrict,
 username text not null unique check (length(username) between 1 and 100 and username = btrim(username) and username !~ '[[:cntrl:]]'),
 full_name text not null check (length(btrim(full_name)) between 1 and 200),
 phone text check (phone is null or length(phone) <= 40),
 contact_email text check (contact_email is null or length(contact_email) <= 320),
 bio text not null default '' check (length(bio) <= 2000),
 status text not null default 'active' check (status in ('active','inactive')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
comment on column public.profiles.username is 'Exact text identity; preserve leading zero; no parseFloat-based merging.';
create index profiles_full_name_idx on public.profiles(full_name);

create table public.role_catalog (
 code text primary key check (code ~ '^[a-z_]+$'), legacy_label text not null unique,
 description text not null default ''
);
create table public.assignment_catalog (
 code text primary key check (code ~ '^[a-z_]+$'), legacy_label text not null unique,
 description text not null default ''
);
create table public.user_roles (
 user_id uuid primary key references public.profiles(id) on delete restrict,
 role_code text not null references public.role_catalog(code) on delete restrict,
 assigned_at timestamptz not null default now(),
 assigned_by uuid references public.profiles(id) on delete restrict
);
create index user_roles_role_code_idx on public.user_roles(role_code);
create index user_roles_assigned_by_idx on public.user_roles(assigned_by);

create table public.user_access_flags (
 user_id uuid primary key references public.profiles(id) on delete restrict,
 premium_access boolean not null default false, savings_access boolean not null default false,
 teacher_email_verified_at timestamptz,
 updated_at timestamptz not null default now(), updated_by uuid references public.profiles(id) on delete restrict
);
create index user_access_flags_updated_by_idx on public.user_access_flags(updated_by);

create table public.school_profile (
 id uuid primary key default gen_random_uuid(), singleton_key text not null default 'main' unique check (singleton_key = 'main'),
 name text not null check (length(btrim(name)) between 1 and 200),
 identity_data jsonb not null default '{}'::jsonb check (jsonb_typeof(identity_data) = 'object'),
 address_data jsonb not null default '{}'::jsonb check (jsonb_typeof(address_data) = 'object'),
 asset_data jsonb not null default '{}'::jsonb check (jsonb_typeof(asset_data) = 'object'),
 updated_by uuid references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index school_profile_updated_by_idx on public.school_profile(updated_by);

create table public.academic_years (
 id uuid primary key default gen_random_uuid(), start_year smallint not null unique check (start_year between 1900 and 2200),
 starts_on date generated always as (make_date(start_year,7,1)) stored,
 ends_on date generated always as (make_date(start_year+1,6,30)) stored,
 is_active boolean not null default false, created_at timestamptz not null default now(),
 unique(id,start_year)
);
create unique index academic_years_one_active on public.academic_years(is_active) where is_active;
create table public.semesters (
 id uuid primary key default gen_random_uuid(), academic_year_id uuid not null,
 year_start smallint not null, number smallint not null check (number in (1,2)),
 starts_on date generated always as (case when number=1 then make_date(year_start,7,1) else make_date(year_start+1,1,1) end) stored,
 ends_on date generated always as (case when number=1 then make_date(year_start,12,31) else make_date(year_start+1,6,30) end) stored,
 foreign key(academic_year_id,year_start) references public.academic_years(id,start_year) on delete restrict,
 unique(academic_year_id,number)
);

create index semesters_academic_year_fk_idx on public.semesters(academic_year_id,year_start);

create table public.subjects (
 id uuid primary key default gen_random_uuid(), code text not null unique check(code ~ '^[A-Z][A-Z0-9_]{1,31}$'),
 name text not null unique check (length(btrim(name)) between 1 and 150 and name=btrim(name)),
 sort_order smallint not null unique check (sort_order>0), active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.classes (
 id uuid primary key default gen_random_uuid(), academic_year_id uuid not null references public.academic_years(id) on delete restrict,
 level smallint not null check (level in (7,8,9)), name text not null check (length(btrim(name)) between 1 and 50 and name=btrim(name)),
 homeroom_teacher_id uuid references public.profiles(id) on delete restrict,
 archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(academic_year_id,name), unique(id,academic_year_id)
);
create index classes_homeroom_teacher_idx on public.classes(homeroom_teacher_id);
create table public.user_assignments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete restrict,
 assignment_code text not null references public.assignment_catalog(code) on delete restrict,
 scope_class_id uuid references public.classes(id) on delete restrict,
 valid_from date not null, valid_until date,
 assigned_by uuid references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(), revoked_at timestamptz,
 check (valid_until is null or valid_until >= valid_from)
);
create index user_assignments_user_active_idx on public.user_assignments(user_id,assignment_code) where revoked_at is null;
create index user_assignments_catalog_idx on public.user_assignments(assignment_code);
create index user_assignments_scope_idx on public.user_assignments(scope_class_id);
create index user_assignments_actor_idx on public.user_assignments(assigned_by);
create unique index user_assignments_exact_start_unique on public.user_assignments(user_id,assignment_code,coalesce(scope_class_id,'00000000-0000-0000-0000-000000000000'::uuid),valid_from) where revoked_at is null;
comment on table public.user_assignments is 'Assignment records only. Role eligibility and scoped permissions implemented at stage 7, not inferred from menu.';

create table public.holidays (
 id uuid primary key default gen_random_uuid(), holiday_date date not null unique,
 description text not null check (length(btrim(description)) between 1 and 500),
 created_by uuid references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index holidays_actor_idx on public.holidays(created_by);
create table public.memorization_catalog (
 id uuid primary key default gen_random_uuid(), name text not null unique check(length(btrim(name)) between 1 and 200 and name=btrim(name)),
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.business_policies (
 id uuid primary key default gen_random_uuid(), policy_type text not null check(policy_type in ('report','withdrawal_fee','survey_required')),
 version text not null unique, approved_on date not null,
 configuration jsonb not null check(jsonb_typeof(configuration)='object'),
 approval_source text not null check(length(btrim(approval_source))>0), created_at timestamptz not null default now()
);
create trigger business_policies_immutable before update or delete on public.business_policies for each row execute function sim_murid_private.deny_mutation();
create trigger business_policies_no_truncate before truncate on public.business_policies for each statement execute function sim_murid_private.deny_mutation();

-- Touch timestamps only. App-level audit and permissions are separate stages.
do $$ declare t text; begin
 foreach t in array array['profiles','user_access_flags','school_profile','subjects','classes','holidays','memorization_catalog'] loop
  execute format('create trigger touch_updated_at before update on public.%I for each row execute function sim_murid_private.touch_updated_at()',t);
 end loop;
 foreach t in array array['profiles','role_catalog','assignment_catalog','user_roles','user_access_flags','school_profile','academic_years','semesters','subjects','classes','user_assignments','holidays','memorization_catalog','business_policies'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from public, anon, authenticated',t);
  execute format('grant select,insert,update,delete on table public.%I to service_role',t);
 end loop;
end $$;
-- No client grants or permissive policies until stage 7. Protect before exposing.
commit;
