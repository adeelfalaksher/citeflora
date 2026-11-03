import {api} from '../lib/server';
import {authorizeApiRequest} from '../lib/worker-boundary';

type ApiEnv=Cloudflare.Env&{CITEFLORA_PROXY_SECRET?:string};

const worker={
  async fetch(request:Request,env:ApiEnv):Promise<Response>{
    const authorized=await authorizeApiRequest(request,env.CITEFLORA_PROXY_SECRET);
    if(authorized instanceof Response)return authorized;
    const response=await api(authorized);
    const headers=new Headers(response.headers);
    headers.set('X-Content-Type-Options','nosniff');
    headers.set('Referrer-Policy','no-referrer');
    headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    headers.set('Cache-Control','no-store');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  },
};

export default worker;
