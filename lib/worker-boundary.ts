const PROXY_HEADER='x-citeflora-proxy-secret';
const CLIENT_HEADER='x-citeflora-client-key';

function error(message:string,status:number){
  return Response.json({error:message},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}

async function secretMatches(actual:string,expected:string){
  const encoder=new TextEncoder();
  const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(actual)),crypto.subtle.digest('SHA-256',encoder.encode(expected))]);
  const aa=new Uint8Array(a),bb=new Uint8Array(b);let difference=0;
  for(let i=0;i<aa.length;i++)difference|=aa[i]^bb[i];
  return difference===0;
}

export async function authorizeApiRequest(request:Request,secret:string|undefined):Promise<Request|Response>{
  if(!secret||!/^[A-Za-z0-9_-]{32,256}$/.test(secret))return error('Workspace storage is not connected. Please try again later.',503);
  const supplied=request.headers.get(PROXY_HEADER)||'';
  if(supplied.length>256||!await secretMatches(supplied,secret))return error('This API requires an authenticated workspace connection.',401);
  if(!new URL(request.url).pathname.startsWith('/api/'))return error('This endpoint was not found.',404);
  const key=request.headers.get(CLIENT_HEADER)||'';
  if(!/^[a-f0-9]{64}$/.test(key))return error('The workspace connection could not be verified.',403);
  const headers=new Headers(request.headers);
  // Only the authenticated BFF can supply a client bucket, so Vercel egress IPs
  // never cause unrelated visitors to share the new-workspace rate limit.
  headers.set('cf-connecting-ip','proxy:'+key);
  headers.delete(PROXY_HEADER);headers.delete(CLIENT_HEADER);
  return new Request(request,{headers});
}
