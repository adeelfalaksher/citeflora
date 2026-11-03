import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorizeApiRequest} from '../lib/worker-boundary.ts';

const secret='test-proxy-secret-'.repeat(4);
const client='a'.repeat(64);
const request=(headers={},path='/api/session')=>new Request('https://citeflora-api.example.workers.dev'+path,{method:'POST',headers:{Origin:'https://citeflora-api.example.workers.dev','Content-Type':'application/json',...headers},body:'{}'});

test('Worker rejects missing and forged proxy authentication, including equal-length secrets',async()=>{
  for(const headers of [{},{'x-citeflora-proxy-secret':'invalid'},{'x-citeflora-proxy-secret':'b'.repeat(secret.length)}]){
    const response=await authorizeApiRequest(request(headers),secret);assert.ok(response instanceof Response);assert.equal(response.status,401);
    assert.ok(!(await response.text()).includes(secret));
  }
});

test('Worker refuses missing deployment credentials and malformed trusted client keys',async()=>{
  assert.equal((await authorizeApiRequest(request(),undefined)).status,503);
  for(const key of ['', 'forged', '203.0.113.1', 'a'.repeat(65)]){
    const response=await authorizeApiRequest(request({'x-citeflora-proxy-secret':secret,'x-citeflora-client-key':key}),secret);
    assert.equal(response.status,403);
  }
});

test('Only authenticated requests replace the egress IP and retain the actual API request',async()=>{
  const incoming=request({'x-citeflora-proxy-secret':secret,'x-citeflora-client-key':client,'cf-connecting-ip':'198.51.100.10',Cookie:'citeflora_session='+'b'.repeat(64)});
  const authorized=await authorizeApiRequest(incoming,secret);
  assert.ok(authorized instanceof Request);assert.equal(authorized.url,incoming.url);assert.equal(authorized.method,'POST');
  assert.equal(authorized.headers.get('cf-connecting-ip'),'proxy:'+client);
  assert.equal(authorized.headers.has('x-citeflora-proxy-secret'),false);assert.equal(authorized.headers.has('x-citeflora-client-key'),false);
  assert.equal(authorized.headers.get('cookie'),incoming.headers.get('cookie'));assert.equal(await authorized.text(),'{}');
  const other=await authorizeApiRequest(request({'x-citeflora-proxy-secret':secret,'x-citeflora-client-key':'c'.repeat(64)}),secret);
  assert.notEqual(other.headers.get('cf-connecting-ip'),authorized.headers.get('cf-connecting-ip'));
});

test('Authenticated non-API routes cannot reach the backend',async()=>{
  const response=await authorizeApiRequest(request({'x-citeflora-proxy-secret':secret,'x-citeflora-client-key':client},'/unlisted'),secret);
  assert.equal(response.status,404);
});
