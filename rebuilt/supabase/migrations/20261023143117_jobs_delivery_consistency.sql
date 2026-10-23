begin;
-- Keep server-only invoker functions, claim semantics and retry ceiling.
create or replace function public.app_jobs_admin(p_actor uuid,p_session uuid,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$begin
 if not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_command->>'type'='tick' then return public.app_jobs_tick(coalesce((p_command->>'dryRun')::boolean,true));
 elsif p_command->>'type'='retry' then
 update sim_murid_private.outbox set status='queued',available_at=now() where id=(p_command->>'id')::uuid and status='failed' and attempts<5;
 if not found then return jsonb_build_object('code','not_found');end if;
 return jsonb_build_object('code','saved','id',p_command->>'id');
 else return jsonb_build_object('code','invalid');end if;end$$;
create or replace function public.app_delivery_worker(p_action text,p_id uuid default null,p_status text default null,p_provider text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare r sim_murid_private.outbox%rowtype;begin
 if p_action='claim' then
 update sim_murid_private.outbox set status='ambiguous',last_error_code='claim_expired' where status='processing' and locked_until<now();
 select * into r from sim_murid_private.outbox where status in('queued','failed') and attempts<5 and available_at<=now() and channel in('email','whatsapp') order by available_at for update skip locked limit 1;if not found then return jsonb_build_object('code','empty');end if;
 if not exists(select 1 from public.profiles p join sim_murid_private.auth_accounts a on a.user_id=p.id where p.id=(r.payload->>'recipient_id')::uuid and p.status='active' and((r.channel='email' and p.contact_email=r.payload->>'email' and a.verified_contact_email=p.contact_email) or(r.channel='whatsapp' and p.phone=r.payload->>'phone'))) then update sim_murid_private.outbox set status='cancelled',last_error_code='recipient_changed' where id=r.id;return jsonb_build_object('code','empty');end if;
 update sim_murid_private.outbox set status='processing',attempts=attempts+1,locked_until=now()+interval '2 minutes' where id=r.id;return jsonb_build_object('code','claimed','delivery',to_jsonb(r));
 elsif p_action='complete' and p_status in('sent','failed','ambiguous') then
 update sim_murid_private.outbox set status=p_status,provider_message_id=left(p_provider,200),last_error_code=case when p_status='sent' then null else p_status end,available_at=now()+interval '1 minute'*power(2,attempts),locked_until=null where id=p_id and status='processing';if not found then return jsonb_build_object('code','not_found');end if;return jsonb_build_object('code','saved');end if;return jsonb_build_object('code','invalid');end$$;

commit;
