import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApiProxy} from '../lib/api-proxy.ts';

const origin='https://citeflora.vercel.app';
const secret='test-proxy-secret-'.repeat(4);
const token='a'.repeat(64);
const config={apiUrl:'https://citeflora-api.example.workers.dev',secret,vercel:true};
function request(path='session',{method='POST',from=origin,site='same-origin',type='application/json',body='{}',headers={}}={}){
  return new Request(origin+'/api/'+path,{method,headers:{...(from?{Origin:from}:{}),'Sec-Fetch-Site':site,'Content-Type':type,'x-vercel-forwarded-for':'203.0.113.20',...headers},...(method==='GET'?{}:{body})});
}

test('Proxy rejects cross-origin, cross-site, non-JSON, and unknown routes before forwarding',async()=>{
  let calls=0;const proxy=createApiProxy(config,async()=>{calls++;return new Response('{}');});
  assert.equal((await proxy(request('session',{from:'https://untrusted.test'}))).status,403);
  assert.equal((await proxy(request('session',{from:''}))).status,403);
  assert.equal((await proxy(request('session',{site:'cross-site'}))).status,403);
  assert.equal((await proxy(request('session',{type:'text/plain'}))).status,415);
  assert.equal((await proxy(request('session',{type:'application/jsonp'}))).status,415);
  assert.equal((await proxy(request('../unlisted'))).status,404);
  assert.equal(calls,0);
});

test('Proxy enforces the body byte limit before a network call',async()=>{
  let calls=0;const proxy=createApiProxy(config,async()=>{calls++;return new Response('{}');});
  assert.equal((await proxy(request('session',{body:'x'.repeat(350001)}))).status,413);
  assert.equal((await proxy(request('session',{body:'é'.repeat(175001)}))).status,413);
  assert.equal(calls,0);
});

test('Proxy forwards the session, trusted identity and fixed route without unrelated credentials',async()=>{
  let received;const proxy=createApiProxy(config,async(url,options)=>{
    received={url,options};
    return new Response('{"connected":true}',{status:201,headers:{'Content-Type':'application/json','Set-Cookie':`citeflora_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000; Secure`}});
  });
  const response=await proxy(request('session',{headers:{Cookie:`unrelated=private; citeflora_session=${token}; __cf_bm=bot`,Authorization:'Bearer unrelated','x-citeflora-proxy-secret':'forged','x-citeflora-client-key':'forged','X-Forwarded-For':'192.0.2.99'}}));
  assert.equal(response.status,201);assert.equal(await response.text(),'{"connected":true}');
  assert.equal(String(received.url),'https://citeflora-api.example.workers.dev/api/session');
  assert.equal(received.options.headers.get('cookie'),`citeflora_session=${token}`);
  assert.equal(received.options.headers.get('origin'),'https://citeflora-api.example.workers.dev');
  assert.equal(received.options.headers.get('x-citeflora-proxy-secret'),secret);
  assert.match(received.options.headers.get('x-citeflora-client-key'),/^[a-f0-9]{64}$/);
  assert.equal(received.options.headers.has('authorization'),false);
  assert.equal(received.options.headers.has('x-forwarded-for'),false);
  assert.equal(received.options.redirect,'error');assert.equal(received.options.cache,'no-store');
  assert.ok(received.options.signal instanceof AbortSignal);
  const cookie=response.headers.get('set-cookie');
  for(const flag of ['HttpOnly','Secure','SameSite=Lax','Path=/','Max-Age=2592000'])assert.ok(cookie.includes(flag));
  assert.equal(response.headers.get('cache-control'),'no-store');
});

test('Canonical Vercel identity separates clients and ignores forged ordinary forwarding headers',async()=>{
  const keys=[];const proxy=createApiProxy(config,async(_,options)=>{keys.push(options.headers.get('x-citeflora-client-key'));return new Response('{}');});
  await proxy(request('session',{headers:{'X-Forwarded-For':'192.0.2.1'}}));
  await proxy(request('session',{headers:{'X-Forwarded-For':'192.0.2.2'}}));
  await proxy(request('session',{headers:{'x-vercel-forwarded-for':'203.0.113.21'}}));
  assert.equal(keys[0],keys[1]);assert.notEqual(keys[0],keys[2]);
  assert.equal((await proxy(request('session',{headers:{'x-vercel-forwarded-for':''}}))).status,503);
  assert.equal((await proxy(request('session',{headers:{'x-vercel-forwarded-for':'203.0.113.20, 192.0.2.1'}}))).status,503);
});

test('Export bytes, attachment, CSP and errors survive while unrelated cookies are dropped',async()=>{
  const csv='plant,reported_use\r\nMentha spicata,cough\r\n';
  const proxy=createApiProxy(config,async()=>new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="citeflora-evidence.csv"','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'",'Set-Cookie':'__cf_bm=private; Secure; HttpOnly','Cache-Control':'public, max-age=600'}}));
  const response=await proxy(request('export?format=csv',{method:'GET',headers:{Cookie:`citeflora_session=${token}`}}));
  assert.equal(await response.text(),csv);assert.match(response.headers.get('content-disposition'),/attachment/);
  assert.equal(response.headers.get('content-security-policy'),"default-src 'none'; style-src 'unsafe-inline'");
  assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.has('set-cookie'),false);
  const errorProxy=createApiProxy(config,async()=>new Response('{"error":"stale revision"}',{status:409,headers:{'Content-Type':'application/json'}}));
  const error=await errorProxy(request('claims/11111111-1111-1111-1111-111111111111',{method:'PATCH'}));
  assert.equal(error.status,409);assert.deepEqual(await error.json(),{error:'stale revision'});
});

test('Misconfigured targets, upstream redirects and timeouts fail without exposing configuration',async()=>{
  let calls=0;
  for(const apiUrl of ['http://citeflora-api.example.workers.dev','https://untrusted.test','https://user:password@citeflora-api.example.workers.dev','https://citeflora-api.example.workers.dev/other']){
    const response=await createApiProxy({...config,apiUrl},async()=>{calls++;return new Response('{}');})(request());
    assert.equal(response.status,503);assert.ok(!(await response.text()).includes(apiUrl));
  }
  assert.equal(calls,0);
  const redirect=await createApiProxy(config,async()=>new Response(null,{status:302,headers:{Location:'https://untrusted.test'}}))(request());
  assert.equal(redirect.status,502);assert.equal(redirect.headers.has('location'),false);
  const timeout=await createApiProxy(config,async()=>{throw new DOMException(secret,'TimeoutError');})(request());
  assert.equal(timeout.status,504);assert.ok(!(await timeout.text()).includes(secret));
});
