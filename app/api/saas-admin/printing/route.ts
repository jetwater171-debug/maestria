import {readVenue} from '@/lib/db';
import {hasAdminSession} from '@/lib/saas-admin-auth';
import {printingDiagnostics} from '@/lib/saas-health';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});

export async function GET(req:Request){
 if(!hasAdminSession(req))return json({error:'Acesso exclusivo do administrador do SaaS.'},403);
 try{
  const params=new URL(req.url).searchParams,owner=params.get('owner')||'';
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(owner))return json({error:'Barraca inválida.'},400);
  const row=await readVenue(owner);if(!row)return json({error:'Barraca não encontrada.'},404);
  return json({...printingDiagnostics(row.state,{status:params.get('status')||undefined,employee:params.get('employee')||undefined,destination:params.get('destination')||undefined,query:params.get('query')||undefined,page:params.get('page')||undefined}),version:row.version});
 }catch(error){return json({error:(error as Error).message},400)}
}
