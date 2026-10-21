
begin;
create table sim_murid_private.fee_brackets(id uuid primary key default gen_random_uuid(),minimum bigint not null check(minimum>=0),maximum bigint check(maximum>=minimum),percent numeric(7,4) not null check(percent between 0 and 100),active boolean not null default true,updated_by uuid not null references public.profiles(id));
create table sim_murid_private.withdrawal_sequences(category text primary key check(category in('S','G','N')),last_number bigint not null);
create table sim_murid_private.withdrawal_slips(id uuid primary key default gen_random_uuid(),transaction_id uuid not null unique references sim_murid_private.savings_transactions(id),number text not null unique,owner_id uuid not null references public.profiles(id),snapshot jsonb not null,created_at timestamptz not null default now());
create index slip_owner on sim_murid_private.withdrawal_slips(owner_id);
create trigger slip_immutable before update or delete on sim_murid_private.withdrawal_slips for each row execute function sim_murid_private.deny_mutation();
create table sim_murid_private.slip_deliveries(id uuid primary key default gen_random_uuid(),slip_id uuid not null references sim_murid_private.withdrawal_slips(id),recipient_id uuid not null references public.profiles(id),email text not null,status text not null default 'queued' check(status in('queued','sending','sent','failed','ambiguous')),attempts integer not null default 0,provider_id text,updated_at timestamptz not null default now(),unique(slip_id,recipient_id));
create function public.app_fee_quote(p_actor uuid,p_session uuid,p_amount bigint,p_apply boolean) returns jsonb language plpgsql stable security invoker set search_path='' as $$declare b sim_murid_private.fee_brackets%rowtype;fee bigint;raw numeric;begin
 if not public.app_ops_manager(p_actor,p_session,'savings_manager') then return null;end if;
 if p_amount<1000 or p_amount%1000<>0 then return null;end if;
 select * into b from sim_murid_private.fee_brackets where active and minimum<=p_amount and (maximum is null or maximum>=p_amount) order by minimum desc limit 1;
 raw=case when p_apply and b.id is not null then p_amount*b.percent/100 else 0 end;fee=round(raw/1000)*1000;
 if fee>p_amount then return null;end if;
 return jsonb_build_object('applied',p_apply,'bracket',to_jsonb(b),'raw',raw,'fee',fee,'cash',p_amount-fee,'policy','FEE-1.0','matched',b.id is not null);end$$;
alter function public.app_savings_mutate(uuid,uuid,jsonb) rename to app_savings_mutate_v20;
create function public.app_savings_mutate(p_actor uuid,p_session uuid,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare target uuid;r jsonb;q jsonb;t sim_murid_private.savings_transactions%rowtype;account sim_murid_private.savings_accounts%rowtype;n bigint;begin
 if not public.app_ops_manager(p_actor,p_session,'savings_manager') then return jsonb_build_object('code','denied');end if;
 if p_command->>'type'='bracket' then
 target=(p_command->>'id')::uuid;
 if target is not null and not exists(select 1 from sim_murid_private.fee_brackets where id=target) then return jsonb_build_object('code','not_found');end if;
 if coalesce((p_command->>'active')::boolean,true) and exists(select 1 from sim_murid_private.fee_brackets b where active and id is distinct from target and b.minimum<=coalesce((p_command->>'maximum')::bigint,9223372036854775807) and coalesce(b.maximum,9223372036854775807)>=(p_command->>'minimum')::bigint) then return jsonb_build_object('code','overlap');end if;
 if target is null then insert into sim_murid_private.fee_brackets(minimum,maximum,percent,active,updated_by) values((p_command->>'minimum')::bigint,(p_command->>'maximum')::bigint,(p_command->>'percent')::numeric,(p_command->>'active')::boolean,p_actor) returning id into target;
 else update sim_murid_private.fee_brackets set minimum=(p_command->>'minimum')::bigint,maximum=(p_command->>'maximum')::bigint,percent=(p_command->>'percent')::numeric,active=(p_command->>'active')::boolean,updated_by=p_actor where id=target;end if;return jsonb_build_object('code','saved','id',target);
 end if;
 r=public.app_savings_mutate_v20(p_actor,p_session,p_command);
 if r->>'code'='saved' and p_command->>'type'='transaction' and p_command->>'kind'='withdrawal' then
 select * into t from sim_murid_private.savings_transactions where id=(r->>'id')::uuid;select * into account from sim_murid_private.savings_accounts where id=t.account_id;
 q=public.app_fee_quote(p_actor,p_session,t.amount,coalesce((p_command->>'feeApplied')::boolean,false));if q is null then raise exception using errcode='23514',message='Invalid fee';end if;
 insert into sim_murid_private.withdrawal_sequences values(account.category,1) on conflict(category) do update set last_number=sim_murid_private.withdrawal_sequences.last_number+1 returning last_number into n;
 insert into sim_murid_private.withdrawal_slips(transaction_id,number,owner_id,snapshot) values(t.id,account.category||'-'||lpad(n::text,8,'0'),account.owner_id,jsonb_build_object('transaction',to_jsonb(t),'fee',q,'owner',(select jsonb_build_object('name',full_name,'username',username) from public.profiles where id=account.owner_id),'issuer',(select full_name from public.profiles where id=p_actor),'school',(select jsonb_build_object('name',name,'address',address_data,'identity',identity_data,'assets',asset_data) from public.school_profile where singleton_key='main')));
 end if;return r;end$$;
alter function public.app_operations_read(uuid,uuid,text,jsonb) rename to app_operations_read_v20;
create function public.app_operations_read(p_actor uuid,p_session uuid,p_module text,p_filters jsonb default '{}') returns jsonb language plpgsql stable security invoker set search_path='' as $$declare r jsonb;begin
 r=public.app_operations_read_v20(p_actor,p_session,p_module,p_filters);if r is null then return null;end if;
 if p_module='savings' then
 r=jsonb_set(r,'{rows}',coalesce((select jsonb_agg(x||coalesce((select jsonb_build_object('slip_id',s.id,'fee',s.snapshot#>'{fee,fee}','cash_received',s.snapshot#>'{fee,cash}') from sim_murid_private.withdrawal_slips s where s.transaction_id=(x->>'id')::uuid),'{}')) from jsonb_array_elements(r->'rows')x),'[]'));
 if (r->>'canManage')::boolean then r=jsonb_set(r,'{extra}',(r->'extra')||jsonb_build_object('brackets',(select coalesce(jsonb_agg(to_jsonb(b) order by minimum),'[]') from sim_murid_private.fee_brackets b)));end if;end if;return r;end$$;
create function public.app_slip_read(p_actor uuid,p_session uuid,p_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select jsonb_build_object('id',s.id,'number',s.number,'snapshot',s.snapshot,'reversed',exists(select 1 from sim_murid_private.savings_transactions where reverses_id=s.transaction_id),'deliveries',case when public.app_ops_manager(p_actor,p_session,'savings_manager') then (select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'email',d.email,'status',d.status,'attempts',d.attempts)),'[]') from sim_murid_private.slip_deliveries d where d.slip_id=s.id) else '[]'::jsonb end) from sim_murid_private.withdrawal_slips s where s.id=p_id and public.app_savings_access(p_actor,p_session,s.owner_id)$$;
create function public.app_slip_delivery(p_actor uuid,p_session uuid,p_slip uuid,p_action text,p_delivery uuid default null,p_status text default null,p_provider text default null) returns jsonb language plpgsql security invoker set search_path='' as $$declare d sim_murid_private.slip_deliveries%rowtype;begin
 if not public.app_ops_manager(p_actor,p_session,'savings_manager') or public.app_slip_read(p_actor,p_session,p_slip) is null then return jsonb_build_object('code','denied');end if;
 if p_action='queue' then
 if exists(select 1 from sim_murid_private.withdrawal_slips s join sim_murid_private.savings_transactions r on r.reverses_id=s.transaction_id where s.id=p_slip) then return jsonb_build_object('code','invalid');end if;
 insert into sim_murid_private.slip_deliveries(slip_id,recipient_id,email) select p_slip,p.id,p.contact_email from public.profiles p join sim_murid_private.auth_accounts a on a.user_id=p.id where p.status='active' and p.contact_email is not null and a.verified_contact_email=p.contact_email and (public.app_ops_role(p.id,'admin') or public.app_education_task(p.id,'savings_manager')) on conflict(slip_id,recipient_id) do nothing;
 return jsonb_build_object('code','queued','count',(select count(*) from sim_murid_private.slip_deliveries where slip_id=p_slip));
 elsif p_action='claim' then
 select * into d from sim_murid_private.slip_deliveries where slip_id=p_slip and status in('queued','failed') order by updated_at for update skip locked limit 1;
 if not found then return jsonb_build_object('code','empty');end if;
 update sim_murid_private.slip_deliveries set status='sending',attempts=attempts+1,updated_at=now() where id=d.id;return jsonb_build_object('code','claimed','id',d.id,'email',d.email);
 elsif p_action='complete' and p_status in('sent','failed','ambiguous') then
 update sim_murid_private.slip_deliveries set status=p_status,provider_id=left(p_provider,200),updated_at=now() where id=p_delivery and slip_id=p_slip and status='sending';return jsonb_build_object('code','saved');
 end if;return jsonb_build_object('code','invalid');end$$;
do $$declare t text;r record;begin foreach t in array array['fee_brackets','withdrawal_sequences','withdrawal_slips','slip_deliveries'] loop execute format('alter table sim_murid_private.%I enable row level security',t);execute format('revoke all on sim_murid_private.%I from public,anon,authenticated',t);execute format('grant select,insert,update,delete on sim_murid_private.%I to service_role',t);end loop;for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('app_fee_quote','app_savings_mutate','app_savings_mutate_v20','app_operations_read','app_operations_read_v20','app_slip_read','app_slip_delivery') loop execute format('revoke all on function %s from public,anon,authenticated',r.signature);execute format('grant execute on function %s to service_role',r.signature);end loop;end$$;
commit;
