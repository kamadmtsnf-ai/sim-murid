
begin;
create table sim_murid_private.point_catalog(code text primary key check(code~'^[A-I][0-9]{2}$'),category text not null,description text not null,points integer not null check(points between -100 and 100),consequence text not null default '',active boolean not null default true);
create table sim_murid_private.point_events(id uuid primary key default gen_random_uuid(),ordinal bigint generated always as identity unique,student_id uuid not null references public.profiles(id),class_id uuid not null references public.classes(id),event_date date not null,code text not null references sim_murid_private.point_catalog(code),catalog_snapshot jsonb not null,base_points integer not null,notes text not null check(length(notes)<=2000),created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),cancelled_at timestamptz,cancel_reason text);
create index point_events_student_date on sim_murid_private.point_events(student_id,event_date,ordinal);
create index point_events_class on sim_murid_private.point_events(class_id);
create index point_events_code on sim_murid_private.point_events(code);
create index point_events_actor on sim_murid_private.point_events(created_by);
create table sim_murid_private.point_month_snapshots(student_id uuid references public.profiles(id),month date check(extract(day from month)=1),snapshot jsonb not null,created_at timestamptz not null default now(),primary key(student_id,month));
create trigger point_month_immutable before update or delete on sim_murid_private.point_month_snapshots for each row execute function sim_murid_private.deny_mutation();
create table sim_murid_private.affective_scores(student_id uuid references public.profiles(id),month date not null,subject_id uuid references public.subjects(id),score integer not null check(score between 0 and 100),source jsonb not null,primary key(student_id,month,subject_id));
create index affective_subject on sim_murid_private.affective_scores(subject_id);
create function public.app_point_level(p_score integer) returns integer language sql immutable security invoker set search_path='' as $$select case when p_score>=51 then 0 when p_score>=31 then 1 when p_score>=21 then 2 when p_score>=11 then 3 when p_score>=1 then 4 else 5 end$$;
create function public.app_point_access(p_actor uuid,p_session uuid,p_student uuid,p_write boolean default false) returns boolean language sql stable security invoker set search_path='' as $$select public.app_onboarding_ready(p_actor,p_session) and(case when p_write then public.app_education_admin(p_actor,p_session) or public.app_ops_role(p_actor,'teacher') else public.app_ops_student(p_actor,p_session,p_student) or exists(select 1 from sim_murid_private.enrollments e join public.classes c on c.id=e.class_id where e.student_id=p_student and c.homeroom_teacher_id=p_actor) or exists(select 1 from sim_murid_private.mentor_students where teacher_id=p_actor and student_id=p_student and revoked_at is null) or public.app_ops_role(p_actor,'teacher') end)$$;
create function public.app_point_replay(p_student uuid,p_month date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare e record;score integer:=50;before_score integer;mult integer;zero boolean;n integer;counts jsonb:='{}';events jsonb:='[]';violations integer:=0;good integer:=0;begin
 for e in select * from sim_murid_private.point_events where student_id=p_student and event_date>=p_month and event_date<(p_month+interval '1 month')::date and cancelled_at is null order by event_date,ordinal loop
 before_score=score;mult=1;zero=false;
 if e.base_points<0 and left(e.code,1) in('A','B','C','D','E') then n=coalesce((counts->>e.code)::integer,0)+1;counts=jsonb_set(counts,array[e.code],to_jsonb(n));mult=least(n,3);zero=n>=4;end if;
 score=case when zero then 0 else greatest(-50,least(100,score+e.base_points*mult)) end;
 if e.base_points<0 then violations=violations+1;elsif e.base_points>0 then good=good+1;end if;
 events=events||jsonb_build_array(to_jsonb(e)||jsonb_build_object('multiplier',mult,'r02',mult>=3,'r03',zero,'before',before_score,'after',score,'delta',case when zero then -before_score else score-before_score end));
 end loop;return jsonb_build_object('student_id',p_student,'month',p_month,'balance',score,'level',public.app_point_level(score),'violations',violations,'good',good,'events',events,'policy','SPK-1.0');end$$;
create function public.app_point_mutate(p_actor uuid,p_session uuid,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare cat sim_murid_private.point_catalog%rowtype;old_event sim_murid_private.point_events%rowtype;sid uuid;cls uuid;target uuid;mo date;dt date;r jsonb;begin
 if p_command->>'type'='catalog' then
 if not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 insert into sim_murid_private.point_catalog values(p_command->>'code',p_command->>'category',p_command->>'description',(p_command->>'points')::integer,coalesce(p_command->>'consequence',''),(p_command->>'active')::boolean) on conflict(code) do update set category=excluded.category,description=excluded.description,points=excluded.points,consequence=excluded.consequence,active=excluded.active;return jsonb_build_object('code','saved');
 elsif p_command->>'type'='cancel' then
 select * into old_event from sim_murid_private.point_events where id=(p_command->>'id')::uuid and cancelled_at is null;if not found then return jsonb_build_object('code','not_found');end if;
 if not(public.app_education_admin(p_actor,p_session) or(old_event.created_by=p_actor and public.app_point_access(p_actor,p_session,old_event.student_id,true))) then return jsonb_build_object('code','denied');end if;
 mo=date_trunc('month',old_event.event_date)::date;if exists(select 1 from sim_murid_private.point_month_snapshots where student_id=old_event.student_id and month=mo) then return jsonb_build_object('code','archived');end if;
 update sim_murid_private.point_events set cancelled_at=now(),cancel_reason=p_command->>'reason' where id=old_event.id;return jsonb_build_object('code','saved','id',old_event.id);
 elsif p_command->>'type'='event' then
 sid=(p_command->>'studentId')::uuid;dt=(p_command->>'date')::date;mo=date_trunc('month',dt)::date;
 if not public.app_point_access(p_actor,p_session,sid,true) then return jsonb_build_object('code','denied');end if;
 if dt>public.app_ops_today() or not public.app_ops_role(sid,'student') then return jsonb_build_object('code','invalid');end if;
 if exists(select 1 from sim_murid_private.point_month_snapshots where student_id=sid and month=mo) then return jsonb_build_object('code','archived');end if;
 select e.class_id into cls from sim_murid_private.enrollments e join public.academic_years y on y.id=e.academic_year_id where e.student_id=sid and dt>=make_date(y.start_year,7,1) and dt<make_date(y.start_year+1,7,1) order by e.created_at desc limit 1;if cls is null then return jsonb_build_object('code','invalid');end if;
 select * into cat from sim_murid_private.point_catalog where code=p_command->>'code' and active;if not found then return jsonb_build_object('code','invalid');end if;
 insert into sim_murid_private.point_events(student_id,class_id,event_date,code,catalog_snapshot,base_points,notes,created_by) values(sid,cls,dt,cat.code,to_jsonb(cat),cat.points,coalesce(p_command->>'notes',''),p_actor) returning id into target;
 return jsonb_build_object('code','saved','id',target);
 else return jsonb_build_object('code','invalid');end if;end$$;
insert into sim_murid_private.point_catalog(code,category,description,points,consequence) values
('A01','Kehadiran','Terlambat datang ke sekolah < 15 menit',-2,''),
('A02','Kehadiran','Terlambat datang ke sekolah 15–30 menit',-4,''),
('A03','Kehadiran','Terlambat datang ke sekolah > 30 menit',-6,''),
('A04','Kehadiran','Tidak hadir tanpa keterangan (Alpha)',-8,''),
('B01','Penampilan','Tidak memakai seragam lengkap/sesuai',-3,''),
('B02','Penampilan','Rambut panjang / tidak rapi (putra)',-3,''),
('B03','Penampilan','Memakai aksesoris dilarang (gelang, kalung)',-2,''),
('C01','Etika','Berkata kasar/tidak sopan kepada guru/teman',-5,''),
('C02','Etika','Membully atau mengintimidasi teman',-10,'Wajib Restitusi Sosial'),
('C03','Etika','Tidak mengerjakan tugas/PR tanpa alasan',-3,''),
('C04','Etika','Membawa/menggunakan HP saat KBM',-5,'Wajib serahkan HP ke Wali Kelas'),
('D01','Kebersihan','Membuang sampah sembarangan',-2,''),
('D02','Kebersihan','Merusak fasilitas/sarana sekolah',-8,'Wajib Restitusi Fisik'),
('E01','Keamanan','Berkelahi atau terlibat perkelahian',-15,'Panggilan Wali + Pernyataan Tertulis'),
('E02','Keamanan','Membawa benda tajam/berbahaya',-10,'Konfiskasi Barang'),
('F01','Prestasi Akademik','Peringkat 1–3 di kelas',5,''),
('F02','Prestasi Akademik','Nilai sempurna (100) pada ulangan',3,''),
('G01','Prestasi Non-Akademik','Memenangkan perlombaan tingkat sekolah',5,''),
('G02','Prestasi Non-Akademik','Memenangkan perlombaan tingkat Kab/Kota',8,''),
('H01','Kontribusi','Memimpin kegiatan ekstra/OSIS',3,''),
('H02','Kontribusi','Aktif membantu kegiatan madrasah',2,''),
('I01','Perilaku Baik','Melaporkan pelanggaran teman secara jujur',2,''),
('I02','Perilaku Baik','Membantu teman yang kesulitan belajar',2,''),
('I03','Perilaku Baik','Tidak pernah terlambat selama 1 bulan',3,''),
('I04','Perilaku Baik','Hafal surat pendek tambahan / prestasi Al-Quran',4,'');

do $$declare t text;r record;begin foreach t in array array['point_catalog','point_events','point_month_snapshots','affective_scores'] loop execute format('alter table sim_murid_private.%I enable row level security',t);execute format('revoke all on sim_murid_private.%I from public,anon,authenticated',t);execute format('grant select,insert,update,delete on sim_murid_private.%I to service_role',t);end loop;for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('app_point_level','app_point_access','app_point_replay','app_point_mutate') loop execute format('revoke all on function %s from public,anon,authenticated',r.signature);execute format('grant execute on function %s to service_role',r.signature);end loop;end$$;
grant usage,select on sequence sim_murid_private.point_events_ordinal_seq to service_role;
commit;
