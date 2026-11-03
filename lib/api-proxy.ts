import {isIP} from 'node:net';

const COOKIE='citeflora_session';
const MAX_BODY=350000;
const MAX_AGE=2592000;
const PROXY_HEADER='x-citeflora-proxy-secret';
const CLIENT_HEADER='x-citeflora-client-key';

type ProxyConfig={apiUrl?:string;secret?:string;vercel?:boolean};
type Fetcher=(input:string|URL|Request,init?:RequestInit)=>Promise<Response>;

function error(message:string,status:number){
  return Response.json({error:message},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}

function backend(config:ProxyConfig){
  if(!config.apiUrl||!config.secret||!/^[A-Za-z0-9_-]{32,256}$/.test(config.secret))return null;
  try{
    const url=new URL(config.apiUrl);
    if(url.protocol!=='https:'||!url.hostname.endsWith('.workers.dev')||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash)return null;
    return url;
  }catch{return null;}
}

function allowed(method:string,path:string){
  if(method==='GET')return ['/api/workspace','/api/taxonomy','/api/literature','/api/export'].includes(path);
  if(method==='POST')return ['/api/session','/api/sources','/api/literature/import'].includes(path);
  return method==='PATCH'&&/^\/api\/claims\/[a-f0-9-]{36}$/.test(path);
}

async function readBody(request:Request){
  const length=request.headers.get('content-length');
  if(length&&/^\d+$/.test(length)&&Number(length)>MAX_BODY)return null;
  const reader=request.body?.getReader();
  if(!reader)return new ArrayBuffer(0);
  const chunks:Uint8Array[]=[];let size=0;
  while(true){
    const next=await reader.read();if(next.done)break;
    size+=next.value.byteLength;
    if(size>MAX_BODY){await reader.cancel();return null;}
    chunks.push(next.value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return bytes.buffer;
}

function sessionCookie(value:string|null){
  const cookies=value?.split(';').map(c=>c.trim()).filter(c=>new RegExp('^'+COOKIE+'=[a-f0-9]{64}$').test(c))||[];
  return cookies.length===1?cookies[0]:'';
}

function responseHeaders(response:Response){
  const headers=new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=()'});
  for(const name of ['Content-Type','Content-Disposition','Content-Security-Policy','Retry-After']){
    const value=response.headers.get(name);if(value)headers.set(name,value);
  }
  for(const value of response.headers.getSetCookie()){
    const token=value.match(/^citeflora_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    if(!token||/;\s*domain\s*=/i.test(value))continue;
    const age=value.match(/;\s*max-age=(\d+)(?:;|$)/i)?.[1];
    if(!age)continue;
    headers.set('Set-Cookie',`${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.min(Number(age),MAX_AGE)}; Secure`);
    break;
  }
  return headers;
}

export function createApiProxy(config:ProxyConfig,fetcher:Fetcher=fetch){
  return async function proxy(request:Request):Promise<Response>{
    const url=new URL(request.url);
    if(!allowed(request.method,url.pathname))return error('This endpoint was not found.',404);
    if(request.method!=='GET'){
      if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return error('This request must originate from your Citeflora workspace.',403);
      if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return error('Send a JSON request.',415);
    }
    const target=backend(config);
    if(!target)return error('Workspace storage is not connected. Please try again later.',503);
    // Vercel overwrites this platform header. Ordinary forwarded headers are never trusted.
    // https://vercel.com/docs/headers/request-headers
    const client=config.vercel?request.headers.get('x-vercel-forwarded-for')?.trim():'127.0.0.1';
    if(!client||!isIP(client))return error('The workspace connection could not be verified. Please try again.',503);
    try{
      const body=request.method==='GET'?undefined:await readBody(request);
      if(body===null)return error('The request is too large.',413);
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(config.secret+'\0'+client));
      const key=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
      const headers=new Headers({Accept:'application/json',[PROXY_HEADER]:config.secret!,[CLIENT_HEADER]:key});
      if(request.method!=='GET'){
        headers.set('Origin',target.origin);headers.set('Content-Type','application/json');headers.set('Sec-Fetch-Site','same-origin');
      }
      const cookie=sessionCookie(request.headers.get('cookie'));if(cookie)headers.set('Cookie',cookie);
      target.pathname=url.pathname;target.search=url.search;
      const upstream=await fetcher(target,{method:request.method,headers,body,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)});
      if(upstream.status>=300&&upstream.status<400)return error('The research service returned an unexpected response. Please try again.',502);
      return new Response(upstream.body,{status:upstream.status,headers:responseHeaders(upstream)});
    }catch(cause){
      if(cause instanceof Error&&['TimeoutError','AbortError'].includes(cause.name))return error('The research service timed out. Please try again.',504);
      return error('The research service could not be reached. Please try again.',502);
    }
  };
}

export async function apiProxy(request:Request){
  return createApiProxy({apiUrl:process.env.CITEFLORA_API_URL,secret:process.env.CITEFLORA_PROXY_SECRET,vercel:process.env.VERCEL==='1'})(request);
}
