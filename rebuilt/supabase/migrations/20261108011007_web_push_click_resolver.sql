begin;
-- Direct lookup by opaque delivery reference, independent from the latest-200 inbox reader.
-- Channel flags/transport expiry do not remove access to an otherwise authorized inbox.
create function public.app_push_open(p_actor uuid,p_session uuid,p_ref uuid,p_mark boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
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
 return jsonb_build_object('id',i.id,'title',i.title,'message',i.message,'created_at',i.created_at,'read_at',i.read_at);
end$$;
revoke all on function public.app_push_open(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.app_push_open(uuid,uuid,uuid,boolean) to service_role;
commit;
