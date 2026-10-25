begin;
-- Reservations are retained independently of disposable analysis cache.
create table sim_murid_private.ai_usage_reservations (
 analysis_id uuid primary key,
 actor_id uuid not null,
 reserved_at timestamptz not null default now()
);
create index ai_usage_reservations_time_idx on sim_murid_private.ai_usage_reservations(reserved_at);
alter table sim_murid_private.ai_usage_reservations enable row level security;
revoke all on sim_murid_private.ai_usage_reservations from public,anon,authenticated;
grant select,insert on sim_murid_private.ai_usage_reservations to service_role;
create function public.app_ai_reserve(p_actor uuid,p_session uuid,p_analysis uuid,p_daily_limit integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare a sim_murid_private.ai_analyses%rowtype; n integer; identifiers jsonb;
begin
 if public.app_survey_manager(p_actor,p_session) is not true then return jsonb_build_object('code','denied');end if;
 if p_daily_limit is null or p_daily_limit<1 or p_daily_limit>20 then return jsonb_build_object('code','invalid');end if;
 -- Serialize all providers, actors and periods; no client-side/in-memory budget.
 perform pg_advisory_xact_lock(12120001);
 select * into a from sim_murid_private.ai_analyses where id=p_analysis and status='running';
 if not found then return jsonb_build_object('code','denied');end if;
 if exists(select 1 from sim_murid_private.ai_usage_reservations where analysis_id=p_analysis) then return jsonb_build_object('code','already_reserved');end if;
 select count(*) into n from sim_murid_private.ai_usage_reservations where reserved_at>=date_trunc('day',now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
 if n>=p_daily_limit then return jsonb_build_object('code','budget_exhausted');end if;
 if exists(select 1 from sim_murid_private.ai_usage_reservations where reserved_at>now()-interval '60 seconds') then return jsonb_build_object('code','cooldown');end if;
 insert into sim_murid_private.ai_usage_reservations(analysis_id,actor_id) values(p_analysis,p_actor);
 -- Server-side redaction dictionary, never returned by an HTTP response.
 select coalesce(jsonb_agg(distinct v),'[]') into identifiers from public.profiles p
 cross join lateral unnest(array[p.full_name,p.username,p.contact_email])v
 where length(v)>=3 and p.id in (
 select r.user_id from sim_murid_private.survey_respondents r cross join lateral jsonb_array_elements(r.instrument)q
 where r.period_id=a.period_id and r.submitted_at is not null and q->>'kind'='essay'
 and length(btrim(r.answers->>(q->>'code')))>0
 order by md5(r.user_id::text||(q->>'code')) limit 150);
 return jsonb_build_object('code','reserved','used',n+1,'limit',p_daily_limit,'identifiers',identifiers);
end$$;
revoke all on function public.app_ai_reserve(uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.app_ai_reserve(uuid,uuid,uuid,integer) to service_role;
commit;
