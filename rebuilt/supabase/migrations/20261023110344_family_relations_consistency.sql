begin;
create or replace function public.app_family_read(p_actor uuid,p_session uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$ begin
 if not public.app_education_admin(p_actor,p_session) then return null;end if;
 return jsonb_build_object('revision',(select revision from sim_murid_private.education_state),'students',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'name',p.full_name) order by p.full_name,p.id),'[]') from public.profiles p join public.user_roles r on r.user_id=p.id where r.role_code in('student','applicant') and p.status='active'),
 'parents',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'name',p.full_name) order by p.full_name,p.id),'[]') from public.profiles p join public.user_roles r on r.user_id=p.id where r.role_code='parent' and p.status='active'),
 'references',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'name',p.full_name) order by p.full_name,p.id),'[]') from public.profiles p where p.id in(select student_id from sim_murid_private.student_guardians where revoked_at is null union select parent_id from sim_murid_private.student_guardians where revoked_at is null union select student_id from sim_murid_private.family_members where revoked_at is null)),
 'guardians',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'student_id',g.student_id,'parent_id',g.parent_id,'relationship',g.relationship)),'[]') from sim_murid_private.student_guardians g where g.revoked_at is null),
 'families',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'members',(select coalesce(jsonb_agg(jsonb_build_object('student_id',m.student_id,'legacy_order',m.legacy_order) order by m.legacy_order),'[]') from sim_murid_private.family_members m where m.family_id=g.id and m.revoked_at is null)) order by g.name,g.id),'[]') from sim_murid_private.family_groups g));
end;$$;
create or replace function public.app_family_write(p_actor uuid,p_session uuid,p_request uuid,p_revision bigint,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare version bigint;old sim_murid_private.education_requests%rowtype;result jsonb;target uuid;student uuid;parent uuid;members uuid[];begin
 perform 1 from public.profiles where id=p_actor for share;perform 1 from public.user_roles where user_id=p_actor for share;
 if not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 select revision into version from sim_murid_private.education_state for update;
 select * into old from sim_murid_private.education_requests where id=p_request;
 if found then if old.actor=p_actor and old.command=p_command then return old.result;end if;return jsonb_build_object('code','request_conflict');end if;
 if p_revision is distinct from version then return jsonb_build_object('code','stale');end if;
 if p_command->>'type'='guardian' then
  student=(p_command->>'studentId')::uuid;parent=(p_command->>'parentId')::uuid;
 if p_command->>'relationship' is null or p_command->>'relationship' not in('father','mother','guardian') then return jsonb_build_object('code','invalid');end if;
  if not coalesce((p_command->>'remove')::boolean,false) and (p_command->>'relationship' not in('father','mother','guardian') or not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where p.id=student and p.status='active' and r.role_code in('student','applicant')) or not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where p.id=parent and p.status='active' and r.role_code='parent')) then return jsonb_build_object('code','invalid');end if;
  if (p_command->>'remove')::boolean then update sim_murid_private.student_guardians set revoked_at=now() where student_id=student and parent_id=parent and relationship=p_command->>'relationship' and revoked_at is null;
  else insert into sim_murid_private.student_guardians(student_id,parent_id,relationship,verified_by) values(student,parent,p_command->>'relationship',p_actor) on conflict(student_id,parent_id,relationship) where revoked_at is null do nothing;end if;target=student;
 elsif p_command->>'type'='family' then
  target=(p_command->>'id')::uuid;
 members=array(select jsonb_array_elements_text(p_command->'studentIds')::uuid);
  if cardinality(members) not between 1 and 30 or cardinality(members)<>(select count(distinct x) from unnest(members)x) or length(btrim(p_command->>'name')) not between 1 and 150 or exists(select 1 from unnest(members)x where not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where p.id=x and p.status='active' and r.role_code in('student','applicant')) and not exists(select 1 from sim_murid_private.family_members m where m.student_id=x and m.family_id=target and m.revoked_at is null)) then return jsonb_build_object('code','invalid');end if;

  if target is null then insert into sim_murid_private.family_groups(name,created_by) values(btrim(p_command->>'name'),p_actor) returning id into target;
  else update sim_murid_private.family_groups set name=btrim(p_command->>'name') where id=target;if not found then return jsonb_build_object('code','not_found');end if;end if;
  update sim_murid_private.family_members set revoked_at=now() where revoked_at is null and ((family_id=target and not(student_id=any(members))) or (family_id<>target and student_id=any(members)));
  insert into sim_murid_private.family_members(family_id,student_id,created_by) select target,x,p_actor from unnest(members)x where not exists(select 1 from sim_murid_private.family_members where family_id=target and student_id=x and revoked_at is null);
 else return jsonb_build_object('code','invalid');end if;
 update sim_murid_private.education_state set revision=revision+1 where singleton=true;
 result=jsonb_build_object('code','saved','id',target);
 insert into sim_murid_private.education_requests(id,actor,target,command,result) values(p_request,p_actor,target,p_command,result);
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id) values(p_actor,'user','family.'||(p_command->>'type'),'family',target,p_request);
 return result;
exception when unique_violation then return jsonb_build_object('code','duplicate');when invalid_text_representation or check_violation then return jsonb_build_object('code','invalid');end;$$;


commit;
