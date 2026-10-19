"""Approved temporary fixtures only. Credentials and cookies stay outside the repository.
Usage: python scripts/verify-security-live.py /absolute/private-fixtures.json
Cloud activation and cleanup are separate operator-controlled operations.
"""
import base64,http.cookiejar,json,sys,urllib.request,urllib.error
from pathlib import Path
APP='https://sim-muridv2.vercel.app';DB='https://qpzoukkhdxpmbtkcqemj.supabase.co'
config=json.loads(Path(sys.argv[1]).read_text());checks=[]
report=Path(__file__).resolve().parents[1]/'docs/verification/stage-08-live.json'
def persist(status):report.write_text(json.dumps({'status':status,'checks':checks,'limitations':['HTTP/Auth/PostgREST integration; no visual browser/hydration validation.']},indent=2)+'\n')
def check(condition,label):
 if not condition:persist('failed');raise AssertionError(label)
 checks.append(label);persist('running');print('PASS '+label,flush=True)
def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def request(opener,path,data=None,token=None,origin=True):
 headers={'Accept':'application/json','User-Agent':'SiM-Murid-approved-validation/8'}
 if data is not None:headers['Content-Type']='application/json'
 if origin:headers['Origin']=APP
 if token is not None:headers.update({'apikey':config['publishableKey'],'Authorization':'Bearer '+token})
 url=DB+path if token is not None else APP+path
 req=urllib.request.Request(url,data=None if data is None else json.dumps(data).encode(),headers=headers)
 try:r=opener.open(req,timeout=60)
 except urllib.error.HTTPError as e:r=e
 raw=r.read().decode();
 try:body=json.loads(raw)
 except json.JSONDecodeError:body=raw
 return r.status,body,r.headers

def token(opener):
 jar=next(h.cookiejar for h in opener.handlers if isinstance(h,urllib.request.HTTPCookieProcessor))
 chunks=sorted((c.name,c.value) for c in jar if c.name.startswith('sb-') and 'auth-token' in c.name)
 raw=''.join(v for _,v in chunks)
 if raw.startswith('base64-'):raw=base64.urlsafe_b64decode(raw[7:]+'='*(-len(raw[7:])%4)).decode()
 return json.loads(raw)['access_token']
def login(c,f,pw,label):
 status,body,_=request(c,'/api/auth/login',{'username':f['username'],'password':pw,'remember':False});check(status==200,label)
def gate(c,expected,label):
 s,b,h=request(c,'/api/auth/security');check(s==200 and b.get('gate')==expected,label);check('answer' not in b and 'hash' not in b and 'no-store' in h.get('Cache-Control',''),label+' safe response');return b
def change(c,f):return request(c,'/api/auth/security',{'action':'password','currentPassword':f['oldPassword'],'newPassword':f['newPassword'],'confirmPassword':f['newPassword']})
try:
 if '--resume-ready' in sys.argv:
  checks=json.loads(report.read_text())['checks'];a=client();f=config['admin'];login(a,f,f['newPassword'],'Admin resumes completed onboarding');gate(a,'ready','Ready state persists after re-login')
 else:
  anonymous=client();s,_,_=request(anonymous,'/api/auth/security');check(s==401,'Anonymous security state denied')
  s,_,_=request(anonymous,'/api/auth/security',{'action':'question'},origin=False);check(s==403,'Cross-origin mutation denied')
  a=client();f=config['admin'];login(a,f,f['oldPassword'],'Admin fixture login');gate(a,'password','Temporary password gate')
  oldtoken=token(a);s,b,_=request(a,'/rest/v1/profiles?select=id',token=oldtoken);check(s==200 and b==[],'Pending password blocks direct RLS reads')
  s,_,_=request(a,'/api/auth/sessions');check(s==403,'Pending password blocks session management')
  s,b,_=request(a,'/api/auth/security',{'action':'password','currentPassword':'Wrong!Pass92','newPassword':f['newPassword'],'confirmPassword':f['newPassword']});check(s==400,'Wrong current password rejected')
  s,b,_=change(a,f);check(s==200 and b.get('signed_out') is True,'Password changed with explicit reauthentication')
  s,_,_=request(a,'/api/auth/security');check(s==401,'Old browser session invalid after password change')
  s,b,_=request(a,'/rest/v1/profiles?select=id',token=oldtoken);check((s==200 and b==[]) or s==401,'Old signed JWT cannot read after password change')
  s,_,_=request(client(),'/api/auth/login',{'username':f['username'],'password':f['oldPassword'],'remember':False});check(s==401,'Old password no longer authenticates')
  a=client();login(a,f,f['newPassword'],'New password authenticates');gate(a,'security_question','Question setup follows password')
  s,b,_=request(a,'/account/security');check(s==200 and 'Keamanan akun' in b and 'Simpan pertanyaan keamanan' in b,'Security server page renders forms')
  s,_,_=request(a,'/api/auth/security',{'action':'question','currentPassword':'Wrong!Pass92','question':'q1','answer':f['answer']});check(s==400,'Question setup requires current password')
  s,b,_=request(a,'/api/auth/security',{'action':'question','currentPassword':f['newPassword'],'question':'q1','answer':f['answer']});check(s==200 and b.get('state',{}).get('gate')=='ready','Question saved and Admin onboarding ready');check(f['answer'] not in json.dumps(b) and 'scrypt' not in json.dumps(b),'Question response contains no answer or hash')
  gate(a,'ready','Canonical ready state')
  s,b,_=request(a,'/api/auth/access');check(s==200 and b.get('role')=='admin','Ready Admin access context works')
  s,b,_=request(a,'/rest/v1/profiles?select=id',token=token(a));check(s==200 and len(b)>=2,'Ready Admin direct RLS read works')
  s,_,_=request(a,'/api/auth/sessions');check(s==200,'Ready Admin session management works')
 s,_,_=request(a,'/rest/v1/rpc/app_password_finish',{'p_user':f['id'],'p_operation':'00000000-0000-4000-8000-000000000001'},token=token(a));check(s in (401,403),'Authenticated cannot invoke password finalizer directly')
 st=client();f=config['student'];login(st,f,f['oldPassword'],'Siswa fixture login');gate(st,'password','Siswa temporary password gate')
 s,b,_=change(st,f);check(s==200 and b.get('signed_out') is True,'Siswa changes password without contact email')
 st=client();login(st,f,f['newPassword'],'Siswa new password authenticates');state=gate(st,'profile_pending','Siswa full profile required before question');check(state.get('can_set_question') is False,'Siswa cannot skip profile order')
 s,_,_=request(st,'/api/auth/security',{'action':'question','currentPassword':f['newPassword'],'question':'q1','answer':f['answer']});check(s==403,'Siswa question setup bypass denied')
 s,b,_=request(st,'/rest/v1/profiles?select=id',token=token(st));check(s==200 and b==[],'Siswa profile pending blocks direct RLS reads')
 s,_,_=request(st,'/api/auth/access');check(s==403,'Siswa profile pending blocks domain context')
 for i in range(2):
  s,_,_=request(a,'/api/auth/security',{'action':'question','currentPassword':'Wrong!Pass92','question':'q1','answer':'Unused validation'});check(s==(400 if i==0 else 429),'Persistent security attempt limit '+str(i+5))
 request(a,'/api/auth/logout',{});request(st,'/api/auth/logout',{})
 persist('passed')
except Exception:
 persist('failed');raise
