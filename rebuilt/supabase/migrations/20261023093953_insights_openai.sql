begin;
alter table sim_murid_private.ai_configs drop constraint ai_configs_provider_check;
alter table sim_murid_private.ai_configs add constraint ai_configs_provider_check check(provider in ('anthropic','gemini','openai'));
create or replace function public.app_ai_run(p_actor uuid,p_session uuid,p_action text,p_data jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
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
 update sim_murid_private.ai_analyses set status=case when p_data->>'error' is null then 'succeeded' else 'failed' end,result=p_data->'result',error_code=p_data->>'error',tokens=p_data->'tokens' where id=(p_data->>'id')::uuid and status='running';if not found then return jsonb_build_object('code','not_found');end if;return jsonb_build_object('code','saved');
 elsif p_action='invalidate' then delete from sim_murid_private.ai_analyses where period_id=(p_data->>'periodId')::uuid and scope=p_data->>'provider' and status<>'running';return jsonb_build_object('code','saved');end if;return jsonb_build_object('code','invalid');end$$;

commit;
