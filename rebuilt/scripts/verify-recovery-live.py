"""Approved temporary fixtures only. Credentials and cookies stay outside the repository.
Usage: python scripts/verify-recovery-live.py /absolute/private-fixtures.json
Cloud activation and cleanup are separate operator-controlled operations.
"""
import base64,http.cookiejar,json,sys,urllib.request,urllib.error
from pathlib import Path
APP='https://sim-muridv2.vercel.app';DB='https://qpzoukkhdxpmbtkcqemj.supabase.co'
config=json.loads(Path(sys.argv[1]).read_text());checks=[]
report=Path(__file__).resolve().parents[1]/'docs/verification/stage-09-live.json'
def persist(status):report.write_text(json.dumps({'status':status,'checks':checks,'limitations':['HTTP/Auth/PostgREST integration; no visual browser/hydration validation.']},indent=2)+'\n')
def check(condition,label):
 if not condition:persist('failed');raise AssertionError(label)
 checks.append(label);persist('running');print('PASS '+label,flush=True)
def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def request(opener,path,data=None,token=None,origin=True):
 headers={'Accept':'application/json','User-Agent':'SiM-Murid-approved-validation/9'}
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
def public_request(c,f,kind,method='manual'):
 return request(c,'/api/auth/recovery',{'username':f['username'],'requestType':kind,'method':method,**({'question':'q1','answer':'Deliberately wrong validation answer'} if method=='question' else {})})
def queue(c):
 status,body,_=request(c,'/api/account/recovery');check(status==200,'Admin queue readable');return body['requests']
def find(c,kind):return next(x for x in queue(c) if x['username']==config['student']['username'] and x['request_type']==kind)
def resolve(c,rid,action='approve',password=None):
 return request(c,'/api/account/recovery',{'requestId':rid,'action':action,'currentPassword':password or config['admin']['oldPassword'],'identityConfirmed':True,'evidenceReference':'BA-STAGE9-VALIDATION-001'})
try:
 anon=client();s,_,_=request(anon,'/api/account/recovery');check(s==401,'Anonymous cannot read recovery queue')
 s,_,_=request(anon,'/api/account/profile');check(s==401,'Anonymous cannot read personal profile')
 s,_,_=request(anon,'/api/auth/recovery',{'username':'test'},origin=False);check(s==403,'Cross-origin recovery request denied')
 a=client();st=client();af=config['admin'];sf=config['student'];login(a,af,af['oldPassword'],'Admin login');login(st,sf,sf['oldPassword'],'Siswa login')
 s,_,_=request(st,'/api/account/recovery');check(s==403,'Siswa cannot manage recovery queue')
 s,_,_=request(st,'/rest/v1/rpc/app_recovery_request',{'p_user':af['id'],'p_type':'password','p_answer_verified':True},token=token(st));check(s in (401,403),'Authenticated cannot invoke privileged recovery RPC directly')
 s,b,_=public_request(anon,sf,'password','question');s2,b2,_=request(anon,'/api/auth/recovery',{'username':'nonexistent-stage9-fixture','requestType':'password','method':'question','question':'q1','answer':'Wrong answer'});check(s==s2==202 and b==b2,'Wrong answer and unknown username have identical public response')
 check(not any(x['username']==sf['username'] for x in queue(a)),'Wrong security answer creates no request')
 s,_,_=public_request(anon,sf,'session');check(s==202,'Manual session recovery request accepted generically')
 current=find(a,'session');s,_,_=request(st,'/api/auth/session');check(s==200,'Public request alone does not revoke victim session')
 public_request(anon,sf,'session');check(find(a,'session')['id']==current['id'],'Duplicate active recovery request deduplicated')
 s,_,_=resolve(a,current['id'],password='Deliberately!Wrong92');check(s==400,'Recovery requires correct current Admin password')
 s,_,_=request(st,'/api/auth/session');check(s==200,'Wrong Admin password leaves target session unchanged')
 s,b,_=resolve(a,current['id']);check(s==200 and 'temporaryPassword' not in b,'Approved session recovery does not change password')
 s,_,_=request(st,'/api/auth/session');check(s==401,'Approved session recovery revokes old application session')
 st=client();login(st,sf,sf['oldPassword'],'Session recovery permits login with unchanged password')
 s,_,_=public_request(anon,sf,'password');check(s==202,'Manual password recovery request accepted generically');pending=find(a,'password')
 s,b,h=resolve(a,pending['id']);check(s==200 and isinstance(b.get('temporaryPassword'),str) and len(b['temporaryPassword'])>=32 and 'no-store' in h.get('Cache-Control',''),'Admin receives unique temporary password with no-store response')
 temporary=b['temporaryPassword'];check(temporary not in json.dumps(queue(a)),'Queue never exposes temporary password')
 s,_,_=request(st,'/api/auth/session');check(s==401,'Password recovery revokes previous target session')
 s,_,_=request(client(),'/api/auth/login',{'username':sf['username'],'password':sf['oldPassword'],'remember':False});check(s==401,'Old password rejected after Admin recovery')
 st=client();login(st,sf,temporary,'Recovered temporary password authenticates');gate(st,'password','Recovered account must change temporary password')
 s,_,_=resolve(a,pending['id']);check(s==409,'Completed password recovery cannot replay')
 s,b,_=request(a,'/api/account/profile');check(s==200,'Ready Admin can read own basic profile');profile=b['profile'];edited={**profile,'phone':'081200000009','contact_email':'stage9-fixture@example.org','bio':'Temporary validation bio'}
 s,b,_=request(a,'/api/account/profile',edited);check(s==200 and b['profile']['contact_email']==edited['contact_email'],'Own profile update stores validated contact fields')
 s,_,_=request(a,'/api/account/profile',edited);check(s==409,'Stale profile version cannot overwrite saved changes')
 s,_,_=request(a,'/api/account/profile',{**b.get('profile',profile),'role':'admin'});check(s==400,'Profile privilege injection rejected')
 s,_,_=request(st,'/api/account/profile',{**profile,'phone':'bad'});check(s==403,'Foreign username profile update denied')
 s,_,_=request(st,'/api/account/profile');check(s==403,'Mandatory password gate blocks basic profile shortcut')
 s,b,_=request(a,'/account/recovery');check(s==200 and 'Pemulihan akun' in b,'Admin recovery server page renders')
 s,b,_=request(a,'/account/profile');check(s==200 and 'Profil pribadi' in b,'Own profile server page renders')
 s,_,_=public_request(anon,sf,'session');check(s==202,'Further manual request can be reviewed');pending=find(a,'session');s,_,_=resolve(a,pending['id'],'reject');check(s==200,'Admin can reject recovery request')
 s,_,_=request(st,'/api/auth/session');check(s==200,'Rejected request does not revoke target current session')
 request(a,'/api/auth/logout',{});request(st,'/api/auth/logout',{});persist('passed')
except Exception:
 persist('failed');raise
