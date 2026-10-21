begin;
-- Respondent revision is authoritative for independent drafts; retain global revision for administration.
create or replace function public.app_services_write(p_actor uuid,p_session uuid,p_request uuid,p_revision bigint,p_module text,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare old sim_murid_private.operations_requests%rowtype;v bigint;r jsonb;e sim_murid_private.point_events%rowtype;begin
 if not public.app_onboarding_ready(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_module not in('discipline','notifications','surveys','insights','jobs') then return jsonb_build_object('code','denied');end if;
 if p_module='discipline' and not(public.app_ops_role(p_actor,'teacher') or public.app_education_admin(p_actor,p_session)) then return jsonb_build_object('code','denied');end if;
 if p_module='surveys' and p_command->>'type' in('period','close') and not public.app_survey_manager(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_module='insights' and p_command->>'type'='ai_config' and not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_module='insights' and p_command->>'type' in('plan','plan_status') and not public.app_education_task(p_actor,'school_head') then return jsonb_build_object('code','denied');end if;
 if p_module='insights' and p_command->>'type'='note' and not public.app_survey_manager(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_module='jobs' and not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 select revision into v from sim_murid_private.operations_state for update;
 select * into old from sim_murid_private.operations_requests where id=p_request;if found then if old.actor=p_actor and old.module='services:'||p_module and old.command=p_command then return old.result;end if;return jsonb_build_object('code','request_conflict');end if;
 if not(p_module='surveys' and p_command->>'type' in('start','save','submit','peer_save','peer_submit')) and v is distinct from p_revision then return jsonb_build_object('code','stale');end if;
 if p_module='discipline' then
 if p_command->>'type' in('event','cancel','catalog') then r=public.app_point_mutate(p_actor,p_session,p_command);else r=public.app_point_admin(p_actor,p_session,p_command);end if;
 if r->>'code'='saved' and p_command->>'type'='event' then select * into e from sim_murid_private.point_events where id=(r->>'id')::uuid;perform public.app_point_notify(e.student_id,date_trunc('month',e.event_date)::date,e.id);end if;
 elsif p_module='notifications' then update sim_murid_private.inbox set read_at=coalesce(read_at,now()) where recipient_id=p_actor and(p_command->>'id' is null or id=(p_command->>'id')::uuid);r=jsonb_build_object('code','saved');
 elsif p_module='surveys' then r=public.app_survey_mutate(p_actor,p_session,p_command);
 elsif p_module='insights' then r=public.app_survey_admin(p_actor,p_session,p_command);
 elsif p_module='jobs' then r=public.app_jobs_admin(p_actor,p_session,p_command);
 end if;
 if r->>'code'='saved' then if not(p_module='surveys' and p_command->>'type' in('start','save','submit','peer_save','peer_submit')) then update sim_murid_private.operations_state set revision=revision+1;end if;
 insert into sim_murid_private.operations_requests(id,actor,module,command,result) values(p_request,p_actor,'services:'||p_module,p_command,r);
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id,metadata) values(p_actor,'user',p_module||'.'||(p_command->>'type'),p_module,(r->>'id')::uuid,p_request,jsonb_build_object('command',p_command-'encryptedKey','result',r-'response'));end if;return r;
exception when unique_violation then return jsonb_build_object('code','duplicate');when invalid_text_representation or check_violation or not_null_violation or foreign_key_violation or datetime_field_overflow or numeric_value_out_of_range then return jsonb_build_object('code','invalid');end$$;

commit;
