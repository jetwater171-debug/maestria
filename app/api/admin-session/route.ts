import {AdminLoginLimiter,adminClientIp,adminSessionCookie,checkAdminPassword,createAdminSession,hasAdminSession,sameAdminOrigin} from '@/lib/saas-admin-auth';
import {AdminRequestError,readAdminBody} from '@/lib/saas-admin-request';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const limiter=new AdminLoginLimiter();
const json=(data:unknown,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',...headers}});

export async function GET(req:Request){return json({authenticated:hasAdminSession(req)})}

export async function POST(req:Request){
 if(!sameAdminOrigin(req))return json({error:'Origem inválida.'},403);
 const limit=limiter.allow(adminClientIp(req));
 if(!limit.allowed)return json({error:'Muitas tentativas. Aguarde antes de tentar novamente.'},429,{'Retry-After':String(limit.retryAfter)});
 try{
  const body=await readAdminBody(req,1024);
  if(!await checkAdminPassword(body.password))return json({error:'Senha incorreta ou acesso indisponível.'},401);
  return json({authenticated:true},200,{'Set-Cookie':adminSessionCookie(createAdminSession())});
 }catch(error){
  if(error instanceof AdminRequestError)return json({error:error.message},error.status);
  return json({error:'Senha incorreta ou acesso indisponível.'},401);
 }
}

export async function DELETE(req:Request){
 if(!sameAdminOrigin(req))return json({error:'Origem inválida.'},403);
 return json({authenticated:false},200,{'Set-Cookie':adminSessionCookie('')});
}
