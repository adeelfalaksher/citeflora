import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {build} from 'vite';
import path from 'node:path';

// Real API code and migration, with an in-memory SQLite adapter for D1's contract.
// Browser and hosted verification separately exercise the actual D1 binding.
let db,api,originalFetch;
class Statement {
  constructor(sql,args=[]){this.sql=sql;this.args=args;}
  bind(...args){return new Statement(this.sql,args);}
  first(){return db.prepare(this.sql).get(...this.args)||null;}
  run(){const r=db.prepare(this.sql).run(...this.args);return {success:true,results:[],meta:{changes:Number(r.changes)}};}
}
const adapter={prepare(sql){return new Statement(sql);},async batch(statements){db.exec('BEGIN');try{const results=statements.map(s=>{const statement=db.prepare(s.sql);if(/^\s*(SELECT|WITH)/i.test(s.sql))return {success:true,results:statement.all(...s.args),meta:{changes:0}};const result=statement.run(...s.args);return {success:true,results:[],meta:{changes:Number(result.changes)}};});db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}};
const origin='https://citeflora.test';
let clientSequence=0;
function req(route,{method='GET',cookie,body,from=origin,type='application/json',client='198.51.100.'+(++clientSequence)}={}){
  const headers={'cf-connecting-ip':client};if(cookie)headers.Cookie=cookie;if(method!=='GET'){if(from)headers.Origin=from;headers['Content-Type']=type;}
  return new Request(origin+'/api/'+route,{method,headers,...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
}
async function start(){const response=await api(req('session',{method:'POST',body:{}}));assert.equal(response.status,201);return {cookie:response.headers.get('set-cookie').split(';')[0],data:await response.json()};}
before(async()=>{
  db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');db.exec(readFileSync(new URL('../drizzle/0000_stormy_frog_thor.sql',import.meta.url),'utf8'));
  await build({configFile:false,logLevel:'error',build:{ssr:path.resolve('lib/server.ts'),outDir:'outputs/api-tests',emptyOutDir:true,rollupOptions:{external:['cloudflare:workers'],output:{format:'cjs',entryFileNames:'server.cjs'}}}});
  const container={exports:{}};new Function('require','module','exports',readFileSync('outputs/api-tests/server.cjs','utf8'))(name=>{if(name==='cloudflare:workers')return {env:{DB:adapter}};throw new Error('Unexpected import '+name);},container,container.exports);api=container.exports.api;
  originalFetch=globalThis.fetch;
});
after(()=>{globalThis.fetch=originalFetch;db.close();});

test('Create isolated server-side workspaces and keep cookies HttpOnly',async()=>{
  const a=await start(),b=await start();assert.notEqual(a.data.workspaceId,b.data.workspaceId);
  assert.notEqual(a.data.sources[0].id,b.data.sources[0].id);assert.equal(a.data.claims.length,75);
  const response=await api(req('session',{method:'POST',body:{},cookie:a.cookie}));assert.equal(response.status,200);
  assert.equal((await response.json()).workspaceId,a.data.workspaceId);
  const row=db.prepare('SELECT id FROM sessions LIMIT 1').get();assert.match(row.id,/^[a-f0-9]{64}$/);
  assert.notEqual(row.id,a.cookie.split('=')[1]);
});
test('Cookie flags include Secure, HttpOnly, SameSite, and a bounded lifetime',async()=>{
  const response=await api(req('session',{method:'POST',body:{}}));const cookie=response.headers.get('set-cookie');
  for(const flag of ['HttpOnly','SameSite=Lax','Secure','Max-Age=2592000'])assert.ok(cookie.includes(flag));
});
test('Missing and forged sessions cannot read a workspace',async()=>{
  assert.equal((await api(req('workspace'))).status,401);
  assert.equal((await api(req('workspace',{cookie:'citeflora_session='+'a'.repeat(64)}))).status,401);
});
test('Cross-origin and non-JSON writes are rejected',async()=>{
  assert.equal((await api(req('session',{method:'POST',body:{},from:'https://untrusted.test'}))).status,403);
  assert.equal((await api(req('session',{method:'POST',body:{},from:''}))).status,403);
  assert.equal((await api(req('session',{method:'POST',body:'{}',type:'text/plain'}))).status,415);
});
test('Review writes are tenant-scoped and persist a revision with an audit event',async()=>{
  const a=await start(),b=await start();const c=a.data.claims.find(c=>!c.flags.includes('genus-only'));
  const body={status:'accepted',revision:0,reviewerNote:'Checked the unchanged passage and recorded the uncertainty.'};
  assert.equal((await api(req('claims/'+c.id,{method:'PATCH',cookie:b.cookie,body}))).status,404);
  const response=await api(req('claims/'+c.id,{method:'PATCH',cookie:a.cookie,body}));assert.equal(response.status,200);
  const next=await response.json(),changed=next.claims.find(x=>x.id===c.id);
  assert.equal(changed.status,'accepted');assert.equal(changed.revision,1);assert.equal(next.audit.filter(x=>x.claimId===c.id).length,1);
  const conflict=await api(req('claims/'+c.id,{method:'PATCH',cookie:a.cookie,body}));assert.equal(conflict.status,409);
  const latest=await (await api(req('workspace',{cookie:a.cookie}))).json();assert.equal(latest.audit.filter(x=>x.claimId===c.id).length,1);
});
test('Source import preserves text and rejects duplicates and executable links',async()=>{
  const a=await start();const body={title:'Developer-owned test passage',text:'Mentha spicata leaves were used for cough.',rightsConfirmed:true,evidenceType:'traditional-report',licence:'Original content'};
  const response=await api(req('sources',{method:'POST',cookie:a.cookie,body}));assert.equal(response.status,201);
  const imported=await response.json();assert.equal(imported.count,1);assert.equal(imported.workspace.sources.find(s=>s.id===imported.sourceId).text,body.text);
  assert.equal((await api(req('sources',{method:'POST',cookie:a.cookie,body}))).status,409);
  assert.equal((await api(req('sources',{method:'POST',cookie:a.cookie,body:{...body,url:'javascript:alert(1)'}}))).status,400);
});
test('Evidence exports are scoped, attributed, and protected against HTML injection',async()=>{
  const a=await start();const body={title:'<script>unsafe title</script>',authors:'Developer Example',text:'Aloe vera leaves were used for burns.',rightsConfirmed:true,evidenceType:'traditional-report',licence:'Original content'};
  const added=await (await api(req('sources',{method:'POST',cookie:a.cookie,body}))).json();const claim=added.workspace.claims.find(c=>c.sourceId===added.sourceId);await api(req('claims/'+claim.id,{method:'PATCH',cookie:a.cookie,body:{status:'accepted',revision:0,reviewerNote:'QA checked the passage and recorded a field correction.',plantPart:'leaf blade',preparation:'Not stated in the passage'}}));
  const json=await api(req('export?format=json',{cookie:a.cookie}));assert.equal(json.status,200);assert.ok(json.headers.get('content-disposition').includes('attachment'));
  const data=await json.json();assert.equal(data.sources.length,3);assert.equal(data.claims.length,76);
  const csv=await (await api(req('export?format=csv',{cookie:a.cookie}))).text();assert.ok(csv.includes('source_hash'));assert.ok(csv.includes('reviewed_plant_part'));assert.ok(csv.includes('leaf blade'));assert.ok(csv.includes('Developer Example'));
  const html=await (await api(req('export?format=html',{cookie:a.cookie}))).text();assert.ok(html.includes('&lt;script&gt;unsafe title'));assert.ok(!html.includes('<script>unsafe title'));assert.ok(html.includes('Reviewed plant part: leaf blade'));assert.ok(html.includes('Not stated in the passage'));
});
test('Malformed and oversized bodies fail without a database write',async()=>{
  assert.equal((await api(req('session',{method:'POST',body:'{broken'}))).status,400);
  const a=await start();const response=await api(req('sources',{method:'POST',cookie:a.cookie,body:'x'.repeat(350001)}));assert.equal(response.status,413);
});
test('External request targets are fixed and service failures stay explicit',async()=>{
  const a=await start();let observed='';
  globalThis.fetch=async url=>{observed=String(url);return new Response('{"usageKey":2927175,"canonicalName":"Mentha spicata","rank":"SPECIES","kingdom":"Plantae","matchType":"EXACT","confidence":97}',{headers:{'Content-Type':'application/json'}});};
  const response=await api(req('taxonomy?name=Salvia%20fictitia',{cookie:a.cookie}));assert.equal(response.status,200);assert.ok(observed.startsWith('https://api.gbif.org/v1/species/match?'));
  globalThis.fetch=async()=>new Response('unavailable',{status:503});
  const fallback=await api(req('literature?q=plants',{cookie:a.cookie}));assert.equal(fallback.status,200);const limited=await fallback.json();assert.equal(limited.mode,'reference-snapshot');assert.equal(limited.results.length,1);assert.match(limited.scopeWarning,/dated catalogue/);
  assert.equal((await api(req('literature/import',{method:'POST',cookie:a.cookie,body:{pmcid:'https://untrusted.test/'}}))).status,400);
  globalThis.fetch=originalFetch;
});
test('Literature titles display source text without escaped markup',async()=>{
  const a=await start();globalThis.fetch=async()=>new Response(JSON.stringify({hitCount:1,resultList:{result:[{id:'1',title:'Uses of &lt;i&gt;Mentha&lt;/i&gt; &amp; Aloe',authorString:'A &amp; B',source:'MED'}]}}),{headers:{'Content-Type':'application/json'}});
  const data=await (await api(req('literature?q=Mentha',{cookie:a.cookie}))).json();assert.equal(data.mode,'live');assert.equal(data.results[0].title,'Uses of Mentha & Aloe');assert.equal(data.results[0].authors,'A & B');globalThis.fetch=originalFetch;
});
test('Dated taxonomy and licensed narrative snapshots work without outbound network',async()=>{
  const a=await start();globalThis.fetch=async()=>{throw new Error('Network unavailable');};
  const tax=await (await api(req('taxonomy?name=Mentha%20spicata',{cookie:a.cookie}))).json();assert.equal(tax.mode,'reference-snapshot');assert.equal(tax.kingdom,'Plantae');assert.ok(tax.usageKey);assert.ok(Date.parse(tax.retrievedAt));
  const response=await api(req('literature/import',{method:'POST',cookie:a.cookie,body:{pmcid:'PMC11124858'}}));assert.equal(response.status,200);const paper=await response.json();assert.equal(paper.mode,'reference-snapshot');assert.equal(paper.licence,'CC BY 4.0');assert.equal(paper.doi,'10.3390/plants13101379');assert.ok(paper.text.length>1000);assert.match(paper.locator,/reference snapshot/);assert.match(paper.xmlSha256,/^[a-f0-9]{64}$/);assert.match(paper.authors,/Jabeen Tahira/);assert.match(paper.authors,/Vitasović-Kosić Ivana/);
  globalThis.fetch=originalFetch;
});

test('Live JATS import reads author groups without contrib-type and excludes editors and references',async()=>{
  const a=await start();globalThis.fetch=async()=>new Response('<article><front><article-meta><article-title>Licensed parser QA</article-title><contrib-group content-type="editor"><contrib><name><surname>Editor</surname><given-names>E</given-names></name></contrib></contrib-group><contrib-group content-type="author"><contrib><name name-style="western"><surname>Author</surname><given-names initials="A">Alice</given-names></name></contrib><contrib><name><given-names>Bob</given-names><surname>Researcher</surname></name></contrib></contrib-group><permissions><license><ext-link href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</ext-link></license></permissions></article-meta></front><body><p>Mentha spicata leaves were used for cough.</p></body><back><ref><name><surname>Cited</surname><given-names>C</given-names></name></ref></back></article>',{headers:{'Content-Type':'application/xml'}});
  try{const response=await api(req('literature/import',{method:'POST',cookie:a.cookie,body:{pmcid:'PMC222'}}));assert.equal(response.status,200);assert.equal((await response.json()).authors,'Author Alice, Researcher Bob');}finally{globalThis.fetch=originalFetch;}
});
test('Session creation rate limits are enforced per client bucket',async()=>{
  for(let i=0;i<8;i++)assert.equal((await api(req('session',{method:'POST',body:{},client:'203.0.113.10'}))).status,201);
  assert.equal((await api(req('session',{method:'POST',body:{},client:'203.0.113.10'}))).status,429);
});

test('A note-only review preserves taxonomy provenance and a manual identity change clears it',async()=>{
  const a=await start();const claim=a.data.claims.find(c=>c.plantName==='Mentha spicata')||a.data.claims[0];
  const body={status:'accepted',revision:0,reviewerNote:'Checked the passage; this is a taxonomy suggestion only.',resolvedName:'Mentha spicata',identityBasis:'Dated GBIF name suggestion, not historical specimen identification.',taxonomyQuery:'Mentha spicata'};
  const firstResponse=await api(req('claims/'+claim.id,{method:'PATCH',cookie:a.cookie,body}));assert.equal(firstResponse.status,200);
  const first=(await firstResponse.json()).claims.find(c=>c.id===claim.id);assert.ok(first.review.taxonomy.usageKey);
  const second=await (await api(req('claims/'+claim.id,{method:'PATCH',cookie:a.cookie,body:{...body,revision:1,taxonomyQuery:'',reviewerNote:'Updated only this note after comparing the unchanged passage.'}}))).json();
  assert.deepEqual(second.claims.find(c=>c.id===claim.id).review.taxonomy,first.review.taxonomy);
  const event=second.audit.find(e=>e.claimId===claim.id&&JSON.parse(e.detail).revision===2);
  assert.deepEqual(JSON.parse(event.detail).review.taxonomy,first.review.taxonomy);
  const changed=await (await api(req('claims/'+claim.id,{method:'PATCH',cookie:a.cookie,body:{...body,revision:2,taxonomyQuery:'',resolvedName:'Mentha longifolia',identityBasis:'Manual contextual identification requiring further checking.'}}))).json();
  assert.equal(changed.claims.find(c=>c.id===claim.id).review.taxonomy,undefined);
});
test('Oversized passages fail with a useful input error and no source write',async()=>{
  const a=await start();const response=await api(req('sources',{method:'POST',cookie:a.cookie,body:{title:'Unpunctuated QA source',text:'Aloe vera was used for burns '+ 'and wounds '.repeat(650),rightsConfirmed:true,evidenceType:'traditional-report',licence:'Original content'}}));
  assert.equal(response.status,400);assert.match((await response.json()).error,/6,000/);
  const current=await (await api(req('workspace',{cookie:a.cookie}))).json();assert.equal(current.sources.length,2);
});
