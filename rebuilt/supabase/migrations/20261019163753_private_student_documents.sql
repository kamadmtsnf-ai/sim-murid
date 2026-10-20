begin;
create table sim_murid_private.student_documents(
 id uuid primary key,owner_id uuid not null references public.profiles(id),kind text not null check(kind in('KK','AKTA','IJAZAH_MI','IJAZAH_TK','KIP','BPJS','KKS','PKH','KTP_AYAH','KTP_IBU','KTP_WALI')),
 filename text not null check(length(filename) between 1 and 200),path text not null unique,mime text not null check(mime in('application/pdf','image/png','image/jpeg')),size bigint not null check(size between 1 and 52428800),sha256 text,
 state text not null default 'pending' check(state in('pending','ready','superseded','deleting','deleted','failed','purged')),replaces uuid references sim_murid_private.student_documents(id),created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(sha256 is null or sha256~'^[a-f0-9]{64}$'),check(path~'^[a-f0-9-]{36}/[a-f0-9-]{36}\.(pdf|png|jpg)$')
);
create unique index student_documents_current on sim_murid_private.student_documents(owner_id,kind) where state='ready';
create index student_documents_owner_time on sim_murid_private.student_documents(owner_id,created_at);
create index student_documents_replaces on sim_murid_private.student_documents(replaces);
create index student_documents_actor on sim_murid_private.student_documents(created_by);
create index student_documents_gc on sim_murid_private.student_documents(updated_at) where state in('pending','superseded','deleted','failed');
alter table sim_murid_private.student_documents enable row level security;
revoke all on sim_murid_private.student_documents from public,anon,authenticated;
grant select,insert,update,delete on sim_murid_private.student_documents to service_role;
create function public.app_document_list(p_actor uuid,p_session uuid,p_owner uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$begin
 if not public.app_student_access(p_actor,p_session,p_owner,false) then return null;end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'filename',filename,'mime',mime,'size',size,'state',state,'created_at',created_at) order by kind,created_at),'[]') from sim_murid_private.student_documents where owner_id=p_owner and state in('ready','pending','deleting'));
end;$$;
create function public.app_document_prepare(p_actor uuid,p_session uuid,p_owner uuid,p_id uuid,p_kind text,p_filename text,p_mime text,p_size bigint) returns jsonb language plpgsql security invoker set search_path='' as $$
declare previous uuid;path text;begin
 perform 1 from public.profiles where id in(p_actor,p_owner) order by id for share;
 if not public.app_student_access(p_actor,p_session,p_owner,true) then return jsonb_build_object('code','denied');end if;
 insert into sim_murid_private.student_profiles(user_id) values(p_owner) on conflict do nothing;
 perform 1 from sim_murid_private.student_profiles where user_id=p_owner for update;
 if p_id is null or p_kind not in('KK','AKTA','IJAZAH_MI','IJAZAH_TK','KIP','BPJS','KKS','PKH','KTP_AYAH','KTP_IBU','KTP_WALI') or p_size not between 1 and 52428800 or p_filename is null or length(p_filename) not between 1 and 200 or p_filename~'[[:cntrl:]/\\]' or p_mime not in('application/pdf','image/png','image/jpeg') or ((p_kind in('KK','AKTA','IJAZAH_MI','IJAZAH_TK'))<>(p_mime='application/pdf')) then return jsonb_build_object('code','invalid');end if;
 if (select count(*) from sim_murid_private.student_documents where owner_id=p_owner and created_at>now()-interval '10 minutes')>=20 then return jsonb_build_object('code','rate_limited');end if;
 select id into previous from sim_murid_private.student_documents where owner_id=p_owner and kind=p_kind and state='ready';
 path=p_owner::text||'/'||p_id::text||case when p_mime='application/pdf' then '.pdf' when p_mime='image/png' then '.png' else '.jpg' end;
 insert into sim_murid_private.student_documents(id,owner_id,kind,filename,path,mime,size,replaces,created_by) values(p_id,p_owner,p_kind,p_filename,path,p_mime,p_size,previous,p_actor);
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id) values(p_actor,'user','document.prepared','document',p_id,p_id);
 return jsonb_build_object('code','prepared','id',p_id,'path',path);
end;$$;
create function public.app_document_get(p_actor uuid,p_session uuid,p_id uuid,p_write boolean default false) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare d sim_murid_private.student_documents%rowtype;begin
 select * into d from sim_murid_private.student_documents where id=p_id;
 if not found or not public.app_student_access(p_actor,p_session,d.owner_id,p_write) then return null;end if;
 if not p_write and d.state<>'ready' then return null;end if;
 return to_jsonb(d);
end;$$;
create function public.app_document_finish(p_actor uuid,p_session uuid,p_id uuid,p_sha256 text,p_valid boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d sim_murid_private.student_documents%rowtype;current_id uuid;begin
 select * into d from sim_murid_private.student_documents where id=p_id;
 if not found or not public.app_student_access(p_actor,p_session,d.owner_id,true) then return jsonb_build_object('code','denied');end if;
 perform 1 from sim_murid_private.student_profiles where user_id=d.owner_id for update;
 select * into d from sim_murid_private.student_documents where id=p_id for update;
 if d.state='ready' and d.sha256=p_sha256 then return jsonb_build_object('code','saved');end if;
 if d.state<>'pending' then return jsonb_build_object('code','stale');end if;
 if p_valid is distinct from true or p_sha256 is null or p_sha256!~'^[a-f0-9]{64}$' or d.created_at<=now()-interval '2 hours' then update sim_murid_private.student_documents set state='failed',updated_at=now() where id=p_id;return jsonb_build_object('code','invalid');end if;
 select id into current_id from sim_murid_private.student_documents where owner_id=d.owner_id and kind=d.kind and state='ready';
 if current_id is distinct from d.replaces then update sim_murid_private.student_documents set state='failed',updated_at=now() where id=p_id;return jsonb_build_object('code','stale');end if;
 update sim_murid_private.student_documents set state='superseded',updated_at=now() where id=d.replaces;
 update sim_murid_private.student_documents set state='ready',sha256=p_sha256,updated_at=now() where id=p_id;
 update sim_murid_private.student_profiles set revision=revision+1,updated_at=now() where user_id=d.owner_id;
 perform public.app_student_recheck(d.owner_id);
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id) values(p_actor,'user','document.verified','document',p_id,p_id);
 return jsonb_build_object('code','saved');
end;$$;
create function public.app_document_delete(p_actor uuid,p_session uuid,p_id uuid,p_done boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d sim_murid_private.student_documents%rowtype;begin
 select * into d from sim_murid_private.student_documents where id=p_id;
 if not found or not public.app_student_access(p_actor,p_session,d.owner_id,true) then return null;end if;
 perform 1 from sim_murid_private.student_profiles where user_id=d.owner_id for update;
 select * into d from sim_murid_private.student_documents where id=p_id for update;
 if d.state='deleted' then return jsonb_build_object('code','deleted');end if;
 if d.state not in('ready','pending','deleting') then return null;end if;
 if p_done and d.state<>'deleting' then return null;end if;
 update sim_murid_private.student_documents set state=case when p_done then 'deleted' else 'deleting' end,updated_at=now() where id=p_id;
 update sim_murid_private.student_profiles set revision=revision+1,updated_at=now() where user_id=d.owner_id;
 perform public.app_student_recheck(d.owner_id);
 if p_done then insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id) values(p_actor,'user','document.deleted','document',p_id,gen_random_uuid());end if;
 return jsonb_build_object('code',case when p_done then 'deleted' else 'deleting' end,'path',d.path);
end;$$;
create function public.app_document_gc(p_actor uuid,p_session uuid,p_owner uuid,p_done uuid default null) returns jsonb language plpgsql security invoker set search_path='' as $$begin
 if not public.app_student_access(p_actor,p_session,p_owner,true) then return null;end if;
 if p_done is not null then update sim_murid_private.student_documents set state='purged',updated_at=now() where id=p_done and owner_id=p_owner and ((state in('failed','deleted','superseded') and updated_at<now()-interval '1 hour') or(state='pending' and created_at<now()-interval '2 hours'));end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('id',id,'path',path)),'[]') from(select id,path from sim_murid_private.student_documents where owner_id=p_owner and ((state in('failed','deleted','superseded') and updated_at<now()-interval '1 hour') or(state='pending' and created_at<now()-interval '2 hours')) order by updated_at limit 10)x);
end;$$;
do $$declare f record;begin for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'app_document_%' loop execute format('revoke all on function %s from public,anon,authenticated',f.sig);execute format('grant execute on function %s to service_role',f.sig);end loop;
 if to_regclass('storage.buckets') is not null then insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('student-documents','student-documents',false,52428800,array['application/pdf','image/png','image/jpeg']) on conflict(id) do nothing;end if;
end $$;
commit;
