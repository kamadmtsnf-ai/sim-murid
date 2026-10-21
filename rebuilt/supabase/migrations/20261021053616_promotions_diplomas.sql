
begin;
create table sim_murid_private.promotion_history(id uuid primary key default gen_random_uuid(),student_id uuid not null references public.profiles(id),source_year_id uuid not null references public.academic_years(id),target_year_id uuid not null references public.academic_years(id),from_class_id uuid references public.classes(id),to_class_id uuid references public.classes(id),previous_role text not null,new_role text not null,processed_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),unique(student_id,source_year_id));
create table sim_murid_private.diploma_settings(singleton boolean primary key default true check(singleton),allow_view boolean not null default false,allow_download boolean not null default false);
insert into sim_murid_private.diploma_settings values(true,false,false);
create table sim_murid_private.diplomas(user_id uuid primary key references public.profiles(id),metadata jsonb not null default '{}',view_override text not null default 'deny' check(view_override in('inherit','allow','deny')),download_override text not null default 'deny' check(download_override in('inherit','allow','deny')),updated_by uuid not null references public.profiles(id),updated_at timestamptz not null default now());
create table sim_murid_private.learning_assets(id uuid primary key default gen_random_uuid(),kind text not null check(kind in('diploma','book')),target_id uuid not null,slot text not null default 'PDF' check(slot in('PDF','IJAZAH','TRANSKRIP','SKL')),replaces_id uuid references sim_murid_private.learning_assets(id),path text not null unique,mime text not null check(mime in('application/pdf','image/png','image/jpeg')),size bigint not null check(size between 1 and 52428800),filename text not null check(length(filename) between 1 and 200),state text not null default 'pending' check(state in('pending','ready','failed','deleted','purged')),sha256 text,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),check(kind<>'book' or mime='application/pdf'));
create unique index learning_asset_current on sim_murid_private.learning_assets(kind,target_id,slot) where state='ready';
create index learning_assets_target on sim_murid_private.learning_assets(kind,target_id);
create function public.app_diploma_allowed(p_actor uuid,p_session uuid,p_target uuid,p_download boolean default false) returns boolean language sql stable security invoker set search_path='' as $$select public.app_onboarding_ready(p_actor,p_session) and (public.app_education_admin(p_actor,p_session) or(p_actor=p_target and public.app_ops_role(p_target,'alumni') and exists(select 1 from sim_murid_private.diplomas d cross join sim_murid_private.diploma_settings s where d.user_id=p_target and case (case when p_download then d.download_override else d.view_override end) when 'allow' then true when 'deny' then false else case when p_download then s.allow_download else s.allow_view end end)))$$;
create function public.app_promotions_mutate(p_actor uuid,p_session uuid,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$declare item jsonb;sid uuid;cls uuid;oldcls uuid;sy uuid;ty uuid;oldlevel integer;newlevel integer;role text;newrole text;target uuid;begin
 if not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_command->>'type' in('promote','place') then
 sy=(p_command->>'sourceYearId')::uuid;ty=(p_command->>'targetYearId')::uuid;
 if not exists(select 1 from public.academic_years where id=ty) or (p_command->>'type'='promote' and not exists(select 1 from public.academic_years s join public.academic_years t on t.start_year=s.start_year+1 where s.id=sy and t.id=ty)) or jsonb_typeof(p_command->'items') is distinct from 'array' or jsonb_array_length(p_command->'items') not between 1 and 500 then return jsonb_build_object('code','invalid');end if;
 if exists(select 1 from jsonb_array_elements(p_command->'items')x group by x->>'studentId' having count(*)>1) then return jsonb_build_object('code','duplicate');end if;
 for item in select value from jsonb_array_elements(p_command->'items') loop
 sid=(item->>'studentId')::uuid;cls=(item->>'classId')::uuid;
 select r.role_code into role from public.user_roles r join public.profiles p on p.id=r.user_id where r.user_id=sid and p.status='active';if role not in('student','applicant','alumni') or role is null then return jsonb_build_object('code','invalid');end if;
 select e.class_id,c.level into oldcls,oldlevel from sim_murid_private.enrollments e join public.classes c on c.id=e.class_id where e.student_id=sid and e.academic_year_id=sy and e.ended_at is null;
 if (item->>'expectedClassId')::uuid is distinct from oldcls then return jsonb_build_object('code','stale');end if;
 if cls is not null then select level into newlevel from public.classes where id=cls and academic_year_id=ty and archived_at is null;if not found then return jsonb_build_object('code','invalid');end if;end if;
 if p_command->>'type'='promote' then
 if exists(select 1 from sim_murid_private.promotion_history where student_id=sid and source_year_id=sy) then return jsonb_build_object('code','duplicate');end if;
 if role='alumni' or (role='applicant' and (cls is null or newlevel<>7)) or (role='student' and (oldcls is null or (oldlevel=9 and cls is not null) or (oldlevel<9 and (cls is null or newlevel<>oldlevel+1)))) then return jsonb_build_object('code','invalid');end if;end if;
 end loop;
 for item in select value from jsonb_array_elements(p_command->'items') loop
 sid=(item->>'studentId')::uuid;cls=(item->>'classId')::uuid;select role_code into role from public.user_roles where user_id=sid;
 oldcls=(item->>'expectedClassId')::uuid;newrole=case when cls is null then 'alumni' else 'student' end;
 update sim_murid_private.enrollments set ended_at=now() where student_id=sid and ended_at is null;
 update sim_murid_private.student_duty_assignments set archived_at=now() where student_id=sid and archived_at is null;
 update sim_murid_private.mentor_students set revoked_at=now() where student_id=sid and revoked_at is null;
 if cls is not null then insert into sim_murid_private.enrollments(student_id,class_id,academic_year_id,starts_on,created_by) select sid,cls,ty,make_date(start_year,7,1),p_actor from public.academic_years where id=ty;end if;
 update public.user_roles set role_code=newrole where user_id=sid;
 if newrole='alumni' then insert into sim_murid_private.diplomas(user_id,updated_by) values(sid,p_actor) on conflict(user_id) do nothing;end if;
 if p_command->>'type'='promote' then insert into sim_murid_private.promotion_history(student_id,source_year_id,target_year_id,from_class_id,to_class_id,previous_role,new_role,processed_by) values(sid,sy,ty,oldcls,cls,role,newrole,p_actor);end if;
 end loop;
 elsif p_command->>'type'='diploma' then
 sid=(p_command->>'studentId')::uuid;if not public.app_ops_role(sid,'alumni') then return jsonb_build_object('code','invalid');end if;
 insert into sim_murid_private.diplomas(user_id,metadata,updated_by) values(sid,p_command->'metadata',p_actor) on conflict(user_id) do update set metadata=excluded.metadata,updated_by=p_actor,updated_at=now();
 elsif p_command->>'type'='access' then
 if p_command->>'scope'='global' then update sim_murid_private.diploma_settings set allow_view=(p_command->>'view')::boolean,allow_download=(p_command->>'download')::boolean;
 else
 if jsonb_array_length(p_command->'studentIds') not between 1 and 500 then return jsonb_build_object('code','invalid');end if;
 if exists(select 1 from jsonb_array_elements_text(p_command->'studentIds')x where not public.app_ops_role(x::uuid,'alumni')) then return jsonb_build_object('code','invalid');end if;
 insert into sim_murid_private.diplomas(user_id,view_override,download_override,updated_by) select x::uuid,p_command->>'view',p_command->>'download',p_actor from jsonb_array_elements_text(p_command->'studentIds')x on conflict(user_id) do update set view_override=excluded.view_override,download_override=excluded.download_override,updated_by=p_actor,updated_at=now();end if;
 else return jsonb_build_object('code','invalid');end if;return jsonb_build_object('code','saved');end$$;
do $$declare t text;r record;begin foreach t in array array['promotion_history','diploma_settings','diplomas','learning_assets'] loop execute format('alter table sim_murid_private.%I enable row level security',t);execute format('revoke all on sim_murid_private.%I from public,anon,authenticated',t);execute format('grant select,insert,update,delete on sim_murid_private.%I to service_role',t);end loop;for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('app_diploma_allowed','app_promotions_mutate') loop execute format('revoke all on function %s from public,anon,authenticated',r.signature);execute format('grant execute on function %s to service_role',r.signature);end loop;end$$;
commit;
