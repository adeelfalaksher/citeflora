import {env} from 'cloudflare:workers';
import corpus from '../data/corpus.json';
import {extractClaims,ENGINE_VERSION,evidenceCSV,ExtractionInputError} from './engine.mjs';
import {InputError,field,validateSource,validateReview} from './validation.mjs';
import {taxonomyLookup,literatureSearch,openArticle} from './external';
import type {Source,Claim,Workspace} from './types';

const COOKIE='citeflora_session';
const NOW=()=>new Date().toISOString();
const id=()=>crypto.randomUUID();
const DB=()=>{if(!env.DB)throw new InputError('Workspace storage is not connected. Please try again later.',503);return env.DB;};
export async function sha256(text:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function json(data:unknown,status=200,headers:HeadersInit={}) {return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});}
function checkWrite(request:Request){
  const origin=request.headers.get('origin');
  if(!origin||origin!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')throw new InputError('This request must originate from your Citeflora workspace.',403);
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new InputError('Send a JSON request.',415);
}
async function body(request:Request):Promise<Record<string,unknown>>{
  const reader=request.body?.getReader();if(!reader)throw new InputError('Request data is required.');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const result=await reader.read();if(result.done)break;size+=result.value.length;if(size>350000){await reader.cancel();throw new InputError('The request is too large.',413);}chunks.push(result.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value as Record<string,unknown>;}catch{throw new InputError('The request must contain valid JSON.');}
}
async function limit(key:string,max:number,seconds:number){
  const stamp=Math.floor(Date.now()/1000);const bucket=Math.floor(stamp/seconds);
  const hashed=await sha256(key+':'+bucket);
  const row=await DB().prepare('INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(hashed,stamp+seconds).first<{count:number}>();
  if((row?.count||0)>max)throw new InputError('Too many requests. Please wait a few minutes and try again.',429);
}
async function session(request:Request){
  const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  return DB().prepare('SELECT s.workspace_id AS workspaceId,w.created_at AS createdAt FROM sessions s JOIN workspaces w ON w.id=s.workspace_id WHERE s.id=? AND s.expires_at>?').bind(await sha256(token),Math.floor(Date.now()/1000)).first<{workspaceId:string;createdAt:string}>();
}
async function requireSession(request:Request){const s=await session(request);if(!s)throw new InputError('Your workspace session has expired. Reload to start a new workspace.',401);return s;}
async function workspace(s:{workspaceId:string;createdAt:string}):Promise<Workspace>{
  const [ss,cs,aa]=await DB().batch([
    DB().prepare("SELECT id,payload,created_at FROM sources WHERE workspace_id=? ORDER BY created_at,json_extract(payload,'$.year'),id").bind(s.workspaceId),
    DB().prepare("SELECT id,source_id,payload,status,reviewer_note,revision,updated_at FROM claims WHERE workspace_id=? ORDER BY source_id,CAST(json_extract(payload,'$.start') AS INTEGER),json_extract(payload,'$.category'),id").bind(s.workspaceId),
    DB().prepare('SELECT id,action,claim_id,source_id,detail,created_at FROM audit WHERE workspace_id=? ORDER BY created_at DESC,id DESC LIMIT 200').bind(s.workspaceId),
  ]);
  return {workspaceId:s.workspaceId,createdAt:s.createdAt,engineVersion:ENGINE_VERSION,
    sources:(ss.results as {payload:string;id:string;created_at:string}[]).map(r=>({...JSON.parse(r.payload),id:r.id,createdAt:r.created_at})),
    claims:(cs.results as {payload:string;id:string;source_id:string;status:Claim['status'];reviewer_note:string;revision:number;updated_at:string}[]).map(r=>({...JSON.parse(r.payload),id:r.id,sourceId:r.source_id,status:r.status,reviewerNote:r.reviewer_note,revision:r.revision,updatedAt:r.updated_at})),
    audit:(aa.results as {id:string;action:string;claim_id:string;source_id:string;detail:string;created_at:string}[]).map(r=>({id:r.id,action:r.action,claimId:r.claim_id,sourceId:r.source_id,detail:r.detail,createdAt:r.created_at}))};
}
function sourceStatements(workspaceId:string,source:Source,createdAt:string){
  const result=extractClaims(source.text,source);source.truncated=result.truncated;
  const statements=[DB().prepare('INSERT INTO sources (id,workspace_id,title,doi,content_hash,payload,created_at) VALUES (?,?,?,?,?,?,?)').bind(source.id,workspaceId,source.title,source.doi,source.contentHash,JSON.stringify(source),createdAt)];
  for(const c of result.claims)statements.push(DB().prepare('INSERT INTO claims (id,workspace_id,source_id,payload,status,reviewer_note,revision,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(id(),workspaceId,source.id,JSON.stringify(c),'pending','',0,createdAt));
  return {statements,count:result.claims.length};
}
async function createSession(request:Request){
  const input=await body(request);
  if(!input||typeof input!=='object'||Array.isArray(input))throw new InputError('A JSON object is required.');
  const old=await session(request);if(old)return json(await workspace(old));
  await limit('session:'+ (request.headers.get('cf-connecting-ip')||'local'),8,3600);
  const workspaceId=id(),createdAt=NOW();const token=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const statements=[DB().prepare('INSERT INTO workspaces (id,created_at) VALUES (?,?)').bind(workspaceId,createdAt),
    DB().prepare('INSERT INTO sessions (id,workspace_id,expires_at) VALUES (?,?,?)').bind(await sha256(token),workspaceId,Math.floor(Date.now()/1000)+2592000)];
  for(const item of corpus){const source={...item,id:id()} as Source;statements.push(...sourceStatements(workspaceId,source,createdAt).statements);}
  statements.push(DB().prepare('INSERT INTO audit (id,workspace_id,action,detail,created_at) VALUES (?,?,?,?,?)').bind(id(),workspaceId,'workspace-created','Started with two attributed research sources. All extractions await review.',createdAt));
  await DB().batch(statements);
  // Expired limiter rows contain no raw IP addresses or source content.
  await DB().prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(Math.floor(Date.now()/1000)-3600).run();
  const secure=new URL(request.url).protocol==='https:'?'; Secure':'';
  return json(await workspace({workspaceId,createdAt}),201,{'Set-Cookie':`${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${secure}`});
}
async function addSource(request:Request){
  const s=await requireSession(request);await limit('write:'+s.workspaceId,30,60);
  const input=validateSource(await body(request));
  const counts=await DB().prepare('SELECT (SELECT COUNT(*) FROM sources WHERE workspace_id=?) AS sources,(SELECT COUNT(*) FROM claims WHERE workspace_id=?) AS claims').bind(s.workspaceId,s.workspaceId).first<{sources:number;claims:number}>();
  if((counts?.sources||0)>=20)throw new InputError('This workspace has reached its 20-source limit. Export your evidence before starting another workspace.');
  const contentHash=await sha256(input.text);
  const duplicate=await DB().prepare('SELECT id FROM sources WHERE workspace_id=? AND content_hash=?').bind(s.workspaceId,contentHash).first();
  if(duplicate)throw new InputError('This exact source text is already in your workspace.',409);
  const source={...input,id:id(),contentHash} as Source;const createdAt=NOW();
  const built=sourceStatements(s.workspaceId,source,createdAt);
  if((counts?.claims||0)+built.count>500)throw new InputError('The import would exceed this workspace’s 500-candidate limit. Import a shorter excerpt.');
  await DB().batch([...built.statements,DB().prepare('INSERT INTO audit (id,workspace_id,source_id,action,detail,created_at) VALUES (?,?,?,?,?,?)').bind(id(),s.workspaceId,source.id,'source-imported',JSON.stringify({title:source.title,candidates:built.count,hash:contentHash}),createdAt)]);
  return json({workspace:await workspace(s),sourceId:source.id,count:built.count},201);
}
async function reviewClaim(request:Request,claimId:string){
  const s=await requireSession(request);await limit('write:'+s.workspaceId,60,60);
  const row=await DB().prepare('SELECT payload,status,reviewer_note,revision,source_id FROM claims WHERE id=? AND workspace_id=?').bind(claimId,s.workspaceId).first<{payload:string;status:string;reviewer_note:string;revision:number;source_id:string}>();
  if(!row)throw new InputError('This claim was not found in your workspace.',404);
  const original=JSON.parse(row.payload) as Claim;
  const input=validateReview(await body(request),original);
  if(row.revision!==input.revision)throw new InputError('This claim changed in another tab. Refresh the workspace before saving.',409);
  let taxonomy=input.review.resolvedName===original.review?.resolvedName&&input.review.identityBasis===original.review?.identityBasis?original.review?.taxonomy:undefined;
  if(input.taxonomyQuery){
    taxonomy=await taxonomyLookup(input.taxonomyQuery);
    if(taxonomy.kingdom!=='Plantae'||!taxonomy.usageKey||taxonomy.matchType==='NONE')throw new InputError('GBIF did not return a plant identity for this query. Record the uncertainty manually.');
    const possible=[taxonomy.canonicalName,taxonomy.scientificName,taxonomy.acceptedScientificName];
    if(input.review.resolvedName&&!possible.includes(input.review.resolvedName))throw new InputError('The reviewed identity does not match the GBIF result. Refresh the suggestion or record a manual identity basis.');
  }
  const payload={...original,review:{...input.review,...(taxonomy?{taxonomy}:{})}};
  const now=NOW();const detail=JSON.stringify({from:row.status,to:input.status,revision:input.revision+1,note:input.reviewerNote,review:payload.review});
  // D1 executes this batch transactionally. The audit insert and update share the revision predicate.
  const result=await DB().batch([
    DB().prepare('INSERT INTO audit (id,workspace_id,claim_id,source_id,action,detail,created_at) SELECT ?,?,?,?,?,?,? FROM claims WHERE id=? AND workspace_id=? AND revision=?').bind(id(),s.workspaceId,claimId,row.source_id,'claim-reviewed',detail,now,claimId,s.workspaceId,input.revision),
    DB().prepare('UPDATE claims SET payload=?,status=?,reviewer_note=?,revision=revision+1,updated_at=? WHERE id=? AND workspace_id=? AND revision=?').bind(JSON.stringify(payload),input.status,input.reviewerNote,now,claimId,s.workspaceId,input.revision),
  ]);
  if(result[1].meta.changes!==1)throw new InputError('This claim changed in another tab. Refresh before saving.',409);
  return json(await workspace(s));
}
function htmlReport(data:Workspace){
  const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]!));
  const bySource=new Map(data.sources.map(s=>[s.id,s]));
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Citeflora evidence report</title><style>body{font:15px/1.6 system-ui;max-width:1000px;margin:40px auto;padding:0 24px;color:#161616}h1{font-size:32px}h2{font-size:20px}article{border-top:1px solid #ddd;padding:20px 0;break-inside:avoid}blockquote{margin:16px 0;padding:12px 18px;background:#f5f6f7}small{color:#555}code{word-break:break-all}table{border-collapse:collapse}td,th{padding:8px;text-align:left;border-bottom:1px solid #ddd}@media print{body{margin:0;max-width:none}}</style><h1>Citeflora evidence report</h1><p>Generated ${esc(NOW())}. ${data.sources.length} source snapshots, ${data.claims.length} candidate extractions. Engine: ${esc(ENGINE_VERSION)}.</p><p>This report records literature statements and extraction review decisions. Accepted means the extraction was checked, not that a treatment is effective or safe. Unreviewed, negative, and uncertain records retain their labels.</p><h2>Sources and permissions</h2>${data.sources.map((s,i)=>`<article><h3>${i+1}. ${esc(s.title)}</h3><p>${esc(s.authors)} (${esc(s.year||'year unspecified')}). DOI: ${esc(s.doi||'not provided')}. ${esc(s.licence)}.</p><p>${esc(s.region)}. ${esc(s.locator)}. ${esc(s.adaptation)}</p><p>${esc(s.attribution)}</p><small>SHA-256: <code>${esc(s.contentHash)}</code></small></article>`).join('')}<h2>Candidate extractions</h2>${data.claims.map(c=>`<article><h3>${esc(c.plantName)} · ${esc(c.review?.reportedUse||c.category)}</h3><p>Review: ${esc(c.status)} · Polarity: ${esc(c.polarity)} · Evidence type: ${esc(c.evidenceType)} · Revision: ${c.revision}</p><p>Source: ${esc(bySource.get(c.sourceId)?.title)}. Identity candidates: ${esc(c.candidates.join('; ')||'unresolved')}. Reviewed identity: ${esc(c.review?.resolvedName||'not set')}.</p><p>Flags: ${esc(c.flags.join(', ')||'none')}. Plant part: ${esc(c.plantPart||'not stated')}. Preparation: ${esc(c.preparation||'not stated')}.</p><p>Reviewed plant part: ${esc(c.review?.plantPart||'not set')}. Reviewed preparation: ${esc(c.review?.preparation||'not set')}.</p><blockquote>${esc(c.quote)}</blockquote><small>Snapshot span [${c.start}, ${c.end}), UTF-16. Source hash ${esc(bySource.get(c.sourceId)?.contentHash)}.</small><p>Reviewer note: ${esc(c.reviewerNote||'none')}. Identity basis: ${esc(c.review?.identityBasis||'not recorded')}.</p></article>`).join('')}<h2>Audit trail</h2><p>The most recent ${data.audit.length} events are included. Export JSON preserves the structured records.</p>${data.audit.map(a=>`<p><small>${esc(a.createdAt)}</small> ${esc(a.action)} ${esc(a.detail)}</p>`).join('')}</html>`;
}
export async function api(request:Request){
  try {
    const url=new URL(request.url),path=url.pathname.replace(/^\/api\//,'');
    if(request.method!=='GET')checkWrite(request);
    if(request.method==='POST'&&path==='session')return await createSession(request);
    if(request.method==='GET'&&path==='workspace')return json(await workspace(await requireSession(request)));
    if(request.method==='POST'&&path==='sources')return await addSource(request);
    if(request.method==='PATCH'&&/^claims\/[a-f0-9-]{36}$/.test(path))return await reviewClaim(request,path.split('/')[1]);
    if(request.method==='GET'&&path==='taxonomy'){
      const s=await requireSession(request);await limit('external:'+s.workspaceId,30,60);
      const name=field(url.searchParams.get('name'),'Plant name',160,{required:true});return json(await taxonomyLookup(name));
    }
    if(request.method==='GET'&&path==='literature'){
      const s=await requireSession(request);await limit('external:'+s.workspaceId,30,60);
      const query=field(url.searchParams.get('q'),'Search',200,{required:true});return json(await literatureSearch(query));
    }
    if(request.method==='POST'&&path==='literature/import'){
      const s=await requireSession(request);await limit('external:'+s.workspaceId,10,60);
      const input=await body(request);return json(await openArticle(field(input.pmcid,'PMC identifier',20,{required:true})));
    }
    if(request.method==='GET'&&path==='export'){
      const data=await workspace(await requireSession(request)),format=url.searchParams.get('format')||'json';
      const content=format==='csv'?evidenceCSV(data.sources,data.claims):format==='html'?htmlReport(data):JSON.stringify({...data,exportedAt:NOW(),interpretation:'Literature extraction records for research. Review acceptance is not clinical validation.'},null,2);
      const ext=format==='csv'?'csv':format==='html'?'html':'json';
      return new Response(content,{headers:{'Content-Type':ext==='csv'?'text/csv; charset=utf-8':ext==='html'?'text/html; charset=utf-8':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="citeflora-evidence.${ext}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'"}});
    }
    return json({error:'This endpoint was not found.'},404);
  }catch(error){
    if(error instanceof InputError)return json({error:error.message},error.status);
    if(error instanceof ExtractionInputError)return json({error:error.message},400);
    if(error instanceof Error&&['TimeoutError','AbortError'].includes(error.name))return json({error:'The external research service timed out. Please try again.'},504);
    console.error('Citeflora request failed',error instanceof Error?error.name+': '+error.message.slice(0,200):'UnknownError');
    return json({error:'The request could not be completed. Please try again.'},500);
  }
}
