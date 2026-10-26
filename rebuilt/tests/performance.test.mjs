import test from 'node:test';
import assert from 'node:assert/strict';
import {serverTimingValue,withServerTiming} from '../src/lib/observability/server-timing.ts';
import {summarize} from '../scripts/performance/statistics.mjs';
test('quantiles preserve missing values and real zero without mutating input',()=>{
 const values=[10,null,0,NaN,30,undefined,20,Infinity,-1];
 assert.deepEqual(summarize(values),{samples:4,missing:5,p75:20});
 assert.equal(values[0],10);
 assert.deepEqual(summarize([null,undefined]),{samples:0,missing:2,p75:null});
});
test('timing keeps zero and rejects invalid or implausible durations',()=>{
 assert.equal(serverTimingValue(10,10),'sim_app;dur=0.0');
 assert.equal(serverTimingValue(10,21.27),'sim_app;dur=11.3');
 for(const [a,b] of [[NaN,1],[1,Infinity],[2,1],[0,3600001]]) assert.equal(serverTimingValue(a,b),null);
});
test('header measurement preserves response identity, status, body and private caching',async()=>{
 const response=new Response('{"ok":true}',{status:201,headers:{'Cache-Control':'private, no-store','Set-Cookie':'session=synthetic; HttpOnly'}});
 assert.equal(withServerTiming(response,1,10),response);
 assert.equal(response.status,201);assert.equal(response.headers.get('Server-Timing'),'sim_app;dur=9.0');
 assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 assert.equal(response.headers.get('Set-Cookie'),'session=synthetic; HttpOnly');
 assert.equal(await response.text(),'{"ok":true}');
});
test('immutable response headers never break response delivery',()=>{
 const response=Response.redirect('https://example.invalid');
 assert.equal(withServerTiming(response,0,10),response);
});
