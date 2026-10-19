begin;
-- Required reference data is a migration, not optional production seed. No users/passwords/accounts.
insert into public.role_catalog(code,legacy_label) values
('admin','Admin'),
('teacher','Guru'),
('student','Siswa'),
('parent','Orangtua'),
('alumni','Alumni'),
('customer','Nasabah'),
('applicant','Calon Siswa Baru');
insert into public.assignment_catalog(code,legacy_label) values
('school_head','Kepala Madrasah/Sekolah'),
('committee_treasurer','Bendahara Komite'),
('savings_manager','Pengelola Tabungan'),
('duty_teacher','Guru Piket'),
('homeroom_teacher','Wali Kelas'),
('student_mentor','Guru Wali'),
('counselor','Guru BK');
insert into public.subjects(code,name,sort_order) values
('AQH','Al Quran Hadis',1),
('AKA','Akidah Akhlak',2),
('FIK','Fikih',3),
('SKI','SKI',4),
('BAR','Bahasa Arab',5),
('PPC','Pend. Pancasila',6),
('BIN','Bahasa Indonesia',7),
('MTK','Matematika',8),
('IPA','IPA',9),
('IPS','IPS',10),
('BIG','Bahasa Inggris',11),
('INF','Informatika',12),
('PJK','PJOK',13),
('SBD','Seni Budaya',14),
('BTQ','BTQ',15),
('KKA','KKA',16);
insert into public.business_policies(policy_type,version,approved_on,configuration,approval_source) values
('report','RAPOR-1.0',date '2026-10-19','{"weights": {"ph": 20, "ats": 30, "asas": 50}, "practice": "display-separately", "kkm_archive_decision": "D10_OPEN"}'::jsonb,'Explicit user choice, 2026-10-19 12:51 Asia/Jakarta'),
('withdrawal_fee','FEE-1.0',date '2026-10-19','{"rounding": "nearest-thousand-half-up", "balance_debit": "withdrawal-amount", "cash_received": "withdrawal-amount-minus-fee", "fee_applied_field_required": true}'::jsonb,'Explicit user choice, 2026-10-19 12:51 Asia/Jakarta'),
('survey_required','SURVEI-REQUIRED-1.0',date '2026-10-19','{"essay_requirements": "legacy-backend-required-list", "peer_essay_required": false, "shared_step_and_final_validation": true}'::jsonb,'Explicit user choice, 2026-10-19 12:51 Asia/Jakarta');
commit;
