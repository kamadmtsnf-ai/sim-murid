begin;
create table sim_murid_private.student_profiles(user_id uuid primary key references public.profiles(id) on delete restrict,data jsonb not null default '{}' check(jsonb_typeof(data)='object'),revision bigint not null default 0 check(revision>=0),updated_by uuid references public.profiles(id),updated_at timestamptz not null default now());
create index student_profiles_actor_idx on sim_murid_private.student_profiles(updated_by);
create table sim_murid_private.student_guardians(id uuid primary key default gen_random_uuid(),student_id uuid not null references public.profiles(id),parent_id uuid not null references public.profiles(id),relationship text not null check(relationship in('father','mother','guardian')),verified_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),revoked_at timestamptz,check(student_id<>parent_id));
create unique index student_guardians_current on sim_murid_private.student_guardians(student_id,parent_id,relationship) where revoked_at is null;
create index student_guardians_parent on sim_murid_private.student_guardians(parent_id,student_id) where revoked_at is null;
create index student_guardians_verifier on sim_murid_private.student_guardians(verified_by);
create table sim_murid_private.family_groups(id uuid primary key default gen_random_uuid(),name text not null check(length(btrim(name)) between 1 and 150),created_by uuid not null references public.profiles(id),created_at timestamptz not null default now());
create index family_groups_actor on sim_murid_private.family_groups(created_by);
create table sim_murid_private.family_members(id uuid primary key default gen_random_uuid(),family_id uuid not null references sim_murid_private.family_groups(id),student_id uuid not null references public.profiles(id),legacy_order bigint generated always as identity,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),revoked_at timestamptz);
create unique index family_members_student_current on sim_murid_private.family_members(student_id) where revoked_at is null;
create index family_members_group on sim_murid_private.family_members(family_id);
create index family_members_actor on sim_murid_private.family_members(created_by);
create table sim_murid_private.education_state(singleton boolean primary key default true check(singleton),revision bigint not null default 0 check(revision>=0));
insert into sim_murid_private.education_state values(true,0);
create table sim_murid_private.education_requests(id uuid primary key,actor uuid not null references public.profiles(id),target uuid,command jsonb not null,result jsonb not null,created_at timestamptz not null default now());
create index education_requests_actor on sim_murid_private.education_requests(actor);
do $$ declare t text;begin foreach t in array array['student_profiles','student_guardians','family_groups','family_members','education_state','education_requests'] loop
 execute format('alter table sim_murid_private.%I enable row level security',t);
 execute format('revoke all on table sim_murid_private.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on table sim_murid_private.%I to service_role',t);
end loop;end $$;
grant usage,select on all sequences in schema sim_murid_private to service_role;
create function public.app_education_admin(p_actor uuid,p_session uuid) returns boolean language sql stable security invoker set search_path='' as $$ select public.app_onboarding_ready(p_actor,p_session) and exists(select 1 from public.user_roles where user_id=p_actor and role_code='admin');$$;
create function public.app_education_task(p_actor uuid,p_code text,p_class uuid default null) returns boolean language sql stable security invoker set search_path='' as $$
select exists(select 1 from public.user_assignments a join public.user_roles r on r.user_id=a.user_id where a.user_id=p_actor and r.role_code in('admin','teacher') and a.assignment_code=p_code and a.scope_class_id is not distinct from p_class and a.revoked_at is null and a.valid_from<=(now() at time zone 'Asia/Jakarta')::date and (a.valid_until is null or a.valid_until>=(now() at time zone 'Asia/Jakarta')::date));$$;
create function public.app_student_access(p_actor uuid,p_session uuid,p_target uuid,p_write boolean default false) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare gate text;begin
 if not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where r.user_id=p_target and r.role_code in('student','applicant','alumni') and p.status='active') then return false;end if;
 gate=public.app_security_state(p_actor,p_session)->>'gate';
 if gate is null or gate in('password','account_pending') then return false;end if;
 if p_actor=p_target then return exists(select 1 from public.user_roles where user_id=p_actor and role_code in('student','applicant','alumni'));end if;
 if public.app_education_admin(p_actor,p_session) then return true;end if;
 if p_write or gate<>'ready' then return false;end if;
 -- Parents receive read access only after an explicit verified relation, never by matching names or KK.
 return exists(select 1 from public.user_roles where user_id=p_actor and role_code='parent') and exists(select 1 from sim_murid_private.student_guardians where parent_id=p_actor and student_id=p_target and revoked_at is null);
end;$$;
create function public.app_student_required(p_data jsonb) returns text[] language plpgsql immutable security invoker set search_path='' as $$
declare fields text[]:=array['NIK','TempatLahir','TanggalLahir','JenisKelamin','JumlahSaudara','AnakKe','Agama','CitaCita','Hobi','NoHP','Email','BiayaSekolah','PraSekolah','NomorKK','NamaKepalaKeluarga','AyahNama','AyahStatus','AyahNIK','AyahTempatLahir','AyahTanggalLahir','AyahPendidikan','AyahPekerjaan','AyahPenghasilan','AyahNoHP','IbuNama','IbuStatus','IbuNIK','IbuTempatLahir','IbuTanggalLahir','IbuPendidikan','IbuPekerjaan','IbuPenghasilan','IbuNoHP','WaliPilihan','SiswaStatusTempatTinggal','SiswaProvinsi','SiswaKabupaten','SiswaKecamatan','SiswaKelurahan','SiswaRW','SiswaRT','SiswaJalan','SiswaKodePos','SiswaJarak','SiswaTransportasi','SiswaWaktuTempuh']::text[];begin
 if p_data->>'AyahStatus'='Masih Hidup' and coalesce(p_data->>'AyahAlamatTinggalLuarNegeri','false')<>'true' then fields=fields||array['AyahStatusKepemilikanRumah','AyahProvinsi','AyahKabupaten','AyahKecamatan','AyahKelurahan','AyahRW','AyahRT','AyahJalan','AyahKodePos']::text[];end if;
 if p_data->>'IbuStatus'='Masih Hidup' and coalesce(p_data->>'IbuAlamatTinggalLuarNegeri','false')<>'true' and coalesce(p_data->>'IbuAlamatSamadenganAyah','false')<>'true' then fields=fields||array['IbuStatusKepemilikanRumah','IbuProvinsi','IbuKabupaten','IbuKecamatan','IbuKelurahan','IbuRW','IbuRT','IbuJalan','IbuKodePos']::text[];end if;
 if p_data->>'WaliPilihan'='Lainnya' then fields=fields||array['WaliNama','WaliStatus','WaliNIK','WaliTempatLahir','WaliTanggalLahir','WaliPendidikan','WaliPekerjaan','WaliPenghasilan','WaliNoHP','WaliAlamatStatus']::text[];if p_data->>'WaliAlamatStatus'='Lainnya' and coalesce(p_data->>'WaliAlamatTinggalLuarNegeri','false')<>'true' then fields=fields||array['WaliStatusKepemilikanRumah','WaliProvinsi','WaliKabupaten','WaliKecamatan','WaliKelurahan','WaliRW','WaliRT','WaliJalan','WaliKodePos']::text[];end if;end if;
 return fields;end;$$;
create function public.app_student_progress(p_target uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare d jsonb; fields text[];docs text[]:=array['KK','AKTA','IJAZAH_MI'];missing jsonb:='[]';missing_docs jsonb:='[]';field text;present boolean;total integer;n integer;begin
 select data into d from sim_murid_private.student_profiles where user_id=p_target;d=coalesce(d,'{}');fields=public.app_student_required(d);
 if d->>'AyahStatus'='Masih Hidup' then docs=docs||array['KTP_AYAH'];end if;if d->>'IbuStatus'='Masih Hidup' then docs=docs||array['KTP_IBU'];end if;if d->>'WaliPilihan'='Lainnya' then docs=docs||array['KTP_WALI'];end if;
 foreach field in array fields loop if coalesce(btrim(d->>field),'')='' then missing=missing||to_jsonb(field);end if;end loop;
 foreach field in array docs loop
  present=false;
  if to_regclass('sim_murid_private.student_documents') is not null then execute 'select exists(select 1 from sim_murid_private.student_documents where owner_id=$1 and kind=$2 and state=''ready'')' into present using p_target,field;end if;
  if not present then missing_docs=missing_docs||to_jsonb(field);end if;
 end loop;
 total=cardinality(fields)+cardinality(docs);n=jsonb_array_length(missing)+jsonb_array_length(missing_docs);
 return jsonb_build_object('missing',missing,'missingDocuments',missing_docs,'percent',round(100.0*(total-n)/total),'complete',n=0);
end;$$;
create function public.app_student_recheck(p_target uuid) returns void language plpgsql security invoker set search_path='' as $$ begin
 insert into sim_murid_private.auth_accounts(user_id,profile_completed_at) values(p_target,case when (public.app_student_progress(p_target)->>'complete')::boolean then now() else null end)
 on conflict(user_id) do update set profile_completed_at=excluded.profile_completed_at;
end;$$;
create function public.app_student_read(p_actor uuid,p_session uuid,p_target uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not public.app_student_access(p_actor,p_session,p_target,false) then return null;end if;
 return jsonb_build_object('id',p_target,'username',(select username from public.profiles where id=p_target),'name',(select full_name from public.profiles where id=p_target),'data',coalesce((select data from sim_murid_private.student_profiles where user_id=p_target),'{}'),'revision',coalesce((select revision from sim_murid_private.student_profiles where user_id=p_target),0),'progress',public.app_student_progress(p_target),'can_write',public.app_student_access(p_actor,p_session,p_target,true));
end;$$;
create function public.app_student_save(p_actor uuid,p_session uuid,p_target uuid,p_request uuid,p_revision bigint,p_data jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare version bigint;old sim_murid_private.education_requests%rowtype;result jsonb;cmd jsonb;item record;begin
 perform 1 from public.profiles where id in(p_actor,p_target) order by id for share;
 if not public.app_student_access(p_actor,p_session,p_target,true) then return jsonb_build_object('code','denied');end if;
 if p_request is null or p_revision is null or p_data is null or jsonb_typeof(p_data)<>'object' then return jsonb_build_object('code','invalid');end if;
 for item in select key,value from jsonb_each(p_data) loop
  if not(item.key=any(array['NIK','TempatLahir','TanggalLahir','JenisKelamin','JumlahSaudara','AnakKe','Agama','CitaCita','Hobi','NoHP','Email','BiayaSekolah','PraSekolah','NomorKK','NamaKepalaKeluarga','AyahNama','AyahStatus','AyahNIK','AyahTempatLahir','AyahTanggalLahir','AyahPendidikan','AyahPekerjaan','AyahPenghasilan','AyahNoHP','IbuNama','IbuStatus','IbuNIK','IbuTempatLahir','IbuTanggalLahir','IbuPendidikan','IbuPekerjaan','IbuPenghasilan','IbuNoHP','WaliPilihan','WaliNama','WaliStatus','WaliNIK','WaliTempatLahir','WaliTanggalLahir','WaliPendidikan','WaliPekerjaan','WaliPenghasilan','WaliNoHP','AyahAlamatTinggalLuarNegeri','AyahStatusKepemilikanRumah','AyahProvinsi','AyahKabupaten','AyahKecamatan','AyahKelurahan','AyahRW','AyahRT','AyahJalan','AyahKodePos','IbuAlamatSamadenganAyah','IbuAlamatTinggalLuarNegeri','IbuStatusKepemilikanRumah','IbuProvinsi','IbuKabupaten','IbuKecamatan','IbuKelurahan','IbuRW','IbuRT','IbuJalan','IbuKodePos','WaliAlamatStatus','WaliAlamatTinggalLuarNegeri','WaliStatusKepemilikanRumah','WaliProvinsi','WaliKabupaten','WaliKecamatan','WaliKelurahan','WaliRW','WaliRT','WaliJalan','WaliKodePos','SiswaStatusTempatTinggal','SiswaProvinsi','SiswaKabupaten','SiswaKecamatan','SiswaKelurahan','SiswaRW','SiswaRT','SiswaJalan','SiswaKodePos','SiswaJarak','SiswaTransportasi','SiswaWaktuTempuh']::text[])) or (item.key=any(array['AyahAlamatTinggalLuarNegeri','IbuAlamatSamadenganAyah','IbuAlamatTinggalLuarNegeri','WaliAlamatTinggalLuarNegeri']::text[]) and jsonb_typeof(item.value)<>'boolean') or (not(item.key=any(array['AyahAlamatTinggalLuarNegeri','IbuAlamatSamadenganAyah','IbuAlamatTinggalLuarNegeri','WaliAlamatTinggalLuarNegeri']::text[])) and (jsonb_typeof(item.value)<>'string' or length(item.value#>>'{}')>500)) then return jsonb_build_object('code','invalid');end if;
 end loop;
 insert into sim_murid_private.student_profiles(user_id) values(p_target) on conflict do nothing;
 select revision into version from sim_murid_private.student_profiles where user_id=p_target for update;
 cmd=jsonb_build_object('type','student_profile','data',p_data);
 select * into old from sim_murid_private.education_requests where id=p_request;
 if found then if old.actor=p_actor and old.target=p_target and old.command=cmd then return old.result;end if;return jsonb_build_object('code','request_conflict');end if;
 if version<>p_revision then return jsonb_build_object('code','stale');end if;
 update sim_murid_private.student_profiles set data=p_data,revision=revision+1,updated_at=statement_timestamp(),updated_by=p_actor where user_id=p_target;
 perform public.app_student_recheck(p_target);result=jsonb_build_object('code','saved');
 insert into sim_murid_private.education_requests(id,actor,target,command,result) values(p_request,p_actor,p_target,cmd,result);
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id) values(p_actor,'user','student.profile_saved','profile',p_target,p_request);
 return result;
end;$$;
create function public.app_family_read(p_actor uuid,p_session uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$ begin
 if not public.app_education_admin(p_actor,p_session) then return null;end if;
 return jsonb_build_object('revision',(select revision from sim_murid_private.education_state),'students',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'name',p.full_name) order by p.full_name,p.id),'[]') from public.profiles p join public.user_roles r on r.user_id=p.id where r.role_code in('student','applicant') and p.status='active'),
 'parents',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'name',p.full_name) order by p.full_name,p.id),'[]') from public.profiles p join public.user_roles r on r.user_id=p.id where r.role_code='parent' and p.status='active'),
 'guardians',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'student_id',g.student_id,'parent_id',g.parent_id,'relationship',g.relationship)),'[]') from sim_murid_private.student_guardians g where g.revoked_at is null),
 'families',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'members',(select coalesce(jsonb_agg(jsonb_build_object('student_id',m.student_id,'legacy_order',m.legacy_order) order by m.legacy_order),'[]') from sim_murid_private.family_members m where m.family_id=g.id and m.revoked_at is null)) order by g.name,g.id),'[]') from sim_murid_private.family_groups g));
end;$$;
create function public.app_family_write(p_actor uuid,p_session uuid,p_request uuid,p_revision bigint,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare version bigint;old sim_murid_private.education_requests%rowtype;result jsonb;target uuid;student uuid;parent uuid;members uuid[];begin
 perform 1 from public.profiles where id=p_actor for share;perform 1 from public.user_roles where user_id=p_actor for share;
 if not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 select revision into version from sim_murid_private.education_state for update;
 select * into old from sim_murid_private.education_requests where id=p_request;
 if found then if old.actor=p_actor and old.command=p_command then return old.result;end if;return jsonb_build_object('code','request_conflict');end if;
 if p_revision is distinct from version then return jsonb_build_object('code','stale');end if;
 if p_command->>'type'='guardian' then
  student=(p_command->>'studentId')::uuid;parent=(p_command->>'parentId')::uuid;
  if p_command->>'relationship' not in('father','mother','guardian') or not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where p.id=student and p.status='active' and r.role_code in('student','applicant')) or not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where p.id=parent and p.status='active' and r.role_code='parent') then return jsonb_build_object('code','invalid');end if;
  if (p_command->>'remove')::boolean then update sim_murid_private.student_guardians set revoked_at=now() where student_id=student and parent_id=parent and relationship=p_command->>'relationship' and revoked_at is null;
  else insert into sim_murid_private.student_guardians(student_id,parent_id,relationship,verified_by) values(student,parent,p_command->>'relationship',p_actor) on conflict(student_id,parent_id,relationship) where revoked_at is null do nothing;end if;target=student;
 elsif p_command->>'type'='family' then
  members=array(select jsonb_array_elements_text(p_command->'studentIds')::uuid);
  if cardinality(members) not between 1 and 30 or cardinality(members)<>(select count(distinct x) from unnest(members)x) or length(btrim(p_command->>'name')) not between 1 and 150 or exists(select 1 from unnest(members)x where not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where p.id=x and p.status='active' and r.role_code in('student','applicant'))) then return jsonb_build_object('code','invalid');end if;
  target=(p_command->>'id')::uuid;
  if target is null then insert into sim_murid_private.family_groups(name,created_by) values(btrim(p_command->>'name'),p_actor) returning id into target;
  else update sim_murid_private.family_groups set name=btrim(p_command->>'name') where id=target;if not found then return jsonb_build_object('code','not_found');end if;end if;
  update sim_murid_private.family_members set revoked_at=now() where revoked_at is null and ((family_id=target and not(student_id=any(members))) or (family_id<>target and student_id=any(members)));
  insert into sim_murid_private.family_members(family_id,student_id,created_by) select target,x,p_actor from unnest(members)x where not exists(select 1 from sim_murid_private.family_members where family_id=target and student_id=x and revoked_at is null);
 else return jsonb_build_object('code','invalid');end if;
 update sim_murid_private.education_state set revision=revision+1;
 result=jsonb_build_object('code','saved','id',target);
 insert into sim_murid_private.education_requests(id,actor,target,command,result) values(p_request,p_actor,target,p_command,result);
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id) values(p_actor,'user','family.'||(p_command->>'type'),'family',target,p_request);
 return result;
exception when unique_violation then return jsonb_build_object('code','duplicate');when invalid_text_representation or check_violation then return jsonb_build_object('code','invalid');end;$$;
-- All entry points service-only; none takes client-supplied JWT authorization claims.
do $$ declare f record;begin for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'app_student_%' or p.proname in('app_family_read','app_family_write','app_education_admin','app_education_task')) loop
 execute format('revoke all on function %s from public,anon,authenticated',f.sig);execute format('grant execute on function %s to service_role',f.sig);
end loop;end $$;
commit;
