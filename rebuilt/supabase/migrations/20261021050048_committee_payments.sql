
begin;
create table sim_murid_private.committee_payments(id uuid primary key default gen_random_uuid(),student_id uuid not null references public.profiles(id),payment_date date not null,notes text not null default '' check(length(notes)<=2000),recorded_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),voided_at timestamptz);
create index committee_student on sim_murid_private.committee_payments(student_id,payment_date);
create index committee_recorder on sim_murid_private.committee_payments(recorded_by);
create table sim_murid_private.payment_allocations(id uuid primary key default gen_random_uuid(),payment_id uuid not null references sim_murid_private.committee_payments(id),student_id uuid not null references public.profiles(id),month date not null check(extract(day from month)=1),amount bigint not null check(amount between 1 and 1000000000000),waived_student_id uuid references public.profiles(id),voided_at timestamptz,check(student_id is distinct from waived_student_id));
create unique index allocations_current on sim_murid_private.payment_allocations(student_id,month) where voided_at is null;
create index allocations_payment on sim_murid_private.payment_allocations(payment_id);
create index allocations_waiver on sim_murid_private.payment_allocations(waived_student_id,month) where voided_at is null;
create table sim_murid_private.committee_tariffs(class_id uuid not null references public.classes(id),month date not null check(extract(day from month)=1),amount bigint not null check(amount between 0 and 1000000000000),updated_by uuid not null references public.profiles(id),primary key(class_id,month));
create index tariff_updater on sim_murid_private.committee_tariffs(updated_by);
create function public.app_natural_key(p_name text) returns text language sql immutable security invoker set search_path='' as $$select string_agg(case when x[1]~'^[0-9]+$' then lpad(x[1],20,'0') else lower(x[1]) end,'' order by ord) from regexp_matches(p_name,'[0-9]+|[^0-9]+','g') with ordinality as v(x,ord)$$;
create function public.app_fee_waiver_student(p_payer uuid,p_month date) returns uuid language sql stable security invoker set search_path='' as $$
select f.student_id from sim_murid_private.family_members payer join sim_murid_private.family_members f on f.family_id=payer.family_id and f.revoked_at is null join sim_murid_private.enrollments e on e.student_id=f.student_id and e.starts_on<=p_month+interval '1 month'-interval '1 day' and (e.ended_at is null or (e.ended_at at time zone 'Asia/Jakarta')::date>p_month) join public.classes c on c.id=e.class_id join public.academic_years y on y.id=e.academic_year_id where payer.student_id=p_payer and payer.revoked_at is null and public.app_ops_role(f.student_id,'student') and p_month>=make_date(y.start_year,7,1) and p_month<make_date(y.start_year+1,7,1) order by c.level,public.app_natural_key(c.name) collate "C",f.legacy_order,f.student_id limit 1$$;
create function public.app_fees_mutate(p_actor uuid,p_session uuid,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare sid uuid;target uuid;cid uuid;item jsonb;mo date;waiver uuid;row sim_murid_private.committee_payments%rowtype;begin
 if not public.app_ops_manager(p_actor,p_session,'committee_treasurer') then return jsonb_build_object('code','denied');end if;
 if p_command->>'type'='tariff' then
 cid=(p_command->>'classId')::uuid;mo=(p_command->>'month')::date;
 if extract(day from mo)<>1 or not exists(select 1 from public.classes where id=cid and archived_at is null) then return jsonb_build_object('code','invalid');end if;
 insert into sim_murid_private.committee_tariffs values(cid,mo,(p_command->>'amount')::bigint,p_actor) on conflict(class_id,month) do update set amount=excluded.amount,updated_by=excluded.updated_by;
 elsif p_command->>'type' in('payment','void') then
 target=(p_command->>'id')::uuid;
 if target is not null then select * into row from sim_murid_private.committee_payments where id=target and voided_at is null;if not found then return jsonb_build_object('code','not_found');end if;end if;
 if p_command->>'type'='void' then
 if target is null then return jsonb_build_object('code','invalid');end if;
 update sim_murid_private.committee_payments set voided_at=now(),updated_at=now() where id=target;update sim_murid_private.payment_allocations set voided_at=now() where payment_id=target and voided_at is null;
 else
 sid=(p_command->>'studentId')::uuid;
 if not public.app_ops_role(sid,'student') or (p_command->>'date')::date>public.app_ops_today() or jsonb_typeof(p_command->'allocations') is distinct from 'array' or jsonb_array_length(p_command->'allocations') not between 1 and 12 then return jsonb_build_object('code','invalid');end if;
 if exists(select 1 from jsonb_array_elements(p_command->'allocations') x group by x->>'month' having count(*)>1) then return jsonb_build_object('code','duplicate');end if;
 for item in select value from jsonb_array_elements(p_command->'allocations') loop
 mo=(item->>'month')::date;
 if extract(day from mo)<>1 or (item->>'amount')::bigint not between 1 and 1000000000000 then return jsonb_build_object('code','invalid');end if;
 if exists(select 1 from sim_murid_private.payment_allocations a where a.month=mo and a.voided_at is null and a.payment_id is distinct from target and (a.student_id=sid or a.waived_student_id=sid)) then return jsonb_build_object('code','duplicate');end if;
 end loop;
 if target is null then insert into sim_murid_private.committee_payments(student_id,payment_date,notes,recorded_by) values(sid,(p_command->>'date')::date,coalesce(p_command->>'notes',''),p_actor) returning id into target;
 else update sim_murid_private.committee_payments set student_id=sid,payment_date=(p_command->>'date')::date,notes=coalesce(p_command->>'notes',''),updated_at=now() where id=target;update sim_murid_private.payment_allocations set voided_at=now() where payment_id=target and voided_at is null;end if;
 for item in select value from jsonb_array_elements(p_command->'allocations') loop
 mo=(item->>'month')::date;waiver=public.app_fee_waiver_student(sid,mo);if waiver=sid then waiver=null;end if;
 insert into sim_murid_private.payment_allocations(payment_id,student_id,month,amount,waived_student_id) values(target,sid,mo,(item->>'amount')::bigint,waiver);
 end loop;
 end if;
 else return jsonb_build_object('code','invalid');end if;return jsonb_build_object('code','saved','id',target);end$$;
do $$declare t text;r record;begin foreach t in array array['committee_payments','payment_allocations','committee_tariffs'] loop execute format('alter table sim_murid_private.%I enable row level security',t);execute format('revoke all on table sim_murid_private.%I from public,anon,authenticated',t);execute format('grant select,insert,update,delete on table sim_murid_private.%I to service_role',t);end loop;
 for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('app_ops_today','app_ops_role','app_ops_manager','app_ops_student','app_duty_confirmed','app_duty_mutate','app_attendance_access','app_attendance_mutate','app_mentor_access','app_mentoring_mutate','app_natural_key','app_fee_waiver_student','app_fees_mutate') loop execute format('revoke all on function %s from public,anon,authenticated',r.signature);execute format('grant execute on function %s to service_role',r.signature);end loop;end$$;
commit;
